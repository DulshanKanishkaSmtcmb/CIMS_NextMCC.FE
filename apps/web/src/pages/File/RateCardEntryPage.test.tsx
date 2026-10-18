import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { CfsRate, RateCard } from '../../services/rateCardApi';
import { RateCardEntryPage } from './RateCardEntryPage';

vi.setConfig({ testTimeout: 60_000 }); // slower when the suites run in parallel

const cfs = (over: Partial<CfsRate>): CfsRate => ({
  chgCode: 'C0001',
  chgDescription: 'Carton Gum Tape',
  unitType: 'Cartons',
  range1: 0,
  range2: 0,
  unitCalType: 'Sum',
  rateInUsd: 0.25,
  isActive: true,
  fileCaption: 'ContractsInOut',
  materialCode: '',
  rateInUsdCost: 0,
  rateUpdateBy: '',
  rateUpdateDate: null,
  pmDescription: '',
  ...over,
});

const RATES: RateCard = {
  clearance: [
    { cntrType: '20GP', rateInUsd: 700 },
    { cntrType: 'Air', rateInUsd: 0 },
  ],
  freight: [
    { portCode: 'BOM', portName: 'Mumbai', cntrType: '20GP', rateInUsd: 0 },
    { portCode: 'WSP', portName: 'Westport', cntrType: '20GP', rateInUsd: 250 },
  ],
  cfs: [
    cfs({}),
    cfs({
      chgCode: 'P0003',
      chgDescription: 'Pick & Pack',
      unitType: 'PCS',
      unitCalType: null,
      rateInUsd: 0.47,
      fileCaption: 'Material Handling',
      materialCode: 'P0001',
      pmDescription: 'Poly Bag',
    }),
  ],
};

const BASE = '/api/v1/master-data/rate-cards';
let calls: MockCall[] = [];
let rateReply: MockHandler = () => ({ status: 200, data: RATES });

function setup() {
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === BASE) return rateReply(call);
    return undefined;
  });
  return renderWithProviders(<RateCardEntryPage />, {
    preloadedState: signedInState,
    route: '/File/RateCardEntry',
  });
}

afterEach(() => {
  resetClient();
  rateReply = () => ({ status: 200, data: RATES });
});

const clearanceTable = () => screen.getByRole('table', { name: 'Export clearance charges' });
const freightGrid = () => screen.getByTestId('freight-grid');
const cfsGrid = () => screen.getByTestId('cfs-grid');
const rateCalls = () => calls.filter((c) => c.url === BASE);
/** The grid's data rows (role row with a data-id). */
const gridRows = (grid: HTMLElement) =>
  Array.from(grid.querySelectorAll<HTMLElement>('[role="row"][data-id]'));

describe('RateCardEntryPage', () => {
  it('reads the rates when it opens and shows the three sections, read-only', async () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Rate card' })).toBeInTheDocument();
    expect(screen.getByText('Read only')).toBeInTheDocument();
    expect(screen.getByTestId('read-only-hint')).toHaveTextContent(
      'This page has never saved changes',
    );
    await screen.findByRole('table', { name: 'Export clearance charges' });
    expect(rateCalls()).toHaveLength(1);
    for (const title of ['Export clearance charges', 'Export freight charges', 'CFS charges']) {
      expect(screen.getByRole('heading', { level: 2, name: title })).toBeInTheDocument();
    }
    // nothing to type into: the page never saved
    expect(within(screen.getByTestId('rate-card-page')).queryAllByRole('spinbutton')).toHaveLength(
      0,
    );
    expect(screen.queryByRole('button', { name: /Save/ })).toBeNull();
  });

  it('shows the stored rates with two decimals and a missing rate as 0.00', async () => {
    setup();
    await screen.findByRole('table', { name: 'Export clearance charges' });

    const clearance = within(clearanceTable()).getAllByRole('row').slice(1);
    expect(clearance.map((r) => r.textContent)).toEqual(['20GP700.00', 'Air0.00']);
    const freight = gridRows(freightGrid());
    expect(freight.map((r) => r.textContent)).toEqual([
      'BOMMumbai20GP0.00',
      'WSPWestport20GP250.00',
    ]);
    expect(within(freightGrid()).getByText('Container type')).toBeInTheDocument();
  });

  it('shows each CFS charge with its calculation, range only for a range, material and active flag', async () => {
    setup();
    await screen.findByTestId('cfs-grid');

    const [tape, pick] = gridRows(cfsGrid());
    expect(within(tape).getByText('Carton Gum Tape')).toBeInTheDocument();
    expect(within(tape).getByText('0.25')).toBeInTheDocument();
    expect(within(tape).getByText('Sum')).toBeInTheDocument();
    expect(within(tape).getAllByText('—').length).toBeGreaterThan(0); // no range, no material
    // a stored NULL calculation says so (legacy showed the first choice of its select)
    expect(within(pick).getByText('Not set')).toBeInTheDocument();
    expect(within(pick).getByText('P0001 · Poly Bag')).toBeInTheDocument();
    expect(within(pick).getByText('Material Handling')).toBeInTheDocument();
    expect(within(pick).getByText('Yes')).toBeInTheDocument();
  });

  it('narrows the freight rates by search and to the ports with a rate', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByTestId('freight-grid');

    await user.click(screen.getByRole('checkbox', { name: 'Only ports with a rate (1)' }));
    expect(gridRows(freightGrid()).map((r) => r.textContent)).toEqual(['WSPWestport20GP250.00']);
    await user.click(screen.getByRole('checkbox', { name: 'Only ports with a rate (1)' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Search ports and container types' }),
      'mum',
    );
    expect(gridRows(freightGrid()).map((r) => r.textContent)).toEqual(['BOMMumbai20GP0.00']);
    await user.type(
      screen.getByRole('textbox', { name: 'Search ports and container types' }),
      'zz',
    );
    expect(screen.getByText('No freight rates match “mumzz”')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(gridRows(freightGrid())).toHaveLength(2);
  });

  it('Reload rates reads the rates again and replaces the tables (the legacy button appended a copy)', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByTestId('cfs-grid');

    await user.click(screen.getByRole('button', { name: 'Reload rates' }));
    await screen.findByTestId('cfs-grid');
    expect(rateCalls()).toHaveLength(2);
    expect(gridRows(cfsGrid())).toHaveLength(2);
    expect(within(clearanceTable()).getAllByRole('row')).toHaveLength(3);

    await user.keyboard('{Alt>}l{/Alt}');
    await waitFor(() => expect(rateCalls()).toHaveLength(3));
  });

  it('says when the rates cannot be loaded and tries again', async () => {
    const user = userEvent.setup();
    rateReply = () => ({ status: 500, data: {} });
    setup();

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('The rates could not be loaded');
    rateReply = () => ({ status: 200, data: RATES });
    await user.click(within(error).getByRole('button', { name: 'Try again' }));
    expect(
      await screen.findByRole('table', { name: 'Export clearance charges' }),
    ).toBeInTheDocument();
  });

  it('says when a table has no rates', async () => {
    rateReply = () => ({ status: 200, data: { clearance: [], freight: [], cfs: [] } });
    setup();

    expect(await screen.findByText('No export clearance rates are stored.')).toBeInTheDocument();
    expect(screen.getByText('No export freight rates are stored.')).toBeInTheDocument();
    expect(screen.getByText('No CFS charges are stored.')).toBeInTheDocument();
  });
});
