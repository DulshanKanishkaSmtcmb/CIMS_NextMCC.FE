import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { Country } from '../../services/masterDataApi';
import type { Supplier } from '../../services/supplierApi';
import { SupplierPage } from './SupplierPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 30_000 });

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

const field = (label: string) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const byId = (id: string) => document.getElementById(id) as HTMLInputElement;

async function chooseOption(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Option' }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function pickFromDialog(
  user: ReturnType<typeof userEvent.setup>,
  buttonId: string,
  title: string,
  rowText: string,
) {
  await user.click(byId(buttonId));
  const dialog = await screen.findByRole('dialog', { name: title });
  const row = within(dialog).getByText(rowText).closest('[role="row"]') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Select' }));
}

describe('SupplierPage', () => {
  it('shows the legacy fields in order with their labels and ids and sends nothing on load', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Suppliers Master Details' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Option' })).toHaveTextContent('New');
    const inOrder = [
      screen.getByRole('combobox', { name: 'Option' }),
      field('Supplier Code'),
      field('Supplier Name'),
      screen.getByText('Address Details'),
      field('Country'),
      field('Country Name'),
      field('Address Line1'),
      field('Address Line2'),
      field('Address Line3'),
      field('Address Line4'),
      screen.getByText('Contact Number Details'),
      field('Telephone No'),
      field('Fax No'),
      field('Email Address'),
      screen.getByText('Contact Person Details'),
      field('Contact Person 1'),
      field('Contact Person 2'),
      field('Contact Person 3'),
      field('Shipper Code [SFOS]'),
      field('Shipper Name [SFOS]'),
      field('Shipper Code [AFOS]'),
      field('Shipper Name [AFOS]'),
      field('Shipper Code[LIMA]'),
      field('REX No'),
      save(),
      screen.getByRole('button', { name: 'New' }),
      screen.getByRole('button', { name: 'Close' }),
    ];
    inOrder.slice(1).forEach((el, i) => {
      expect(
        inOrder[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(field('Supplier Code')).toHaveAttribute('id', 'SupplierCode');
    expect(field('Country')).toHaveAttribute('id', 'CountryCode');
    expect(field('Country Name')).toHaveAttribute('id', 'CountryName');
    expect(field('Shipper Code [SFOS]')).toHaveAttribute('id', 'SFOSCode');
    expect(field('Shipper Name [SFOS]')).toHaveAttribute('id', 'SFOSName');
    expect(field('Shipper Code [AFOS]')).toHaveAttribute('id', 'AFOSCode');
    expect(field('Shipper Name [AFOS]')).toHaveAttribute('id', 'AFOSName');
    for (const id of ['btnSupplierCode', 'btnCountryCode', 'btnSFOSCode', 'btnAFOSCode']) {
      expect(byId(id)).not.toBeNull();
    }
    // New: the code is generated by the server, so it cannot be typed; the display fields are read-only
    expect(field('Supplier Code')).toHaveAttribute('readonly');
    expect(field('Country')).toHaveAttribute('readonly');
    expect(field('Shipper Name [SFOS]')).toHaveAttribute('readonly');
    expect(calls).toHaveLength(0);
  });

  it('asks for the name first with the legacy message and sends nothing', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(save());

    expect(await screen.findByText('Enter Supplier Name')).toBeInTheDocument();
    expect(save()).toBeEnabled();
    expect(calls).toHaveLength(0);
  });

  it('saves a new supplier with POST, shows the generated code and keeps Save disabled until New', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Supplier Name'), 'Zeta Textiles');
    await user.type(field('Address Line1'), '1 Main St');
    await user.type(field('Telephone No'), '011 1');
    await user.type(field('Shipper Code[LIMA]'), 'LM9');
    await pickFromDialog(user, 'btnCountryCode', 'Country Listing', 'VIETNAM');
    await waitFor(() => expect(field('Country Name')).toHaveValue('VIETNAM'));
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
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
    expect(field('Supplier Code')).toHaveValue('Z0001');
    expect(save()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(save()).toBeEnabled();
    expect(field('Supplier Code')).toHaveValue('');
    expect(field('Supplier Name')).toHaveValue('');
    // the legacy New left the previous country in place
    expect(field('Country')).toHaveValue('');
    expect(field('Country Name')).toHaveValue('');
  });

  it('shows the server message when the save fails and lets the user try again', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: { code: 'VALIDATION_FAILED', errors: { ShipperName: ['Too long'] } },
    });
    setup();

    await user.type(field('Supplier Name'), 'Zeta');
    await user.click(save());

    expect(await screen.findByText('Data not Saved [Too long]')).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it('in Change mode lists the suppliers, loads every field (country, shippers, Lima) and saves them back with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    expect(field('Supplier Code')).not.toHaveAttribute('readonly'); // typed or picked outside New
    await pickFromDialog(user, 'btnSupplierCode', 'Supplier Listing', 'SPEEDMARK LOGISTICS');

    await waitFor(() => expect(field('Supplier Name')).toHaveValue('SPEEDMARK LOGISTICS'));
    expect(field('Supplier Code')).toHaveValue('S0001');
    expect(field('Address Line1')).toHaveValue('Line one');
    expect(field('Contact Person 2')).toHaveValue('Ms Two');
    expect(field('Telephone No')).toHaveValue('011 222');
    expect(field('Fax No')).toHaveValue('011 333');
    expect(field('Email Address')).toHaveValue('a@b.c');
    expect(field('Shipper Code[LIMA]')).toHaveValue('LIMA1');
    expect(field('REX No')).toHaveValue('REX9');
    expect(field('Country')).toHaveValue('VN');
    await waitFor(() => expect(field('Country Name')).toHaveValue('VIETNAM'));
    expect(field('Shipper Code [SFOS]')).toHaveValue('SE1');
    await waitFor(() => expect(field('Shipper Name [SFOS]')).toHaveValue('SEA ONE'));
    expect(field('Shipper Code [AFOS]')).toHaveValue('AI1');
    await waitFor(() => expect(field('Shipper Name [AFOS]')).toHaveValue('AIR ONE'));

    await user.clear(field('Supplier Name'));
    await user.type(field('Supplier Name'), 'SPEEDMARK LOGISTICS 2');
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
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

    await chooseOption(user, 'Change');
    await pickFromDialog(user, 'btnSupplierCode', 'Supplier Listing', 'ACS LOGISTICS LTD');
    await waitFor(() => expect(field('Supplier Name')).toHaveValue('ACS LOGISTICS LTD'));
    await user.clear(field('Supplier Name'));
    await user.type(field('Supplier Name'), 'BCS LOGISTICS');
    await user.click(save());

    expect(await screen.findByText('Supplier Name should be Starting with A')).toBeInTheDocument();
    expect(save()).toBeEnabled();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
  });

  it('asks for the code in Change mode and says when it does not exist', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    await user.type(field('Supplier Name'), 'Zeta');
    await user.click(save());
    expect(await screen.findByText('Enter Supplier Code')).toBeInTheDocument();

    await user.type(field('Supplier Code'), 'Z0009');
    await user.tab();
    await user.click(save());
    expect(await screen.findByText('Supplier Code not Exist')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    expect(save()).toBeEnabled();
  });

  it('loads a typed code on Enter and says "Invalid Code" for an unknown one', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    await user.type(field('Supplier Code'), 'A0001{Enter}');
    await waitFor(() => expect(field('Supplier Name')).toHaveValue('ACS LOGISTICS LTD'));

    await chooseOption(user, 'Change'); // same option: stays, form kept
    await user.clear(field('Supplier Code'));
    await user.type(field('Supplier Code'), 'Q9999{Enter}');
    expect(await screen.findByText('Invalid Code')).toBeInTheDocument();
  });

  it('lists the suppliers in New mode without filling the form', async () => {
    const user = userEvent.setup();
    setup();

    await pickFromDialog(user, 'btnSupplierCode', 'Supplier Listing', 'ACS LOGISTICS LTD');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(field('Supplier Code')).toHaveValue('');
    expect(field('Supplier Name')).toHaveValue('');
  });

  it('in View mode loads a record, locks the fields and disables Save; New unlocks them', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'View');
    expect(save()).toBeDisabled();
    await pickFromDialog(user, 'btnSupplierCode', 'Supplier Listing', 'ACS LOGISTICS LTD');

    await waitFor(() => expect(field('Supplier Name')).toHaveValue('ACS LOGISTICS LTD'));
    await waitFor(() => expect(field('Supplier Name')).toHaveAttribute('readonly'));
    expect(field('Address Line1')).toHaveAttribute('readonly');
    expect(byId('btnSupplierCode')).toBeDisabled();
    expect(save()).toBeDisabled();

    await chooseOption(user, 'New');
    expect(field('Supplier Name')).not.toHaveAttribute('readonly');
    expect(byId('btnSupplierCode')).toBeEnabled();
    expect(save()).toBeEnabled();
  });

  it('shows the pre-entered box while a new name is typed, narrows it and keeps it after leaving the field', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Supplier Name'), 'S');
    expect(await screen.findByText('Pre-Entered Supplier Listing')).toBeInTheDocument();
    const table = document.getElementById('tblPdata') as HTMLElement;
    expect(within(table).getByText('SPEEDMARK LOGISTICS')).toBeInTheDocument();
    expect(within(table).getByText('SAMS ATTIRE')).toBeInTheDocument();
    expect(calls.some((c) => c.url === `${BASE}/search` && c.params?.name === 'S')).toBe(true);

    await user.type(field('Supplier Name'), 'PEED');
    expect(within(table).getByText('SPEEDMARK LOGISTICS')).toBeInTheDocument();
    expect(within(table).queryByText('SAMS ATTIRE')).not.toBeInTheDocument();

    await user.tab(); // unlike Country, Ports and DC the Supplier page did not remove the box on blur
    expect(screen.getByText('Pre-Entered Supplier Listing')).toBeInTheDocument();

    await user.clear(field('Supplier Name'));
    expect(screen.queryByText('Pre-Entered Supplier Listing')).not.toBeInTheDocument();
  });

  it('picks the SFOS and AFOS shippers from their dialogs and shows their names', async () => {
    const user = userEvent.setup();
    setup();

    await pickFromDialog(user, 'btnSFOSCode', 'Sea Shipper Listing', 'SEA ONE');
    await waitFor(() => expect(field('Shipper Name [SFOS]')).toHaveValue('SEA ONE'));
    expect(field('Shipper Code [SFOS]')).toHaveValue('SE1');

    await pickFromDialog(user, 'btnAFOSCode', 'Air Shipper Listing', 'AIR ONE');
    await waitFor(() => expect(field('Shipper Name [AFOS]')).toHaveValue('AIR ONE'));
    expect(field('Shipper Code [AFOS]')).toHaveValue('AI1');
  });

  it('says so when the Sea or Air freight system cannot be reached', async () => {
    const user = userEvent.setup();
    freightUnavailable = true;
    setup();

    await user.click(byId('btnSFOSCode'));
    expect(await screen.findByText('Sea Shipper Listing is not available')).toBeInTheDocument();
    await user.click(byId('btnAFOSCode'));
    expect(await screen.findByText('Air Shipper Listing is not available')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('lists the suppliers on Enter in New mode, where Select only closes the list', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(field('Supplier Code'));
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Supplier Listing' });
    const row = within(dialog).getByText('SAMS ATTIRE').closest('[role="row"]') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Select' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(field('Supplier Code')).toHaveValue('');
    expect(field('Supplier Name')).toHaveValue('');
  });
});
