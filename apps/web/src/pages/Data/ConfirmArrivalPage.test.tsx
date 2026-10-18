import { screen, waitFor, within } from '@testing-library/react';
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
  ],
};

interface Call {
  method: string;
  url: string;
  params?: Record<string, string>;
  body?: unknown;
}

let calls: Call[] = [];
let pendingResponse: () => { status: number; data: unknown } = () => ({
  status: 200,
  data: PENDING,
});
let confirmResponse: () => { status: number; data: unknown } = () => ({
  status: 200,
  data: {
    contractsConfirmed: 1,
    importVesselUpdated: false,
    importContainerUpdated: false,
    message: 'Data Saved Successfully',
  },
});

function respond(config: InternalAxiosRequestConfig, status: number, data: unknown) {
  const response = {
    data,
    status,
    statusText: String(status),
    headers: new AxiosHeaders(),
    config,
  };
  if (status >= 400) {
    return Promise.reject(new AxiosError('failed', 'ERR_BAD_REQUEST', config, null, response));
  }
  return Promise.resolve(response);
}

beforeEach(() => {
  calls = [];
  pendingResponse = () => ({ status: 200, data: PENDING });
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
        if (url.endsWith('/confirm/dcs'))
          return respond(config, 200, [{ whDes: 'JO JO WEB' }, { whDes: 'Nordstrom Online' }]);
        if (url.endsWith('/confirm/countries')) {
          return respond(config, 200, [
            { countryCode: 'IND', countryName: 'INDIA' },
            { countryCode: 'PAK', countryName: 'PAKISTAN' },
          ]);
        }
        if (url.endsWith('/confirm/pending')) {
          const r = pendingResponse();
          return respond(config, r.status, r.data);
        }
        if (url.endsWith('/arrivals/confirm')) {
          const r = confirmResponse();
          return respond(config, r.status, r.data);
        }
        return respond(config, 404, {});
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

async function loadContracts(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Load Contracts' }));
  expect(await screen.findByText('Contracts Loaded successfully')).toBeInTheDocument();
}

async function typeArrivalDate(user: ReturnType<typeof userEvent.setup>, digits: string) {
  await user.click(screen.getAllByRole('spinbutton', { name: 'Day' })[0]);
  await user.keyboard(digits);
}

const grid = (id: string) => document.getElementById(id) as HTMLElement;

describe('ConfirmArrivalPage', () => {
  it('shows the legacy fields in order with their defaults', async () => {
    renderPage();

    expect(
      screen.getByRole('heading', { name: 'Contract - Confirm Arrivals' }),
    ).toBeInTheDocument();
    const labels = ['Shipment', 'DC', 'Country'].map((name) =>
      screen.getByRole('combobox', { name }),
    );
    expect(labels[0]).toHaveTextContent('Local');
    expect(labels[1]).toHaveTextContent('All');
    expect(labels[2]).toHaveTextContent('All');
    // Shipment, then the Load Contracts button (id kept), then DC, then Country.
    const load = screen.getByRole('button', { name: 'Load Contracts' });
    expect(load).toHaveAttribute('id', 'btnLoadPOs');
    expect(labels[0].compareDocumentPosition(load) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(load.compareDocumentPosition(labels[1]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(
      screen.getByRole('group', { name: 'Arrival Date [dd/mm/yyyy hh:mm]' }),
    ).toBeInTheDocument();
    for (const name of ['Save', 'New', 'Close', 'Select All']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    // Supplier and container boxes stay hidden until a load returns rows.
    expect(
      screen.queryByText('Supplier List - Pending Arrival Confirmation'),
    ).not.toBeInTheDocument();
  });

  it('shows the country name for the selected code and nothing for All', async () => {
    const user = userEvent.setup();
    renderPage();

    await waitFor(() => expect(calls.some((c) => c.url.endsWith('/confirm/countries'))).toBe(true));
    await user.click(screen.getByRole('combobox', { name: 'Country' }));
    await user.click(await screen.findByRole('option', { name: 'PAK' }));

    expect(screen.getByRole('textbox', { name: 'Country name' })).toHaveValue('PAKISTAN');
  });

  it('loads contracts with the chosen filters and fills the supplier and container lists unticked', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('combobox', { name: 'Shipment' }));
    await user.click(screen.getByRole('option', { name: 'Import' }));
    await loadContracts(user);

    const pending = calls.find((c) => c.url.endsWith('/confirm/pending'));
    expect(pending?.params).toEqual({ cargoFrom: 'Import', dc: 'All', country: 'All' });
    expect(screen.getByText('Supplier List - Pending Arrival Confirmation')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Supplier S1' })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Container MSCU1234567' })).not.toBeChecked();
    expect(within(grid('tblPending')).getByText('No contracts')).toBeInTheDocument();
  });

  it('moves rows between Pending and Selected and keeps the totals', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);

    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    expect(within(grid('tblPending')).getByText('2026/00001')).toBeInTheDocument();
    expect(screen.getByTestId('pendingTotals')).toHaveTextContent('1 Contracts');
    expect(screen.getByTestId('pendingTotals')).toHaveTextContent('Gross Weight 10.26');

    await user.click(screen.getByRole('checkbox', { name: 'Container MSCU1234567' }));
    expect(screen.getByTestId('pendingTotals')).toHaveTextContent('2 Contracts');
    expect(screen.getByTestId('pendingTotals')).toHaveTextContent('CBM 0.335');

    await user.click(within(grid('tblPending')).getAllByRole('button', { name: 'Add' })[0]);
    expect(within(grid('tblSelected')).getByText('2026/00001')).toBeInTheDocument();
    expect(screen.getByTestId('selectedTotals')).toHaveTextContent('1 Contracts');

    await user.click(screen.getByRole('button', { name: 'Select All' }));
    expect(screen.getByTestId('pendingTotals')).toHaveTextContent('0 Contracts');
    expect(screen.getByTestId('selectedTotals')).toHaveTextContent('2 Contracts');

    await user.click(within(grid('tblSelected')).getAllByRole('button', { name: 'Remove' })[1]);
    expect(within(grid('tblPending')).getByText('2026/00002')).toBeInTheDocument();

    // Unticking the supplier takes its rows out of both lists.
    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    expect(within(grid('tblSelected')).queryByText('2026/00001')).not.toBeInTheDocument();
  });

  it('asks for the arrival date first, then for a selection, with the legacy messages', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter Confirm Arrival Date')).toBeInTheDocument();

    await typeArrivalDate(user, '181020261430');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Any Contracts not Selected to Save.')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('saves the selected contracts with a local ISO date and the first ticked container', async () => {
    const user = userEvent.setup();
    renderPage();
    await loadContracts(user);

    await user.click(screen.getByRole('checkbox', { name: 'Container MSCU1234567' }));
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    await typeArrivalDate(user, '181020261430');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
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
    expect(within(grid('tblSelected')).getByText('2026/00002')).toBeInTheDocument();
  });

  it('shows the server message in the legacy "Data not Saved" toast', async () => {
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
    await user.click(screen.getByRole('button', { name: 'Select All' }));
    await typeArrivalDate(user, '181020261430');

    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Data not Saved [Contract Data not found.[Empty List]]'),
    ).toBeInTheDocument();
  });

  it('reports a failed load with the legacy message', async () => {
    pendingResponse = () => ({ status: 500, data: { title: 'An unexpected error occurred.' } });
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: 'Load Contracts' }));

    expect(
      await screen.findByText('Something went wrong.Please contact administrator'),
    ).toBeInTheDocument();
  });

  it('New clears the date and the lists but keeps the filters', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole('combobox', { name: 'Shipment' }));
    await user.click(screen.getByRole('option', { name: 'Import' }));
    await loadContracts(user);
    await user.click(screen.getByRole('checkbox', { name: 'Supplier S1' }));
    await typeArrivalDate(user, '181020261430');

    await user.click(screen.getByRole('button', { name: 'New' }));

    expect(
      screen.queryByText('Supplier List - Pending Arrival Confirmation'),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('pendingTotals')).toHaveTextContent('0 Contracts');
    expect(screen.getByRole('combobox', { name: 'Shipment' })).toHaveTextContent('Import');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Enter Confirm Arrival Date')).toBeInTheDocument();
  });
});
