import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { Country } from '../../services/masterDataApi';
import type { PmSupplier } from '../../services/supplierApi';
import { PmSupplierPage } from './PmSupplierPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 30_000 });

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

function setup() {
  calls = installMockApi((call) => {
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

describe('PmSupplierPage', () => {
  it('shows the legacy fields in order with their ids, no search button on the code in New, and sends nothing', () => {
    setup();

    expect(
      screen.getByRole('heading', { name: 'PM Suppliers Master Details' }),
    ).toBeInTheDocument();
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
    expect(byId('btnCountryCode')).not.toBeNull();
    expect(byId('btnSupplierCode')).toBeNull(); // legacy: visible only outside New
    expect(field('Supplier Code')).toHaveAttribute('readonly');
    // the PM page has no SFOS / AFOS / Lima / REX fields and no pre-entered box
    expect(screen.queryByRole('textbox', { name: /SFOS|AFOS|LIMA|REX/ })).toBeNull();
    expect(calls).toHaveLength(0);
  });

  it('asks for the name with the legacy message and sends nothing', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(save());

    expect(await screen.findByText('Enter Supplier Name')).toBeInTheDocument();
    expect(save()).toBeEnabled();
    expect(calls).toHaveLength(0);
  });

  it('saves a new PM supplier with POST, shows the generated code and keeps Save disabled until New', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Supplier Name'), 'Zeta Packaging');
    await user.type(field('Contact Person 3'), 'Ms Three');
    await pickFromDialog(user, 'btnCountryCode', 'Country Listing', 'SRI LANKA');
    await waitFor(() => expect(field('Country Name')).toHaveValue('SRI LANKA'));
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
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
    expect(field('Supplier Code')).toHaveValue('Z0001');
    expect(save()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(save()).toBeEnabled();
    expect(field('Supplier Code')).toHaveValue('');
    expect(field('Country')).toHaveValue('');
    expect(field('Country Name')).toHaveValue('');
  });

  it('shows the server message when the save fails and lets the user try again', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: { code: 'VALIDATION_FAILED', errors: { PmSupplierName: ['Too long'] } },
    });
    setup();

    await user.type(field('Supplier Name'), 'Zeta');
    await user.click(save());

    expect(await screen.findByText('Data not Saved [Too long]')).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it('in Change mode lists the PM suppliers, loads the record with its country and saves with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    expect(byId('btnSupplierCode')).not.toBeNull();
    await pickFromDialog(user, 'btnSupplierCode', 'Supplier Listing', 'Maxim');

    await waitFor(() => expect(field('Supplier Name')).toHaveValue('Maxim'));
    expect(field('Supplier Code')).toHaveValue('M0004');
    expect(field('Contact Person 1')).toHaveValue('Mr M');
    expect(field('Country')).toHaveValue('IND');
    await waitFor(() => expect(field('Country Name')).toHaveValue('INDIA'));

    await user.clear(field('Supplier Name'));
    await user.type(field('Supplier Name'), 'Maxim 2');
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${BASE}/M0004`);
    expect(put?.body).toMatchObject({
      pmSupplierName: 'Maxim 2',
      pmSupplierContact1: 'Mr M',
      countryCode: 'IND',
    });
    // there is no "name must start with the code letter" rule on this page
    expect(calls.findIndex((c) => c.method === 'GET' && c.url === `${BASE}/M0004`)).toBeLessThan(
      calls.findIndex((c) => c.method === 'PUT'),
    );
  });

  it('allows a name that starts with another letter than the code (no rule on this page)', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    await pickFromDialog(user, 'btnSupplierCode', 'Supplier Listing', 'Maxim');
    await waitFor(() => expect(field('Supplier Name')).toHaveValue('Maxim'));
    await user.clear(field('Supplier Name'));
    await user.type(field('Supplier Name'), 'Zaxim');
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
  });

  it('says the code does not exist when Change is saved without one or with an unknown one', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    await user.type(field('Supplier Name'), 'Zeta');
    await user.click(save());
    expect(await screen.findByText('Supplier Code not Exist')).toBeInTheDocument();
    expect(calls).toHaveLength(0);

    await user.type(field('Supplier Code'), 'Z0009');
    await user.tab();
    await user.click(save());
    await waitFor(() =>
      expect(calls.some((c) => c.method === 'GET' && c.url === `${BASE}/Z0009`)).toBe(true),
    );
    expect(calls.some((c) => c.method === 'PUT')).toBe(false);
    expect(save()).toBeEnabled();
  });

  it('looks a code typed with Enter up in the PM suppliers (legacy asked the Supplier table) and says "Invalid Code" for an unknown one', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    await user.type(field('Supplier Code'), 'A0001{Enter}');
    await waitFor(() => expect(field('Supplier Name')).toHaveValue('A & B Graphics'));
    expect(field('Supplier Code')).toHaveValue('A0001');
    expect(calls.every((c) => !c.url.includes('/master-data/suppliers'))).toBe(true);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.clear(field('Supplier Code'));
    await user.type(field('Supplier Code'), 'Q9999{Enter}');
    expect(await screen.findByText('Invalid Code')).toBeInTheDocument();
  });

  it('lists the PM suppliers on Enter in an empty code field', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'View');
    await user.click(field('Supplier Code'));
    await user.keyboard('{Enter}');

    expect(await screen.findByRole('dialog', { name: 'Supplier Listing' })).toBeInTheDocument();
  });

  it('in View mode loads a record, locks the fields and disables Save; New unlocks them', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'View');
    expect(save()).toBeDisabled();
    await pickFromDialog(user, 'btnSupplierCode', 'Supplier Listing', 'A & B Graphics');

    await waitFor(() => expect(field('Supplier Name')).toHaveValue('A & B Graphics'));
    await waitFor(() => expect(field('Supplier Name')).toHaveAttribute('readonly'));
    expect(field('Address Line1')).toHaveValue('Old Road');
    expect(field('Telephone No')).toHaveValue('+94 11');
    expect(byId('btnSupplierCode')).toBeDisabled();
    expect(save()).toBeDisabled();

    await chooseOption(user, 'New');
    expect(field('Supplier Name')).not.toHaveAttribute('readonly');
    expect(save()).toBeEnabled();
  });

  it('lists the PM suppliers on Enter in New mode, where Select only closes the list', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(field('Supplier Code'));
    await user.keyboard('{Enter}');
    const dialog = await screen.findByRole('dialog', { name: 'Supplier Listing' });
    const row = within(dialog).getByText('Maxim').closest('[role="row"]') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Select' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(field('Supplier Code')).toHaveValue('');
    expect(field('Supplier Name')).toHaveValue('');
  });
});
