import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import { mockViewportWidth } from '../../test/matchMedia';
import type { Country, Port } from '../../services/masterDataApi';
import { PortsPage } from './PortsPage';

// DataGrid interactions (the country lookup dialog) are slow in jsdom.
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
let restoreViewport: () => void = () => undefined;

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

beforeEach(() => {
  restoreViewport = mockViewportWidth(1440);
});

afterEach(() => {
  restoreViewport();
  resetClient();
  saveReply = () => ({
    status: 200,
    data: { portCode: 'ZZT1', message: 'Data Saved Successfully' },
  });
});

const field = (label: RegExp) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const findList = () => screen.findByRole('list', { name: 'Ports' });
const writes = () => calls.filter((c) => c.method === 'POST' || c.method === 'PUT');

async function startNew(user: ReturnType<typeof userEvent.setup>) {
  await within(await findList()).findByRole('button', { name: /DELHI/ });
  await user.click(screen.getAllByRole('button', { name: 'New port' })[0]);
  return screen.findByRole('region', { name: 'New port' });
}

async function openPort(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await within(await findList()).findByRole('button', { name: new RegExp(name) }));
  await waitFor(() => expect(field(/Port name/)).toHaveValue(name));
}

async function pickCountry(user: ReturnType<typeof userEvent.setup>, rowText: string) {
  await user.click(screen.getByRole('button', { name: 'Search countries' }));
  const dialog = await screen.findByRole('dialog', { name: 'Countries' });
  const row = within(dialog).getByText(rowText).closest('[role="row"]') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Select' }));
}

describe('PortsPage', () => {
  it('lists the ports (country, divertable) next to an empty detail', async () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Ports' })).toBeInTheDocument();
    const items = within(await findList()).getAllByRole('button');
    expect(items.map((i) => i.textContent)).toEqual([
      'DHAKADAC · No country',
      'DELHIDEL · IND',
      'London GatewayGBLGP · UKDivertable',
    ]);
    expect(screen.getByRole('heading', { name: 'Select a port' })).toBeInTheDocument();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`GET ${BASE}`]);
  });

  it('starts a new port with every field empty and Divertable off, the cursor in the code', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    const ordered = [
      field(/Port code/),
      field(/Port name/),
      field(/Country/),
      screen.getByRole('checkbox', { name: 'Divertable' }),
    ];
    ordered.slice(1).forEach((node, i) => {
      expect(
        ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    await waitFor(() => expect(field(/Port code/)).toHaveFocus());
    expect(screen.getByRole('checkbox', { name: 'Divertable' })).not.toBeChecked();
    expect(field(/Country/)).toHaveAccessibleDescription('Optional.');
  });

  it('asks for the name before the code and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.click(save());
    const summary = await screen.findByTestId('save-problems');
    expect(
      within(summary)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Enter the port name', 'Enter the port code']);
    await user.type(field(/Port name/), 'Zed');
    expect(within(screen.getByTestId('save-problems')).getAllByRole('listitem')).toHaveLength(1);
    expect(calls.filter((c) => c.url !== BASE && !c.url.endsWith('/search'))).toHaveLength(0);
  });

  it('saves a new port with POST, picking the country from the list, then shows it read-only', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Port code/), 'ZZT1');
    await user.tab();
    await user.type(field(/Port name/), 'Zed Port');
    await user.click(screen.getByRole('checkbox', { name: 'Divertable' }));
    await pickCountry(user, 'INDIA');
    await waitFor(() => expect(field(/Country/)).toHaveAccessibleDescription('INDIA'));
    expect(field(/Country/)).toHaveValue('IND');
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('Port ZZT1 created.');
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe(BASE);
    expect(post?.body).toEqual({
      portCode: 'ZZT1',
      portName: 'Zed Port',
      countryCode: 'IND',
      isDivertable: true,
    });
    expect(calls.findIndex((c) => c.url === `${BASE}/ZZT1`)).toBeLessThan(
      calls.findIndex((c) => c.method === 'POST'),
    );
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(field(/Divertable/)).toHaveValue('Yes');
    expect(field(/Country/)).toHaveAccessibleDescription('INDIA');

    // New starts again from the defaults (the legacy page kept Is Divertable: P1).
    await user.click(screen.getAllByRole('button', { name: 'New port' })[0]);
    expect(field(/Port code/)).toHaveValue('');
    expect(field(/Country/)).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: 'Divertable' })).not.toBeChecked();
  });

  it('refuses a port code that already exists in New mode without posting', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Port code/), 'DEL');
    await user.type(field(/Port name/), 'Delhi again');
    await user.click(save());

    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'Port code DEL already exists. Choose another code.',
    );
    expect(writes()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Discard and open DEL' })).toBeInTheDocument();
  });

  it('opens a port with its country name, edits it and saves with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await openPort(user, 'London Gateway');
    await waitFor(() => expect(field(/Country/)).toHaveAccessibleDescription('United Kingdom'));
    expect(field(/Port code/)).toHaveValue('GBLGP');
    expect(field(/Port name/)).toHaveAttribute('readonly');
    expect(field(/Divertable/)).toHaveValue('Yes');
    expect(screen.queryByRole('button', { name: 'Search countries' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(field(/Port code/)).toHaveAttribute('readonly');
    await user.click(screen.getByRole('checkbox', { name: 'Divertable' }));
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('Port GBLGP saved.');
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${BASE}/GBLGP`);
    expect(put?.body).toEqual({
      portName: 'London Gateway',
      countryCode: 'UK',
      isDivertable: false,
    });
  });

  it('shows no country name for a port without a country (legacy kept the previous one)', async () => {
    const user = userEvent.setup();
    setup();

    await openPort(user, 'DELHI');
    await waitFor(() => expect(field(/Country/)).toHaveAccessibleDescription('INDIA'));
    await openPort(user, 'DHAKA');
    expect(field(/Country/)).toHaveValue('');
    expect(field(/Country/)).toHaveAccessibleDescription('No country');
  });

  it('says when a typed country code does not exist and loads the name of one that does', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Country/), 'XX{Enter}');
    await waitFor(() =>
      expect(field(/Country/)).toHaveAccessibleDescription(
        'No country with code XX. Pick one with the search button.',
      ),
    );
    await user.clear(field(/Country/));
    await user.type(field(/Country/), 'UK');
    await user.tab();
    await waitFor(() => expect(field(/Country/)).toHaveAccessibleDescription('United Kingdom'));
  });

  it('cancelling an edit restores the port and its country', async () => {
    const user = userEvent.setup();
    setup();
    await openPort(user, 'DELHI');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await pickCountry(user, 'United Kingdom');
    await waitFor(() => expect(field(/Country/)).toHaveAccessibleDescription('United Kingdom'));

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(field(/Country/)).toHaveValue('IND'));
    expect(field(/Country/)).toHaveAccessibleDescription('INDIA');
    expect(writes()).toHaveLength(0);
  });

  it('shows similar names while a new name is typed', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Port name/), 'D');
    const hint = await screen.findByTestId('similar-names');
    expect(hint).toHaveTextContent('DHAKA');
    expect(hint).toHaveTextContent('DELHI');

    await user.type(field(/Port name/), 'EL');
    expect(screen.getByTestId('similar-names')).not.toHaveTextContent('DHAKA');
    expect(screen.getByTestId('similar-names')).toHaveTextContent('DELHI');
  });
});
