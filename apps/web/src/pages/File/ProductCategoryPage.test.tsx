import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { ChainCode } from '../../services/packingMaterialApi';
import { ProductCategoryPage } from './ProductCategoryPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 60_000 }); // slower when the suites run in parallel

const chain = (code: string, name: string, tp: string, range: string, ean: string): ChainCode => ({
  chainCode: code,
  chainName: name,
  tpPartnerName: tp,
  range,
  rangeBoxEan: ean,
});

const INITIAL = [
  chain('A', 'Womenswear', 'LIPSY/NEXT/FLT', 'Womens', 'WWR'),
  chain('C', 'Childrensware', 'NEXT', 'Childrens', 'CWR'),
];
const RANGES = [{ category: 'Womens' }, { category: 'Childrens' }];
const BASE = '/api/v1/master-data/product-categories';
const SAVED = { status: 200, data: { chainCode: 'Z', message: 'Data Saved Successfully' } };

let calls: MockCall[] = [];
let rows: ChainCode[] = [];
let saveReply: MockHandler = () => SAVED;

function setup(initial: ChainCode[] = INITIAL) {
  rows = [...initial];
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === `${BASE}/ranges`)
      return { status: 200, data: RANGES };
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: rows };
    if (call.method === 'POST') {
      const reply = saveReply(call);
      if (reply?.status === 200) {
        const b = call.body as ChainCode;
        rows = [...rows, chain(b.chainCode, b.chainName, b.tpPartnerName, b.range, b.rangeBoxEan)];
      }
      return reply;
    }
    return undefined;
  });
  return renderWithProviders(<ProductCategoryPage />, {
    preloadedState: signedInState,
    route: '/File/ProductCategory',
  });
}

afterEach(() => {
  resetClient();
  saveReply = () => SAVED;
});

const field = (label: RegExp) => screen.getByRole('textbox', { name: label });
const add = () => screen.getByRole('button', { name: 'Add chain code' });
const rangeGroup = () => screen.getByRole('group', { name: 'Range' });
const writes = () => calls.filter((c) => c.method === 'POST');
const grid = () => screen.queryByTestId('chain-code-grid');
const problems = () => screen.getByTestId('save-problems');

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: { code?: string; name?: string; tp?: string; ean?: string },
) {
  if (values.code !== undefined) await user.type(field(/^Chain code/), values.code);
  if (values.name !== undefined) await user.type(field(/^Chain name/), values.name);
  if (values.tp !== undefined) await user.type(field(/TP partner name/), values.tp);
  if (values.ean !== undefined) await user.type(field(/Range box EAN/), values.ean);
}

async function ready() {
  await screen.findByText('Womenswear');
  await waitFor(() =>
    expect(within(rangeGroup()).getByRole('button', { name: 'Womens' })).toHaveAttribute(
      'aria-pressed',
      'true',
    ),
  );
}

