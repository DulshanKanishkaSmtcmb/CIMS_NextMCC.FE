import { screen, waitFor, waitForElementToBeRemoved, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { configure, resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import type { PendingArrivals } from '../../services/arrivalsApi';
import { ConfirmArrivalPage } from './ConfirmArrivalPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 30_000 });

const PENDING: PendingArrivals = {
  contracts: [
    {
      rcvNo: '2026/00001',
      arrivalDate: null,
      contractNo: 'C100-01',
      itemNo: 'I1',
      shipperCode: 'S1',
      shipperName: 'Supplier One',
      cargoType: 'Box',
      warehouse: 'JO JO WEB',
      ctns: 5,
      pcs: 95,
      grossWgt: 10.255,
      cbm: 0.235,
      inboundVesselOrderNo: 0,
      inboundBookingDate: '2026-10-01T00:00:00',
      confirmArriveStatus: '',
      inboundEtd: null,
      inboundContainerOrderNo: 0,
      country: 'IND',
    },
    {
      rcvNo: '2026/00002',
      arrivalDate: '2026-10-10T08:05:00',
      contractNo: 'C200-02',
      itemNo: 'I2',
      shipperCode: 'S2',
      shipperName: 'Supplier Two',
      cargoType: 'Hanging',
      warehouse: 'Nordstrom Online',
      ctns: 3,
      pcs: 30,
      grossWgt: 1,
      cbm: 0.1,
      inboundVesselOrderNo: 1,
      inboundBookingDate: null,
      confirmArriveStatus: '',
      inboundEtd: '2026-10-17T00:00:00',
      inboundContainerOrderNo: 1,
      country: 'PAK',
    },
  ],
  suppliers: [{ shipperCode: 'S1', shipperName: 'Supplier One' }],
  containers: [
    {
      inboundEtd: '2026-10-17T00:00:00',
      inboundVesselOrderNo: 1,
      inboundContainerOrderNo: 1,
      vesselName: 'MSC ANNA',
      loadReference: 'LR-77',
      containerNo: 'MSCU1234567',
      containerType: '40HC',
    },
    {
      inboundEtd: '2026-10-17T00:00:00',
      inboundVesselOrderNo: 1,
      inboundContainerOrderNo: 2,
      vesselName: 'MSC ANNA',
      loadReference: 'LR-78',
      containerNo: 'TGHU7654321',
      containerType: '20GP',
    },
  ],
};

interface Call {
  method: string;
  url: string;
  params?: Record<string, string>;
  body?: unknown;
}

type Reply = { status: number; data: unknown } | 'network-error';

let calls: Call[] = [];
let pendingResponse: () => Reply;
let confirmResponse: () => Reply;

function respond(config: InternalAxiosRequestConfig, reply: Reply) {
  if (reply === 'network-error') {
    return Promise.reject(new AxiosError('Network Error', 'ERR_NETWORK', config));
  }
  const response = {
    data: reply.data,
    status: reply.status,
    statusText: String(reply.status),
    headers: new AxiosHeaders(),
    config,
  };
  if (reply.status >= 400) {
    return Promise.reject(new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response));
  }
  return Promise.resolve(response);
}

beforeEach(() => {
  calls = [];
  pendingResponse = () => ({ status: 200, data: PENDING });
  confirmResponse = () => ({
    status: 200,
    data: {
      contractsConfirmed: 1,
      importVesselUpdated: true,
      importContainerUpdated: true,
      message: 'Data Saved Successfully',
    },
  });
  configure({
    baseURL: 'http://api.test',
    axiosConfig: {
      adapter: async (config) => {
        const url = config.url ?? '';
        calls.push({
          method: (config.method ?? 'get').toUpperCase(),
          url,
          params: config.params as Record<string, string> | undefined,
          body: typeof config.data === 'string' ? JSON.parse(config.data) : config.data,
        });
        if (url.endsWith('/confirm/dcs')) {
          return respond(config, {
            status: 200,
            data: [{ whDes: 'JO JO WEB' }, { whDes: 'Nordstrom Online' }],
          });
        }
        if (url.endsWith('/confirm/countries')) {
          return respond(config, {
            status: 200,
            data: [
              { countryCode: 'IND', countryName: 'INDIA' },
              { countryCode: 'PAK', countryName: 'PAKISTAN' },
            ],
          });
        }
        if (url.endsWith('/confirm/pending')) return respond(config, pendingResponse());
        if (url.endsWith('/arrivals/confirm')) return respond(config, confirmResponse());
        return respond(config, { status: 404, data: {} });
      },
    },
  });
});

afterEach(() => {
  resetClient();
});

function renderPage() {
  return renderWithProviders(<ConfirmArrivalPage />, {
    preloadedState: signedInState,
    route: '/Data/ConfirmArrival',
  });
}

type User = ReturnType<typeof userEvent.setup>;

async function loadContracts(user: User) {
  await user.click(screen.getByTestId('load-contracts'));
  expect(await screen.findByTestId('load-summary')).toHaveTextContent(
    'Loaded 2 contracts · 1 supplier · 2 container lines',
  );
}

async function typeArrivalDate(user: User, digits: string) {
  await user.click(screen.getAllByRole('spinbutton', { name: 'Day' })[0]);
  await user.keyboard(digits);
}

const pendingList = () => screen.getByTestId('pending-list');
const selectedList = () => screen.getByTestId('selected-list');
const scanField = () => screen.getByRole('textbox', { name: 'Scan a container or supplier' });

describe('ConfirmArrivalPage', () => {
  it('shows the three steps, the defaults and the action bar before anything is loaded', () => {
    renderPage();

    expect(screen.getByRole('heading', { level: 1, name: 'Confirm arrivals' })).toBeInTheDocument();
    for (const step of [
      /^Step 1:\s*Find pending contracts$/,
      /^Step 2:\s*Pick containers or suppliers$/,
      /^Step 3:\s*Choose the contracts for this arrival$/,
    ]) {
      expect(screen.getByRole('region', { name: step })).toBeInTheDocument();
    }
    expect(screen.getByRole('button', { name: 'Local', pressed: true })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'DC' })).toHaveTextContent('All');
    expect(screen.getByRole('combobox', { name: 'Country' })).toHaveTextContent('All');
    expect(screen.getByText('All countries')).toBeInTheDocument();
    expect(screen.getByTestId('start-empty')).toHaveTextContent('Load pending contracts to start');
    expect(screen.getByText('Nothing loaded yet')).toBeInTheDocument();

    const bar = screen.getByRole('region', { name: 'Confirm the arrival' });
    expect(within(bar).getByRole('group', { name: /Arrival date and time/ })).toBeInTheDocument();
    expect(within(bar).getByTestId('selected-summary')).toHaveTextContent('Contracts: 0');
    expect(within(bar).getByRole('button', { name: 'Confirm arrival' })).toBeEnabled();
    expect(within(bar).getByRole('button', { name: 'Start over' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Keyboard shortcuts' })).toHaveTextContent(
      'Confirm arrival',
    );
  });

  it('shows the country name under the country code', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/confirm/countries'))).toBe(true));
    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(await screen.findByRole('option', { name: 'PAK' }));

    expect(screen.getByText('PAKISTAN')).toBeInTheDocument();
  });

  it('loads with the chosen filters, lists the lines unticked and moves the cursor to the scan field', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Import' }));
    await loadContracts(user);

    const pending = calls.find((c) => c.url.endsWith('/confirm/pending'));
    expect(pending?.params).toEqual({ cargoFrom: 'Import', dc: 'All', country: 'All' });
    expect(screen.getByTestId('load-summary')).toHaveTextContent(
      'for Import, all DCs, all countries',
    );
    expect(screen.getByRole('checkbox', { name: 'Supplier S1' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Container MSCU1234567' })).not.toBeChecked();
    // Each line says how many contracts it brings in.
    expect(
      within(screen.getByTestId('container-list')).getByText('1 contract'),
    ).toBeInTheDocument();
    expect(scanField()).toHaveFocus();
    expect(
      within(pendingList()).getByText('Tick a container or supplier to list its contracts here'),
    ).toBeInTheDocument();
  });

  it('warns when the filters change after a load', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);

    await user.click(screen.getByRole('button', { name: 'Import' }));

    expect(screen.getByTestId('filters-changed')).toHaveTextContent(
      'The lists still show Local, all DCs, all countries',
    );
  });

  it('moves rows between Pending and Selected and keeps the totals', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);

    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    expect(within(pendingList()).getByText('2026/00001')).toBeInTheDocument();
    expect(screen.getByTestId('pending-totals')).toHaveTextContent('Contracts: 1');
    expect(screen.getByTestId('pending-totals')).toHaveTextContent('Gross weight: 10.26');

    await user.click(screen.getByRole('checkbox', { name: 'Container MSCU1234567' }));
    expect(screen.getByTestId('pending-totals')).toHaveTextContent('Contracts: 2');
    expect(screen.getByTestId('pending-totals')).toHaveTextContent('CBM: 0.335');

    await user.click(screen.getByRole('button', { name: 'Add 2026/00001' }));
    expect(within(selectedList()).getByText('2026/00001')).toBeInTheDocument();
    expect(screen.getByTestId('selected-totals')).toHaveTextContent('Contracts: 1');
    expect(screen.getByTestId('selected-summary')).toHaveTextContent('Contracts: 1');

    await user.click(screen.getByRole('button', { name: 'Add all to selection' }));
    expect(screen.getByTestId('pending-totals')).toHaveTextContent('Contracts: 0');
    expect(screen.getByTestId('selected-totals')).toHaveTextContent('Contracts: 2');

    await user.click(screen.getByRole('button', { name: 'Remove 2026/00002' }));
    expect(within(pendingList()).getByText('2026/00002')).toBeInTheDocument();

    // Unticking the supplier takes its rows out of both lists.
    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    expect(within(selectedList()).queryByText('2026/00001')).not.toBeInTheDocument();
  });

  it('picks a line from the scan field, and says why when nothing matches', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(scanField(), 'MSCU1234567{Enter}');
    expect(screen.getByTestId('pick-result')).toHaveTextContent('Load contracts first');

    await loadContracts(user);
    await user.type(scanField(), 'mscu1234567{Enter}');
    expect(screen.getByRole('checkbox', { name: 'Container MSCU1234567' })).toBeChecked();
    expect(screen.getByTestId('pick-result')).toHaveTextContent(
      'Picked container MSCU1234567: 1 contract listed under Pending.',
    );
    expect(within(pendingList()).getByText('2026/00002')).toBeInTheDocument();

    // Scanning it again does not untick it.
    await user.type(scanField(), 'MSCU1234567{Enter}');
    expect(screen.getByRole('checkbox', { name: 'Container MSCU1234567' })).toBeChecked();
    expect(screen.getByTestId('pick-result')).toHaveTextContent('already picked');

    await user.type(scanField(), 's1{Enter}');
    expect(screen.getByRole('checkbox', { name: 'Supplier S1' })).toBeChecked();

    await user.type(scanField(), 'XYZ{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No pending container or supplier matches “XYZ”',
    );
  });

  it('tells which container is updated when more than one is ticked, and sends that one', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);

    await user.click(screen.getByRole('checkbox', { name: 'Container TGHU7654321' }));
    await user.click(screen.getByRole('checkbox', { name: 'Container MSCU1234567' }));
    expect(screen.getByTestId('first-container-hint')).toHaveTextContent(
      'Only the first ticked container (MSCU1234567) is updated',
    );
    const lines = within(screen.getByTestId('container-list'));
    expect(lines.getAllByText('Updated on confirm')).toHaveLength(1);
    expect(
      lines.getByText('Not saved: only the first ticked container is updated.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Add all to selection' }));
    await typeArrivalDate(user, '181020261430');
    await user.click(screen.getByRole('button', { name: 'Confirm arrival' }));

    await screen.findByTestId('save-result');
    const post = calls.find((c) => c.method === 'POST');
    expect((post?.body as { container: { containerNo: string } }).container.containerNo).toBe(
      'MSCU1234567',
    );
  });

  it('asks for the arrival date first, then for a selection, and sends nothing', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);

    await user.click(screen.getByRole('button', { name: 'Confirm arrival' }));
    expect(await screen.findByText('Enter the arrival date and time')).toBeInTheDocument();
    expect(screen.queryByTestId('selection-error')).not.toBeInTheDocument();
    // The cursor goes to the field that needs attention.
    expect(screen.getAllByRole('spinbutton', { name: 'Day' })[0]).toHaveFocus();

    await typeArrivalDate(user, '181020261430');
    expect(screen.queryByText('Enter the arrival date and time')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm arrival' }));
    expect(await screen.findByTestId('selection-error')).toHaveTextContent(
      'Add at least one contract to the selection before confirming',
    );
    expect(calls.some((c) => c.method === 'POST')).toBe(false);

    // The error goes away as soon as something is selected.
    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    await user.click(screen.getByRole('button', { name: 'Add 2026/00001' }));
    expect(screen.queryByTestId('selection-error')).not.toBeInTheDocument();
  });

  it('confirms with the same request as before and keeps the lists afterwards', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);

    await user.click(screen.getByRole('checkbox', { name: 'Container MSCU1234567' }));
    await user.click(screen.getByRole('button', { name: 'Add all to selection' }));
    await typeArrivalDate(user, '181020261430');
    await user.click(screen.getByRole('button', { name: 'Confirm arrival' }));

    expect(await screen.findByTestId('save-result')).toHaveTextContent(
      'Arrival confirmed for 1 contract (18/10/2026 14:30).',
    );
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe('/api/v1/arrivals/confirm');
    expect(post?.body).toEqual({
      arrivalDate: '2026-10-18T14:30:00',
      rcvNos: ['2026/00002'],
      container: {
        inboundEtd: '2026-10-17T00:00:00',
        vesselOrderNo: 1,
        vesselName: 'MSC ANNA',
        containerOrderNo: 1,
        loadReference: 'LR-77',
        containerNo: 'MSCU1234567',
        containerType: '40HC',
      },
    });
    // The lists stay on screen after the save, as on the legacy page.
    expect(within(selectedList()).getByText('2026/00002')).toBeInTheDocument();
  });

  it('sends the edited container no of the first ticked container', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);

    await user.click(screen.getByRole('checkbox', { name: 'Container MSCU1234567' }));
    const field = screen.getByRole('textbox', { name: 'Container no' });
    await user.clear(field);
    await user.type(field, 'MSCU7777777');
    await user.click(screen.getByRole('button', { name: 'Add all to selection' }));
    await typeArrivalDate(user, '181020261430');
    await user.click(screen.getByRole('button', { name: 'Confirm arrival' }));

    await screen.findByTestId('save-result');
    const post = calls.find((c) => c.method === 'POST');
    expect((post?.body as { container: { containerNo: string } }).container.containerNo).toBe(
      'MSCU7777777',
    );
  });

  it('shows the server message under "Data not saved"', async () => {
    confirmResponse = () => ({
      status: 400,
      data: {
        title: 'One or more validation errors occurred.',
        code: 'VALIDATION_FAILED',
        errors: { RcvNos: ['Contract Data not found.[Empty List]'] },
      },
    });
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);
    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    await user.click(screen.getByRole('button', { name: 'Add all to selection' }));
    await typeArrivalDate(user, '181020261430');

    await user.click(screen.getByRole('button', { name: 'Confirm arrival' }));

    const alert = await screen.findByTestId('save-result');
    expect(alert).toHaveAttribute('role', 'alert');
    expect(alert).toHaveTextContent('Data not saved');
    expect(alert).toHaveTextContent('Nothing was changed.');
    expect(alert).toHaveTextContent('Contract Data not found.[Empty List]');
  });

  it('offers a retry when the server cannot be reached', async () => {
    confirmResponse = () => 'network-error';
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);
    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    await user.click(screen.getByRole('button', { name: 'Add all to selection' }));
    await typeArrivalDate(user, '181020261430');
    await user.click(screen.getByRole('button', { name: 'Confirm arrival' }));

    const alert = await screen.findByTestId('save-result');
    expect(alert).toHaveTextContent('The server could not be reached');
    confirmResponse = () => ({
      status: 200,
      data: {
        contractsConfirmed: 1,
        importVesselUpdated: false,
        importContainerUpdated: false,
        message: '',
      },
    });
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText(/Arrival confirmed for 1 contract/)).toBeInTheDocument();
    expect(calls.filter((c) => c.method === 'POST')).toHaveLength(2);
  });

  it('reports a failed load with a retry', async () => {
    pendingResponse = () => ({ status: 500, data: { title: 'An unexpected error occurred.' } });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByTestId('load-contracts'));

    const alert = await screen.findByTestId('load-error');
    expect(alert).toHaveTextContent('Contracts could not be loaded');
    pendingResponse = () => ({ status: 200, data: PENDING });
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByTestId('load-summary')).toBeInTheDocument();
  });

  it('Start over asks first, then clears the date and the lists but keeps the filters', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('button', { name: 'Import' }));
    await loadContracts(user);
    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    await typeArrivalDate(user, '181020261430');

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    const dialog = await screen.findByRole('dialog', { name: 'Start over?' });
    expect(within(dialog).getByRole('button', { name: 'Keep working' })).toHaveFocus();
    await user.click(within(dialog).getByRole('button', { name: 'Start over' }));
    await waitForElementToBeRemoved(dialog);

    await waitFor(() => expect(screen.getByTestId('start-empty')).toBeInTheDocument());
    expect(screen.queryByTestId('supplier-list')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Import', pressed: true })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Confirm arrival' }));
    expect(await screen.findByText('Enter the arrival date and time')).toBeInTheDocument();
  });

  it('runs the main steps from the keyboard', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.keyboard('{Alt>}l{/Alt}');
    expect(await screen.findByTestId('load-summary')).toBeInTheDocument();
    await user.type(scanField(), 'S1{Enter}');
    await user.keyboard('{Alt>}a{/Alt}');
    expect(screen.getByTestId('selected-totals')).toHaveTextContent('Contracts: 1');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(await screen.findByText('Enter the arrival date and time')).toBeInTheDocument();
  });

  it('asks before leaving with an unconfirmed selection', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);
    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    await user.click(screen.getByRole('button', { name: 'Add all to selection' }));

    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(
      await screen.findByRole('dialog', { name: 'Leave without confirming?' }),
    ).toHaveTextContent('1 selected contract has not been confirmed.');
  });
});
