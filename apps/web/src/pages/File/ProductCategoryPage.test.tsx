import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { ChainCode } from '../../services/packingMaterialApi';
import { ProductCategoryPage } from './ProductCategoryPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 30_000 });

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

const field = (label: string) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const range = () => screen.getByRole('combobox', { name: 'Range' });
const writes = () => calls.filter((c) => c.method === 'POST');
const grid = () => document.getElementById('dtStuffingSum') as HTMLElement;

async function fill(
  user: ReturnType<typeof userEvent.setup>,
  values: { code?: string; name?: string; tp?: string; ean?: string },
) {
  if (values.code !== undefined) await user.type(field('Chain Code'), values.code);
  if (values.name !== undefined) await user.type(field('Chain Name'), values.name);
  if (values.tp !== undefined) await user.type(field('TP Partner Name'), values.tp);
  if (values.ean !== undefined) await user.type(field('Range Box EAN'), values.ean);
}

describe('ProductCategoryPage', () => {
  it('shows the legacy fields in order, the first range and the grid of existing chain codes', async () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Product Category' })).toBeInTheDocument();
    await waitFor(() => expect(range()).toHaveTextContent('Womens'));
    await screen.findByText('Womenswear');
    const ordered = [
      field('Chain Code'),
      field('Chain Name'),
      range(),
      field('TP Partner Name'),
      field('Range Box EAN'),
      screen.getByRole('button', { name: 'Copy' }),
      grid(),
      save(),
      screen.getByRole('button', { name: 'Close' }),
    ];
    ordered.slice(1).forEach((node, i) => {
      expect(
        ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    // the legacy page gave the Chain Code input the id of the PM Description box it was copied from
    expect(field('Chain Code')).toHaveAttribute('id', 'PMDescription');
    expect(screen.queryByRole('combobox', { name: 'Option' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();

    const headers = within(grid())
      .getAllByRole('columnheader')
      .map((h) => h.textContent);
    expect(headers).toEqual([
      'Chain Code',
      'Chain Name',
      'TP Partner Name',
      'Range',
      'Range Box EAN',
    ]);
    expect(await within(grid()).findByText('Womenswear')).toBeInTheDocument();
    expect(within(grid()).getByText('LIPSY/NEXT/FLT')).toBeInTheDocument();
    ['Copy', 'CSV', 'Excel', 'PDF', 'Print'].forEach((name) =>
      expect(screen.getByRole('button', { name })).toBeInTheDocument(),
    );
  });

  it('checks the fields in the legacy order with the legacy messages', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(range()).toHaveTextContent('Womens'));

    await user.click(save());
    expect(await screen.findByText('Can not be empty Chain Code')).toBeInTheDocument();
    await fill(user, { code: 'QQ' });
    await user.click(save());
    expect(
      await screen.findByText('Chain Code must be exactly 1 character long'),
    ).toBeInTheDocument();
    await user.clear(field('Chain Code'));
    await fill(user, { code: 'Q' });
    await user.click(save());
    expect(await screen.findByText('Can not be empty Chain Name')).toBeInTheDocument();
    await fill(user, { name: 'Q wear' });
    await user.click(save());
    expect(await screen.findByText('Can not be empty TP Partner Name')).toBeInTheDocument();
    await fill(user, { tp: 'NEXT' });
    await user.click(save());
    expect(await screen.findByText('Can not be empty Range Box EAN')).toBeInTheDocument();

    expect(writes()).toHaveLength(0);
    expect(save()).toBeEnabled();
  });

  it('refuses a chain code that is already in the grid, whatever its case, without posting', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Womenswear');

    await fill(user, { code: 'a', name: 'Again', tp: 'NEXT', ean: 'AAA' });
    await user.click(save());

    expect(await screen.findByText('Can not Duplicate same Chain Code')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
    expect(save()).toBeEnabled();
  });

  it('saves with POST, clears the form except the Range, enables Save and reloads the grid', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Womenswear');

    await user.click(range());
    await user.click(await screen.findByRole('option', { name: 'Childrens' }));
    await fill(user, { code: 'Z', name: 'Zed wear', tp: 'NEXT', ean: 'ZZR' });
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    expect(writes()[0].url).toBe(BASE);
    expect(writes()[0].body).toEqual({
      chainCode: 'Z',
      chainName: 'Zed wear',
      range: 'Childrens',
      tpPartnerName: 'NEXT',
      rangeBoxEan: 'ZZR',
    });
    expect(field('Chain Code')).toHaveValue('');
    expect(field('Chain Name')).toHaveValue('');
    expect(field('TP Partner Name')).toHaveValue('');
    expect(field('Range Box EAN')).toHaveValue('');
    expect(range()).toHaveTextContent('Childrens');
    expect(save()).toBeEnabled();
    expect(await within(grid()).findByText('Zed wear')).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'GET' && c.url === BASE)).toHaveLength(2);
  });

  it('shows the API message of a refused save and enables Save again (legacy stayed stuck)', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: { code: 'VALIDATION_FAILED', errors: { Range: ['Select a valid Range'] } },
    });
    setup();
    await screen.findByText('Womenswear');

    await fill(user, { code: 'Z', name: 'Zed wear', tp: 'NEXT', ean: 'ZZR' });
    await user.click(save());

    expect(await screen.findByText('Data not Saved [Select a valid Range]')).toBeInTheDocument();
    expect(save()).toBeEnabled();
    expect(field('Chain Code')).toHaveValue('Z');
  });

  it('maps a 409 from the server to the duplicate text', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'CHAIN_CODE_EXISTS' } });
    setup();
    await screen.findByText('Womenswear');

    await fill(user, { code: 'Z', name: 'Zed wear', tp: 'NEXT', ean: 'ZZR' });
    await user.click(save());

    expect(await screen.findByText('Can not Duplicate same Chain Code')).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it('narrows the grid with the search box and stubs the export buttons', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByText('Womenswear');

    await user.type(field('Search:'), 'child');
    expect(within(grid()).queryByText('Womenswear')).not.toBeInTheDocument();
    expect(within(grid()).getByText('Childrensware')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Excel' }));
    expect(await screen.findByText('Excel export is not available yet')).toBeInTheDocument();
  });

  it('shows no grid when there are no chain codes', async () => {
    setup([]);

    await waitFor(() => expect(range()).toHaveTextContent('Womens'));
    expect(grid()).toBeNull();
  });
});
