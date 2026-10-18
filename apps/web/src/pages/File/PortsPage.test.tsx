import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { Country, Port } from '../../services/masterDataApi';
import { PortsPage } from './PortsPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 30_000 });

const port = (code: string, name: string, countryCode: string, isDivertable = false): Port => ({
  portCode: code,
  portName: name,
  countryCode,
  dateCreate: '2026-08-21T09:36:39.383',
  createBy: 'u1',
  dateUpdate: null,
  updateBy: '',
  seaOrAirPort: '',
  isDivertable,
});
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

const PORTS = [
  port('DAC', 'DHAKA', ''),
  port('DEL', 'DELHI', 'IND'),
  port('GBLGP', 'London Gateway', 'UK', true),
];
const COUNTRIES = [country('IND', 'INDIA'), country('UK', 'United Kingdom')];
const BASE = '/api/v1/master-data/ports';
const COUNTRIES_URL = '/api/v1/master-data/countries';

let calls: MockCall[] = [];
let saveReply: MockHandler = () => ({
  status: 200,
  data: { portCode: 'ZZT1', message: 'Data Saved Successfully' },
});

function setup() {
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: PORTS };
    if (call.method === 'GET' && call.url === `${BASE}/search`) {
      const name = String(call.params?.name ?? '').toLowerCase();
      return {
        status: 200,
        data: PORTS.filter((p) => p.portName.toLowerCase().startsWith(name)).map((p) => ({
          portCode: p.portCode,
          portName: p.portName,
          countryCode: p.countryCode,
        })),
      };
    }
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/`)) {
      const code = decodeURIComponent(call.url.slice(BASE.length + 1));
      const row = PORTS.find((p) => p.portCode.toLowerCase() === code.toLowerCase());
      return row ? { status: 200, data: row } : { status: 404, data: { code: 'PORT_NOT_FOUND' } };
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
  return renderWithProviders(<PortsPage />, {
    preloadedState: signedInState,
    route: '/File/Ports',
  });
}

afterEach(() => {
  resetClient();
  saveReply = () => ({
    status: 200,
    data: { portCode: 'ZZT1', message: 'Data Saved Successfully' },
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

describe('PortsPage', () => {
  it('shows the legacy fields in order with their ids and defaults', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Ports Master Details' })).toBeInTheDocument();
    const ordered = [
      screen.getByRole('combobox', { name: 'Option' }),
      field('Port Code'),
      field('Port Name'),
      screen.getByRole('checkbox', { name: 'Is Divertable' }),
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
    expect(field('Port Code')).toHaveAttribute('id', 'PortCode');
    expect(field('Port Name')).toHaveAttribute('id', 'PortName');
    expect(screen.getByRole('checkbox', { name: 'Is Divertable' })).toHaveAttribute(
      'id',
      'IsDivertable',
    );
    expect(field('Country Code')).toHaveAttribute('id', 'CountryCode');
    expect(field('Country Name')).toHaveAttribute('id', 'CountryName');
    expect(el('btnPortCode')).toBeInTheDocument();
    expect(el('btnCountryCode')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Is Divertable' })).not.toBeChecked();
    expect(calls).toHaveLength(0);
  });

  it('asks for the name before the code, with the legacy messages', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(save());
    expect(await screen.findByText('Enter Port Name')).toBeInTheDocument();
    await user.type(field('Port Name'), 'Zed');
    await user.click(save());
    expect(await screen.findByText('Enter Port Code')).toBeInTheDocument();
    expect(calls.filter((c) => !c.url.endsWith('/search'))).toHaveLength(0);
  });

  it('saves a new port with POST, picking the country from the list, and keeps Save disabled until New', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Port Code'), 'ZZT1');
    await user.tab();
    await user.type(field('Port Name'), 'Zed Port');
    await user.click(screen.getByRole('checkbox', { name: 'Is Divertable' }));
    await pickFromList(user, 'btnCountryCode', 'Countries Listing', 'INDIA');
    await waitFor(() => expect(field('Country Name')).toHaveValue('INDIA'));
    expect(field('Country Code')).toHaveValue('IND');
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe(BASE);
    expect(post?.body).toEqual({
      portCode: 'ZZT1',
      portName: 'Zed Port',
      countryCode: 'IND',
      isDivertable: true,
    });
    expect(save()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(save()).toBeEnabled();
    expect(field('Port Code')).toHaveValue('');
    expect(field('Country Name')).toHaveValue('');
    // the legacy page forgot to reset this one
    expect(screen.getByRole('checkbox', { name: 'Is Divertable' })).not.toBeChecked();
  });

  it('refuses a port code that already exists in New mode without posting', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Port Code'), 'DEL');
    await user.type(field('Port Name'), 'Delhi again');
    await user.click(save());

    expect(await screen.findByText('Port Code Already Exist')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(save()).toBeEnabled();
  });

  it('in Change mode loads the picked port with its country name and saves with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    expect(field('Port Code')).toHaveAttribute('readonly');
    await pickFromList(user, 'btnPortCode', 'Ports Listing', 'London Gateway');

    await waitFor(() => expect(field('Country Name')).toHaveValue('United Kingdom'));
    expect(field('Port Code')).toHaveValue('GBLGP');
    expect(field('Port Name')).toHaveValue('London Gateway');
    expect(field('Country Code')).toHaveValue('UK');
    expect(screen.getByRole('checkbox', { name: 'Is Divertable' })).toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'Is Divertable' }));
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${BASE}/GBLGP`);
    expect(put?.body).toEqual({
      portName: 'London Gateway',
      countryCode: 'UK',
      isDivertable: false,
    });
  });

  it('clears the country name when the loaded port has no country', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    await pickFromList(user, 'btnPortCode', 'Ports Listing', 'DELHI');
    await waitFor(() => expect(field('Country Name')).toHaveValue('INDIA'));
    await pickFromList(user, 'btnPortCode', 'Ports Listing', 'DHAKA');

    await waitFor(() => expect(field('Port Name')).toHaveValue('DHAKA'));
    await waitFor(() => expect(field('Country Name')).toHaveValue(''));
    expect(field('Country Code')).toHaveValue('');
  });

  it('in View mode locks the fields and the Is Divertable box and disables Save; New unlocks them', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'View');
    expect(save()).toBeDisabled();
    await pickFromList(user, 'btnPortCode', 'Ports Listing', 'DELHI');

    await waitFor(() => expect(field('Port Name')).toHaveValue('DELHI'));
    await waitFor(() => expect(field('Port Name')).toHaveAttribute('readonly'));
    expect(screen.getByRole('checkbox', { name: 'Is Divertable' })).toBeDisabled();
    expect(el('btnPortCode')).toBeDisabled();

    await chooseOption(user, 'New');
    expect(field('Port Name')).not.toHaveAttribute('readonly');
    expect(el('btnPortCode')).toBeEnabled();
    expect(screen.getByRole('checkbox', { name: 'Is Divertable' })).toBeEnabled();
  });

  it('shows the Pre-Entered Ports Listing box while a new name is typed', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Port Name'), 'D');
    expect(await screen.findByText('Pre-Entered Ports Listing')).toBeInTheDocument();
    const table = el('tblPdata');
    expect(within(table).getByText('DHAKA')).toBeInTheDocument();
    expect(within(table).getByText('DELHI')).toBeInTheDocument();

    await user.type(field('Port Name'), 'EL');
    expect(within(table).queryByText('DHAKA')).not.toBeInTheDocument();
    expect(within(table).getByText('DELHI')).toBeInTheDocument();
  });
});
