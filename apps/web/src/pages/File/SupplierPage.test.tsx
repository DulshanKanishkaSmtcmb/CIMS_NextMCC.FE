import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import { mockViewportWidth } from '../../test/matchMedia';
import type { Country } from '../../services/masterDataApi';
import type { Supplier } from '../../services/supplierApi';
import { SupplierPage } from './SupplierPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 60_000 }); // slower when the suites run in parallel

const supplier = (code: string, name: string, extra: Partial<Supplier> = {}): Supplier => ({
  shipperCode: code,
  shipperName: name,
  shipperAddress1: '',
  shipperAddress2: '',
  shipperAddress3: '',
  shipperAddress4: '',
  shipperContact1: '',
  shipperContact2: '',
  shipperContact3: '',
  dateCreate: '2026-08-21T09:38:42.950',
  createBy: 'u1',
  dateUpdate: null,
  updateBy: '',
  shipperCodeAir: '',
  shipperCodeSea: '',
  shipperTel: '',
  shipperEmail: '',
  shipperFax: '',
  countryCode: 'IND',
  limaSupplierCode: '',
  rexNo: '',
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
  supplier('A0001', 'ACS LOGISTICS LTD', { shipperAddress1: 'No 1 Road' }),
  supplier('S0001', 'SPEEDMARK LOGISTICS', {
    shipperAddress1: 'Line one',
    shipperContact2: 'Ms Two',
    shipperTel: '011 222',
    shipperEmail: 'a@b.c',
    shipperFax: '011 333',
    countryCode: 'VN',
    shipperCodeSea: 'SE1',
    shipperCodeAir: 'AI1',
    limaSupplierCode: 'LIMA1',
    rexNo: 'REX9',
  }),
  supplier('S0002', 'SAMS ATTIRE'),
];
const COUNTRIES = [country('IND', 'INDIA'), country('VN', 'VIETNAM')];
const SEA = [{ shCode: 'SE1', shName: 'SEA ONE', shAdd1: 'x', shAdd2: '', shAdd3: '', shAdd4: '' }];
const AIR = [{ shCode: 'AI1', shName: 'AIR ONE', shAdd1: 'y', shAdd2: '', shAdd3: '', shAdd4: '' }];

const BASE = '/api/v1/master-data/suppliers';
const COUNTRIES_URL = '/api/v1/master-data/countries';

let calls: MockCall[] = [];
let saveReply: MockHandler = () => ({
  status: 200,
  data: { supplierCode: 'Z0001', message: 'Data Saved Successfully' },
});
let freightUnavailable = false;
let restoreViewport: () => void = () => undefined;

function setup(extra: MockHandler = () => undefined) {
  calls = installMockApi((call) => {
    const custom = extra(call);
    if (custom) return custom;
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: ROWS };
    if (call.method === 'GET' && call.url === `${BASE}/search`) {
      const name = String(call.params?.name ?? '').toLowerCase();
      return {
        status: 200,
        data: ROWS.filter((r) => r.shipperName.toLowerCase().startsWith(name)),
      };
    }
    if (call.method === 'GET' && call.url === `${BASE}/sea-shippers`)
      return freightUnavailable
        ? { status: 503, data: { code: 'SEA_DATABASE_UNAVAILABLE' } }
        : { status: 200, data: SEA };
    if (call.method === 'GET' && call.url === `${BASE}/air-shippers`)
      return freightUnavailable
        ? { status: 503, data: { code: 'AIR_DATABASE_UNAVAILABLE' } }
        : { status: 200, data: AIR };
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/sea-shippers/`)) {
      const row = SEA.find((r) => r.shCode === call.url.split('/').pop());
      return row
        ? { status: 200, data: row }
        : { status: 404, data: { code: 'SEA_SHIPPER_NOT_FOUND' } };
    }
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/air-shippers/`)) {
      const row = AIR.find((r) => r.shCode === call.url.split('/').pop());
      return row
        ? { status: 200, data: row }
        : { status: 404, data: { code: 'AIR_SHIPPER_NOT_FOUND' } };
    }
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/`)) {
      const code = decodeURIComponent(call.url.slice(BASE.length + 1));
      const row = ROWS.find((r) => r.shipperCode.toLowerCase() === code.toLowerCase());
      return row
        ? { status: 200, data: row }
        : { status: 404, data: { code: 'SUPPLIER_NOT_FOUND' } };
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
  return renderWithProviders(<SupplierPage />, {
    preloadedState: signedInState,
    route: '/File/Supplier',
  });
}

afterEach(() => {
  resetClient();
  freightUnavailable = false;
  saveReply = () => ({
    status: 200,
    data: { supplierCode: 'Z0001', message: 'Data Saved Successfully' },
  });
});

const field = (label: RegExp) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const findList = () => screen.findByRole('list', { name: 'Suppliers' });
const writes = () => calls.filter((c) => c.method === 'POST' || c.method === 'PUT');

async function startNew(user: ReturnType<typeof userEvent.setup>) {
  await within(await findList()).findByRole('button', { name: /SPEEDMARK/ });
  await user.click(screen.getAllByRole('button', { name: 'New supplier' })[0]);
  return screen.findByRole('region', { name: 'New supplier' });
}

async function openSupplier(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await within(await findList()).findByRole('button', { name: new RegExp(name) }));
  await waitFor(() => expect(field(/Supplier name/)).toHaveValue(name));
}

async function pick(
  user: ReturnType<typeof userEvent.setup>,
  button: string,
  title: string,
  rowText: string,
) {
  await user.click(screen.getByRole('button', { name: button }));
  const dialog = await screen.findByRole('dialog', { name: title });
  const row = within(dialog).getByText(rowText).closest('[role="row"]') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Select' }));
}

describe('SupplierPage', () => {
  beforeEach(() => {
    restoreViewport = mockViewportWidth(1440);
  });
  afterEach(() => restoreViewport());

  it('lists the suppliers next to an empty detail and reads only the list on load', async () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Suppliers' })).toBeInTheDocument();
    const items = within(await findList()).getAllByRole('button');
    expect(items.map((i) => i.textContent)).toEqual([
      'ACS LOGISTICS LTDA0001 · IND · No 1 Road',
      'SPEEDMARK LOGISTICSS0001 · VN · Line one',
      'SAMS ATTIRES0002 · IND',
    ]);
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`GET ${BASE}`]);
  });

  it('starts a new supplier with the code to be assigned, sections in order and the cursor in the name', async () => {
    const user = userEvent.setup();
    setup();
    const panel = await startNew(user);

    expect(field(/Supplier code/)).toHaveAccessibleDescription(
      'Assigned when you save: the first letter of the name and the next number.',
    );
    expect(field(/Supplier code/)).toHaveAttribute('readonly');
    await waitFor(() => expect(field(/Supplier name/)).toHaveFocus());
    const headings = within(panel)
      .getAllByRole('heading', { level: 3 })
      .map((h) => h.textContent);
    expect(headings).toEqual(['Address', 'Contact', 'Codes in other systems']);
    const ordered = [
      field(/Supplier name/),
      field(/^Country/),
      field(/Address line 1/),
      field(/Telephone no/),
      field(/Contact person 3/),
      field(/Sea shipper/),
      field(/Air shipper/),
      field(/LIMA supplier code/),
      field(/REX no/),
    ];
    ordered.slice(1).forEach((node, i) => {
      expect(
        ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
  });

  it('asks for the name first and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.click(save());
    expect(await screen.findByTestId('save-problems')).toHaveTextContent('Enter the supplier name');
    expect(save()).toBeEnabled();
    expect(calls.filter((c) => c.url !== BASE)).toHaveLength(0);
  });

  it('saves a new supplier with POST (no code check first) and shows the generated code', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Supplier name/), 'Zeta Textiles');
    await user.type(field(/Address line 1/), '1 Main St');
    await user.type(field(/Telephone no/), '011 1');
    await user.type(field(/LIMA supplier code/), 'LM9');
    await pick(user, 'Search countries', 'Countries', 'VIETNAM');
    await waitFor(() => expect(field(/^Country/)).toHaveAccessibleDescription('VIETNAM'));
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent(
      'Supplier created with code Z0001.',
    );
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe(BASE);
    expect(post?.body).toEqual({
      shipperName: 'Zeta Textiles',
      shipperAddress1: '1 Main St',
      shipperAddress2: '',
      shipperAddress3: '',
      shipperAddress4: '',
      shipperContact1: '',
      shipperContact2: '',
      shipperContact3: '',
      shipperTel: '011 1',
      shipperEmail: '',
      shipperFax: '',
      countryCode: 'VN',
      shipperCodeAir: '',
      shipperCodeSea: '',
      limaSupplierCode: 'LM9',
      rexNo: '',
    });
    // New does not check the code first: the server makes it
    expect(calls.some((c) => c.method === 'GET' && c.url.startsWith(`${BASE}/Z`))).toBe(false);
    expect(field(/Supplier code/)).toHaveValue('Z0001');
    expect(screen.getByRole('heading', { name: 'Zeta Textiles (Z0001)' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
  });

  it('shows the server message when the save fails and keeps the form editable', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: { code: 'VALIDATION_FAILED', errors: { ShipperName: ['Too long'] } },
    });
    setup();
    await startNew(user);

    await user.type(field(/Supplier name/), 'Zeta');
    await user.click(save());

    const error = await screen.findByTestId('detail-error');
    expect(error).toHaveTextContent('Data not saved');
    expect(error).toHaveTextContent('Too long');
    expect(save()).toBeEnabled();
  });

  it('says when no code is left for the first letter (server 409 on a new supplier)', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'SUPPLIER_CODE_SEQUENCE_EXHAUSTED' } });
    setup();
    await startNew(user);

    await user.type(field(/Supplier name/), 'Zeta');
    await user.click(save());

    expect(await screen.findByTestId('detail-error')).toHaveTextContent(
      'No supplier code is free for names starting with “Z”.',
    );
  });

  it('opens a supplier with every field (country, shippers, LIMA) and saves them back with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await openSupplier(user, 'SPEEDMARK LOGISTICS');
    expect(field(/Supplier code/)).toHaveValue('S0001');
    expect(field(/Address line 1/)).toHaveValue('Line one');
    expect(field(/Contact person 2/)).toHaveValue('Ms Two');
    expect(field(/Telephone no/)).toHaveValue('011 222');
    expect(field(/Fax no/)).toHaveValue('011 333');
    expect(field(/Email address/)).toHaveValue('a@b.c');
    expect(field(/LIMA supplier code/)).toHaveValue('LIMA1');
    expect(field(/REX no/)).toHaveValue('REX9');
    expect(field(/^Country/)).toHaveValue('VN');
    await waitFor(() => expect(field(/^Country/)).toHaveAccessibleDescription('VIETNAM'));
    expect(field(/Sea shipper/)).toHaveValue('SE1');
    expect(field(/Sea shipper/)).toHaveAccessibleDescription('SEA ONE');
    expect(field(/Air shipper/)).toHaveValue('AI1');
    expect(field(/Air shipper/)).toHaveAccessibleDescription('AIR ONE');
    expect(field(/Supplier name/)).toHaveAttribute('readonly');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(field(/Supplier name/));
    await user.type(field(/Supplier name/), 'SPEEDMARK LOGISTICS 2');
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('Supplier S0001 saved.');
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${BASE}/S0001`);
    expect(put?.body).toMatchObject({
      shipperName: 'SPEEDMARK LOGISTICS 2',
      countryCode: 'VN',
      shipperCodeSea: 'SE1',
      shipperCodeAir: 'AI1',
      limaSupplierCode: 'LIMA1',
      rexNo: 'REX9',
      shipperContact2: 'Ms Two',
    });
    // the existence check comes first
    expect(calls.findIndex((c) => c.method === 'GET' && c.url === `${BASE}/S0001`)).toBeLessThan(
      calls.findIndex((c) => c.method === 'PUT'),
    );
  });

  it('refuses a name that does not start with the first character of the code, without saving', async () => {
    const user = userEvent.setup();
    setup();
    await openSupplier(user, 'ACS LOGISTICS LTD');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.clear(field(/Supplier name/));
    await user.type(field(/Supplier name/), 'XCS LOGISTICS');
    await user.click(save());

    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'The name must start with “A”, like the code A0001.',
    );
    expect(field(/Supplier name/)).toHaveAttribute('aria-invalid', 'true');
    expect(writes()).toHaveLength(0);
  });

  it('says when a supplier being changed no longer exists, without saving', async () => {
    const user = userEvent.setup();
    let gone = false;
    setup((call) =>
      gone && call.method === 'GET' && call.url === `${BASE}/S0002`
        ? { status: 404, data: { code: 'SUPPLIER_NOT_FOUND' } }
        : undefined,
    );
    await openSupplier(user, 'SAMS ATTIRE');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(field(/Supplier name/), ' 2');
    gone = true;
    await user.click(save());

    expect(await screen.findByTestId('detail-error')).toHaveTextContent(
      'Supplier S0002 no longer exists.',
    );
    expect(writes()).toHaveLength(0);
  });

  it('shows similar names while a new name is typed, narrows them and keeps them after leaving the field', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Supplier name/), 'S');
    const hint = await screen.findByTestId('similar-names');
    expect(hint).toHaveTextContent('SPEEDMARK LOGISTICS');
    expect(hint).toHaveTextContent('SAMS ATTIRE');
    await user.type(field(/Supplier name/), 'PEED');
    expect(screen.getByTestId('similar-names')).not.toHaveTextContent('SAMS ATTIRE');
    await user.tab();
    expect(screen.getByTestId('similar-names')).toHaveTextContent('SPEEDMARK LOGISTICS');
    await user.clear(field(/Supplier name/));
    expect(screen.queryByTestId('similar-names')).not.toBeInTheDocument();
  });

  it('picks the sea and air shippers from their lists and shows their names', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await pick(user, 'Search sea shippers', 'Sea shippers (SFOS)', 'SEA ONE');
    await waitFor(() => expect(field(/Sea shipper/)).toHaveAccessibleDescription('SEA ONE'));
    expect(field(/Sea shipper/)).toHaveValue('SE1');
    await pick(user, 'Search air shippers', 'Air shippers (AFOS)', 'AIR ONE');
    await waitFor(() => expect(field(/Air shipper/)).toHaveAccessibleDescription('AIR ONE'));
  });

  it('says so when the sea or air freight system cannot be reached', async () => {
    const user = userEvent.setup();
    freightUnavailable = true;
    setup();
    await startNew(user);

    await user.click(screen.getByRole('button', { name: 'Search sea shippers' }));
    await waitFor(() =>
      expect(field(/Sea shipper/)).toHaveAccessibleDescription(
        'The sea freight system (SFOS) cannot be reached now. Sea shippers cannot be listed.',
      ),
    );
    await user.click(screen.getByRole('button', { name: 'Search air shippers' }));
    await waitFor(() =>
      expect(field(/Air shipper/)).toHaveAccessibleDescription(
        'The air freight system (AFOS) cannot be reached now. Air shippers cannot be listed.',
      ),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
