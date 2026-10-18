import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import { mockViewportWidth } from '../../test/matchMedia';
import type { Country } from '../../services/masterDataApi';
import type { PmSupplier } from '../../services/supplierApi';
import { PmSupplierPage } from './PmSupplierPage';

// DataGrid interactions (the country lookup dialog) are slow in jsdom.
vi.setConfig({ testTimeout: 60_000 }); // slower when the suites run in parallel

const pm = (code: string, name: string, extra: Partial<PmSupplier> = {}): PmSupplier => ({
  pmSupplierCode: code,
  pmSupplierName: name,
  pmSupplierAddress1: '',
  pmSupplierAddress2: '',
  pmSupplierAddress3: '',
  pmSupplierAddress4: '',
  pmSupplierContact1: '',
  pmSupplierContact2: '',
  pmSupplierContact3: '',
  pmSupplierTel: '',
  pmSupplierEmail: '',
  pmSupplierFax: '',
  countryCode: 'LKA',
  ...extra,
});

const country = (code: string, name: string): Country => ({
  countryCode: code,
  countryName: name,
  cargoMovement: 'Both',
  dateEnter: null,
  enterBy: '',
  dateUpdate: null,
  updateBy: '',
  contractBlock: false,
});

const ROWS = [
  pm('A0001', 'A & B Graphics', { pmSupplierAddress1: 'Old Road', pmSupplierTel: '+94 11' }),
  pm('M0004', 'Maxim', { pmSupplierContact1: 'Mr M', countryCode: 'IND' }),
];
const COUNTRIES = [country('IND', 'INDIA'), country('LKA', 'SRI LANKA')];

const BASE = '/api/v1/master-data/pm-suppliers';
const COUNTRIES_URL = '/api/v1/master-data/countries';

let calls: MockCall[] = [];
let saveReply: MockHandler = () => ({
  status: 200,
  data: { pmSupplierCode: 'Z0001', message: 'Data Saved Successfully' },
});
let restoreViewport: () => void = () => undefined;