describe('ProductCategoryPage', () => {
  it('shows the add form (first range chosen) above the existing chain codes', async () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Chain codes' })).toBeInTheDocument();
    expect(screen.getByText('File · Product Category')).toBeInTheDocument();
    await ready();
    const ordered = [
      field(/^Chain code/),
      field(/^Chain name/),
      rangeGroup(),
      field(/TP partner name/),
      field(/Range box EAN/),
      add(),
      screen.getByRole('region', { name: 'Existing chain codes' }),
    ];
    ordered.slice(1).forEach((node, i) => {
      expect(
        ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    const table = grid() as HTMLElement;
    for (const title of ['Chain code', 'Chain name', 'Range', 'TP partner name', 'Range box EAN']) {
      expect(within(table).getByText(title)).toBeInTheDocument();
    }
    expect(within(table).getByText('Childrensware')).toBeInTheDocument();
    expect(screen.getByTestId('code-count')).toHaveTextContent('2 codes');
    expect(calls.map((c) => `${c.method} ${c.url}`).sort()).toEqual([
      `GET ${BASE}`,
      `GET ${BASE}/ranges`,
    ]);
  });

  it('checks the fields in the legacy order, one at a time, and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await ready();

    await user.click(add());
    expect(problems()).toHaveTextContent('Enter the chain code');
    await fill(user, { code: 'QQ' });
    // the field takes one character only
    expect(field(/^Chain code/)).toHaveValue('Q');
    await user.click(add());
    expect(problems()).toHaveTextContent('Enter the chain name');
    await fill(user, { name: 'Name' });
    await user.click(add());
    expect(problems()).toHaveTextContent('Enter the TP partner name');
    await fill(user, { tp: 'TP' });
    await user.click(add());
    expect(problems()).toHaveTextContent('Enter the range box EAN');
    expect(field(/Range box EAN/)).toHaveAttribute('aria-invalid', 'true');
    expect(writes()).toHaveLength(0);
  });

  it('refuses a chain code that is already listed, whatever its case, without posting', async () => {
    const user = userEvent.setup();
    setup();
    await ready();

    await fill(user, { code: 'a' });
    await user.tab();
    expect(field(/^Chain code/)).toHaveAccessibleDescription(
      'Chain code A is already used by Womenswear. Choose another code.',
    );
    await fill(user, { name: 'Again', tp: 'NEXT', ean: 'AAA' });
    await user.click(add());

    expect(problems()).toHaveTextContent('Chain code A is already used by Womenswear.');
    expect(writes()).toHaveLength(0);
  });

  it('adds with POST, says so, clears the form except the range and reads the list again', async () => {
    const user = userEvent.setup();
    setup();
    await ready();

    await user.click(within(rangeGroup()).getByRole('button', { name: 'Childrens' }));
    await fill(user, { code: 'Z', name: 'Zed wear', tp: 'NEXT', ean: 'ZZR' });
    await user.click(add());

    expect(await screen.findByTestId('save-result')).toHaveTextContent(
      'Chain code Z (Zed wear) added.',
    );
    expect(writes()[0].body).toEqual({
      chainCode: 'Z',
      chainName: 'Zed wear',
      range: 'Childrens',
      tpPartnerName: 'NEXT',
      rangeBoxEan: 'ZZR',
    });
    expect(field(/^Chain code/)).toHaveValue('');
    expect(field(/^Chain name/)).toHaveValue('');
    expect(field(/TP partner name/)).toHaveValue('');
    expect(field(/Range box EAN/)).toHaveValue('');
    expect(within(rangeGroup()).getByRole('button', { name: 'Childrens' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(field(/^Chain code/)).toHaveFocus();
    expect(await within(grid() as HTMLElement).findByText('Zed wear')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'GET' && c.url === BASE)).toHaveLength(2);
  });

  it('shows the API message of a refused save and keeps the form', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: { code: 'VALIDATION_FAILED', errors: { Range: ['Select a valid Range'] } },
    });
    setup();
    await ready();

    await fill(user, { code: 'Z', name: 'Zed wear', tp: 'NEXT', ean: 'ZZR' });
    await user.click(add());

    const error = await screen.findByTestId('detail-error');
    expect(error).toHaveTextContent('Data not saved');
    expect(error).toHaveTextContent('Select a valid Range');
    expect(add()).toBeEnabled();
    expect(field(/^Chain name/)).toHaveValue('Zed wear');
  });

  it('maps a 409 from the server to "already exists" on the code', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'CHAIN_CODE_EXISTS' } });
    setup();
    await ready();

    await fill(user, { code: 'Z', name: 'Zed wear', tp: 'NEXT', ean: 'ZZR' });
    await user.click(add());

    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'Chain code Z already exists.',
    );
  });

  it('narrows the list with the search box and says that export is not available yet', async () => {
    const user = userEvent.setup();
    setup();
    await ready();

    await user.type(field(/Search chain codes/), 'child');
    expect(within(grid() as HTMLElement).queryByText('Womenswear')).not.toBeInTheDocument();
    expect(within(grid() as HTMLElement).getByText('Childrensware')).toBeInTheDocument();
    await user.type(field(/Search chain codes/), 'zzz');
    expect(screen.getByText('No chain codes match “childzzz”')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Export' }));
    expect(screen.getByTestId('export-hint')).toHaveTextContent(
      'Export (copy, CSV, Excel, PDF, print) is not available yet.',
    );
  });

  it('says when there are no chain codes yet', async () => {
    setup([]);

    expect(await screen.findByText('No chain codes yet')).toBeInTheDocument();
    expect(grid()).toBeNull();
  });

  it('adds with Ctrl+S', async () => {
    const user = userEvent.setup();
    setup();
    await ready();

    await fill(user, { code: 'Y', name: 'Why', tp: 'NEXT', ean: 'YYY' });
    await user.keyboard('{Control>}s{/Control}');
    expect(await screen.findByTestId('save-result')).toHaveTextContent('Chain code Y (Why) added.');
  });
});
