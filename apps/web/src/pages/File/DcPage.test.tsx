import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { Country, Dc } from '../../services/masterDataApi';
import { DcPage } from './DcPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 30_000 });

const dc = (whDes: string, countryCode: string): Dc =>
  ({
    whCode: '3905',
    whDes,
    whDesMain: 'Kohls',
    countryCode,
    loadingOrder: 100,
    stockUpdate: true,
    outerLabel: false,
    brandText: null,
    address: '',
  }) as Dc;
const country = (code: string, name: string): Country => ({
  countryCode: code,
  countryName: name,
  cargoMovement: 'Both',
  dateEnter: null,
  enterBy: 'u1',
  dateUpdate: null,
  updateBy: '',
  contractBlock: false,
});

const DCS = [dc('Kohls Online', 'US'), dc('Re-Export', 'Dubai'), dc('Orphan DC', '')];
const COUNTRIES = [country('IND', 'INDIA'), country('US', 'United States of America')];
const BASE = '/api/v1/master-data/dcs';
const COUNTRIES_URL = '/api/v1/master-data/countries';

let calls: MockCall[] = [];
let saveReply: MockHandler = () => ({
  status: 200,
  data: { whDes: 'ZZT1 DC', message: 'Data Saved Successfully' },
});

function setup() {
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: DCS };
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/`)) {
      const name = decodeURIComponent(call.url.slice(BASE.length + 1));
      const row = DCS.find((d) => d.whDes.toLowerCase() === name.toLowerCase());
      return row ? { status: 200, data: row } : { status: 404, data: { code: 'DC_NOT_FOUND' } };
    }
    if (call.method === 'GET' && call.url === COUNTRIES_URL)
      return { status: 200, data: COUNTRIES };
    if (call.method === 'GET' && call.url.startsWith(`${COUNTRIES_URL}/`)) {
      const code = decodeURIComponent(call.url.slice(COUNTRIES_URL.length + 1));
      const row = COUNTRIES.find((c) => c.countryCode === code);
      return row ? { status: 200, data: row } : { status: 404, data: {} };
    }
    if (call.method === 'POST' || call.method === 'PUT') return saveReply(call);
    return undefined;
  });
  return renderWithProviders(<DcPage />, { preloadedState: signedInState, route: '/File/DC' });
}

afterEach(() => {
  resetClient();
  saveReply = () => ({
    status: 200,
    data: { whDes: 'ZZT1 DC', message: 'Data Saved Successfully' },
  });
});

const field = (label: string) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const el = (id: string) => document.getElementById(id) as HTMLElement;

async function chooseOption(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Option' }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function pickFromList(
  user: ReturnType<typeof userEvent.setup>,
  button: string,
  title: string,
  rowText: string,
) {
  await user.click(el(button));
  const dialog = await screen.findByRole('dialog', { name: title });
  const row = within(dialog).getByText(rowText).closest('[role="row"]') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Select' }));
}

describe('DcPage', () => {
  it('shows the legacy fields in order with their ids and defaults', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'DC Master Details' })).toBeInTheDocument();
    const ordered = [
      screen.getByRole('combobox', { name: 'Option' }),
      field('DC'),
      field('Country Code'),
      field('Country Name'),
      save(),
      screen.getByRole('button', { name: 'New' }),
      screen.getByRole('button', { name: 'Close' }),
    ];
    ordered.slice(1).forEach((node, i) => {
      expect(
        ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(field('DC')).toHaveAttribute('id', 'WhDes');
    expect(field('Country Code')).toHaveAttribute('id', 'CountryCode');
    expect(field('Country Name')).toHaveAttribute('id', 'CountryName');
    expect(el('btnDc')).toBeInTheDocument();
    expect(el('btnCountryCode')).toBeInTheDocument();
    expect(calls).toHaveLength(0);
  });

  it('asks for the DC name only, with the legacy message', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(save());

    expect(await screen.findByText('Enter DC Name')).toBeInTheDocument();
    expect(save()).toBeEnabled();
    expect(calls).toHaveLength(0);
  });

  it('saves a new DC with POST and keeps Save disabled until New', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('DC'), 'ZZT1 DC');
    await user.tab();
    await pickFromList(user, 'btnCountryCode', 'Countries Listing', 'INDIA');
    await waitFor(() => expect(field('Country Name')).toHaveValue('INDIA'));
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe(BASE);
    expect(post?.body).toEqual({ whDes: 'ZZT1 DC', countryCode: 'IND' });
    expect(calls.findIndex((c) => c.url === `${BASE}/ZZT1%20DC`)).toBeLessThan(
      calls.findIndex((c) => c.method === 'POST'),
    );
    expect(save()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(save()).toBeEnabled();
    expect(field('DC')).toHaveValue('');
  });

  it('can save a DC without a country, like the legacy page', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('DC'), 'ZZT2 DC');
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      whDes: 'ZZT2 DC',
      countryCode: '',
    });
  });

  it('refuses a DC that already exists in New mode without posting', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('DC'), 'Kohls Online');
    await user.click(save());

    expect(await screen.findByText('DC Already Exist')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(save()).toBeEnabled();
  });

  it('in Change mode loads the picked DC with its country name and saves with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    expect(field('DC')).toHaveAttribute('readonly');
    await pickFromList(user, 'btnDc', 'DC Listing', 'Kohls Online');

    await waitFor(() => expect(field('Country Name')).toHaveValue('United States of America'));
    expect(field('DC')).toHaveValue('Kohls Online');
    expect(field('Country Code')).toHaveValue('US');

    await pickFromList(user, 'btnCountryCode', 'Countries Listing', 'INDIA');
    await waitFor(() => expect(field('Country Code')).toHaveValue('IND'));
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${BASE}/Kohls%20Online`);
    expect(put?.body).toEqual({ countryCode: 'IND' });
  });

  it('shows every DestWarehouse column in the DC Listing dialog', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(el('btnDc'));
    const dialog = await screen.findByRole('dialog', { name: 'DC Listing' });

    for (const header of [
      'WhCode',
      'WhDes',
      'WhDesMain',
      'LoadingOrder',
      'StockUpdate',
      'LpnLblType',
    ]) {
      expect(within(dialog).getAllByText(header).length).toBeGreaterThan(0);
    }
    expect(within(dialog).getByText('Orphan DC')).toBeInTheDocument();
  });

  it('in View mode locks the fields and disables Save; New unlocks them', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'View');
    await pickFromList(user, 'btnDc', 'DC Listing', 'Re-Export');

    await waitFor(() => expect(field('Country Code')).toHaveValue('Dubai'));
    await waitFor(() => expect(field('Country Name')).toHaveAttribute('readonly'));
    expect(save()).toBeDisabled();
    expect(el('btnDc')).toBeDisabled();

    await chooseOption(user, 'New');
    expect(field('Country Name')).not.toHaveAttribute('readonly');
    expect(el('btnDc')).toBeEnabled();
    expect(save()).toBeEnabled();
  });
});