function setup(extra: MockHandler = () => undefined) {
  calls = installMockApi((call) => {
    const custom = extra(call);
    if (custom) return custom;
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: ROWS };
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/`)) {
      const code = decodeURIComponent(call.url.slice(BASE.length + 1));
      const row = ROWS.find((r) => r.pmSupplierCode.toLowerCase() === code.toLowerCase());
      return row
        ? { status: 200, data: row }
        : { status: 404, data: { code: 'PM_SUPPLIER_NOT_FOUND' } };
    }
    if (call.method === 'GET' && call.url === COUNTRIES_URL)
      return { status: 200, data: COUNTRIES };
    if (call.method === 'GET' && call.url.startsWith(`${COUNTRIES_URL}/`)) {
      const code = decodeURIComponent(call.url.slice(COUNTRIES_URL.length + 1));
      const row = COUNTRIES.find((r) => r.countryCode === code);
      return row
        ? { status: 200, data: row }
        : { status: 404, data: { code: 'COUNTRY_NOT_FOUND' } };
    }
    if (call.method === 'POST' || call.method === 'PUT') return saveReply(call);
    return undefined;
  });
  return renderWithProviders(<PmSupplierPage />, {
    preloadedState: signedInState,
    route: '/File/PmSupplier',
  });
}

afterEach(() => {
  resetClient();
  saveReply = () => ({
    status: 200,
    data: { pmSupplierCode: 'Z0001', message: 'Data Saved Successfully' },
  });
});

const field = (label: RegExp) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const findList = () => screen.findByRole('list', { name: 'PM suppliers' });
const writes = () => calls.filter((c) => c.method === 'POST' || c.method === 'PUT');

async function startNew(user: ReturnType<typeof userEvent.setup>) {
  await within(await findList()).findByRole('button', { name: /Maxim/ });
  await user.click(screen.getAllByRole('button', { name: 'New PM supplier' })[0]);
  return screen.findByRole('region', { name: 'New PM supplier' });
}

async function openPm(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await within(await findList()).findByRole('button', { name: new RegExp(name) }));
  await waitFor(() => expect(field(/PM supplier name/)).toHaveValue(name));
}

async function pickCountry(user: ReturnType<typeof userEvent.setup>, rowText: string) {
  await user.click(screen.getByRole('button', { name: 'Search countries' }));
  const dialog = await screen.findByRole('dialog', { name: 'Countries' });
  const row = within(dialog).getByText(rowText).closest('[role="row"]') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Select' }));
}

describe('PmSupplierPage', () => {
  beforeEach(() => {
    restoreViewport = mockViewportWidth(1440);
  });
  afterEach(() => restoreViewport());

  it('lists the PM suppliers next to an empty detail and reads only the list on load', async () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'PM suppliers' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search PM suppliers' })).toBeInTheDocument();
    const items = within(await findList()).getAllByRole('button');
    expect(items.map((i) => i.textContent)).toEqual([
      'A & B GraphicsA0001 · LKA · Old Road',
      'MaximM0004 · IND',
    ]);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`GET ${BASE}`]);
  });

  it('starts a new PM supplier with the code to be assigned and the cursor in the name', async () => {
    const user = userEvent.setup();
    setup();
    const panel = await startNew(user);

    expect(field(/PM supplier code/)).toHaveAttribute('readonly');
    expect(field(/PM supplier code/)).toHaveAccessibleDescription(
      'Assigned when you save: the first letter of the name and the next number.',
    );
    await waitFor(() => expect(field(/PM supplier name/)).toHaveFocus());
    expect(
      within(panel)
        .getAllByRole('heading', { level: 3 })
        .map((h) => h.textContent),
    ).toEqual(['Address', 'Contact']);
    expect(screen.queryByTestId('similar-names')).not.toBeInTheDocument();
  });

  it('asks for the name and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.click(save());
    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'Enter the PM supplier name',
    );
    expect(save()).toBeEnabled();
    expect(calls.filter((c) => c.url !== BASE)).toHaveLength(0);
  });

  it('saves a new PM supplier with POST (no code check first) and shows the generated code', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/PM supplier name/), 'Zeta Packaging');
    await user.type(field(/Contact person 3/), 'Ms Three');
    await pickCountry(user, 'SRI LANKA');
    await waitFor(() => expect(field(/^Country/)).toHaveAccessibleDescription('SRI LANKA'));
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent(
      'PM supplier created with code Z0001.',
    );
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe(BASE);
    expect(post?.body).toEqual({
      pmSupplierName: 'Zeta Packaging',
      pmSupplierAddress1: '',
      pmSupplierAddress2: '',
      pmSupplierAddress3: '',
      pmSupplierAddress4: '',
      pmSupplierContact1: '',
      pmSupplierContact2: '',
      pmSupplierContact3: 'Ms Three',
      pmSupplierTel: '',
      pmSupplierEmail: '',
      pmSupplierFax: '',
      countryCode: 'LKA',
    });
    expect(calls.some((c) => c.method === 'GET' && c.url.startsWith(`${BASE}/Z`))).toBe(false);
    expect(field(/PM supplier code/)).toHaveValue('Z0001');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('shows the server message when the save fails and keeps the form editable', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: { code: 'VALIDATION_FAILED', errors: { PmSupplierName: ['Too long'] } },
    });
    setup();
    await startNew(user);

    await user.type(field(/PM supplier name/), 'Zeta');
    await user.click(save());

    const error = await screen.findByTestId('detail-error');
    expect(error).toHaveTextContent('Data not saved');
    expect(error).toHaveTextContent('Too long');
    expect(save()).toBeEnabled();
  });

  it('opens a PM supplier with its country, edits it and saves with PUT after the existence check', async () => {
    const user = userEvent.setup();
    setup();

    await openPm(user, 'Maxim');
    expect(field(/PM supplier code/)).toHaveValue('M0004');
    expect(field(/Contact person 1/)).toHaveValue('Mr M');
    expect(field(/^Country/)).toHaveValue('IND');
    await waitFor(() => expect(field(/^Country/)).toHaveAccessibleDescription('INDIA'));

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(field(/PM supplier name/));
    await user.type(field(/PM supplier name/), 'Maxim 2');
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('PM supplier M0004 saved.');
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${BASE}/M0004`);
    expect(put?.body).toMatchObject({
      pmSupplierName: 'Maxim 2',
      pmSupplierContact1: 'Mr M',
      countryCode: 'IND',
    });
    expect(calls.findIndex((c) => c.method === 'GET' && c.url === `${BASE}/M0004`)).toBeLessThan(
      calls.findIndex((c) => c.method === 'PUT'),
    );
  });

  it('allows a name that starts with another letter than the code (no rule on this page)', async () => {
    const user = userEvent.setup();
    setup();
    await openPm(user, 'Maxim');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(field(/PM supplier name/));
    await user.type(field(/PM supplier name/), 'Other Name');
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('PM supplier M0004 saved.');
    expect(calls.find((c) => c.method === 'PUT')?.body).toMatchObject({
      pmSupplierName: 'Other Name',
    });
  });

  it('says when a PM supplier being changed no longer exists, without saving', async () => {
    const user = userEvent.setup();
    let gone = false;
    setup((call) =>
      gone && call.method === 'GET' && call.url === `${BASE}/A0001`
        ? { status: 404, data: { code: 'PM_SUPPLIER_NOT_FOUND' } }
        : undefined,
    );
    await openPm(user, 'A & B Graphics');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(field(/Telephone no/), '9');
    gone = true;
    await user.click(save());

    expect(await screen.findByTestId('detail-error')).toHaveTextContent(
      'PM supplier A0001 no longer exists.',
    );
    expect(writes()).toHaveLength(0);
  });

  it('never asks the Supplier endpoints (legacy Enter did, P1)', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(screen.getByRole('searchbox', { name: 'Search PM suppliers' }));
    await user.keyboard('m0004{Enter}');
    await waitFor(() => expect(field(/PM supplier name/)).toHaveValue('Maxim'));
    expect(calls.some((c) => c.url.includes('/master-data/suppliers'))).toBe(false);
  });
});
