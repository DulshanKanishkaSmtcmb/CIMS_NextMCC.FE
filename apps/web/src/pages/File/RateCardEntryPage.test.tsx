import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { CfsRate, RateCard } from '../../services/rateCardApi';
import type { PmMaster } from '../../services/packingMaterialApi';
import { RateCardEntryPage } from './RateCardEntryPage';

vi.setConfig({ testTimeout: 30_000 });

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

const PM = (code: string, description: string): PmMaster => ({
  pmCode: code,
  pmDescription: description,
  pmCategory: 'Carton',
  pmIssueType: '',
  qtyInHand: 0,
  qtyReOrderLevel: 0,
  pmWgt: 0,
  pmCbm: 0,
  getJokerCount: false,
  getPartCount: false,
  getCtnCount: false,
  stockCbm: 0,
  isActive: true,
});

const BASE = '/api/v1/master-data/rate-cards';
let calls: MockCall[] = [];
let rateReply: MockHandler = () => ({ status: 200, data: RATES });

function setup() {
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === BASE) return rateReply(call);
    if (call.method === 'GET' && call.url === '/api/v1/master-data/pm-masters')
      return { status: 200, data: [PM('C0001', 'Carton A4'), PM('P0001', 'Poly Bag')] };
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

const clearanceTable = () => screen.getByRole('table', { name: 'Export Clearance Charges' });
const freightTable = () => screen.getByRole('table', { name: 'Export Freight Charges' });
const cfsTable = () => screen.getByRole('table', { name: 'CFS Charges' });
const rowsOf = (table: HTMLElement) => within(table).getAllByRole('row').slice(1);
const rateCalls = () => calls.filter((c) => c.url === BASE);

describe('RateCardEntryPage', () => {
  it('loads the rates when it opens and shows the three tables with the legacy headings', async () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Rate Card Entry' })).toBeInTheDocument();
    await screen.findByRole('table', { name: 'Export Clearance Charges' });
    expect(rateCalls()).toHaveLength(1);

    expect(
      [
        'Rate Structure - Export Clearance Charges',
        'Rate Structure - Export Freight Charges',
        'Rate Structure - CFS Charges',
      ].map((name) => screen.getByRole('heading', { name })),
    ).toHaveLength(3);
    expect(
      within(clearanceTable())
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Cntr Type', 'Rate[USD]']);
    expect(
      within(freightTable())
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['Port Code', 'Port Name', 'Cntr Type', 'Rate[USD]']);
    expect(
      within(cfsTable())
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual([
      '',
      'Chg Name',
      'Unit Type',
      'Unit Cal',
      'Range1',
      'Range2',
      'Table Type',
      'Material Code',
      'Material Name',
      'Active',
      'Rate[USD]',
    ]);
    expect(rowsOf(clearanceTable())).toHaveLength(2);
    expect(rowsOf(freightTable())).toHaveLength(2);
    expect(rowsOf(cfsTable())).toHaveLength(2);
    ['Load Rates', 'New', 'Close'].forEach((name) =>
      expect(screen.getByRole('button', { name })).toBeInTheDocument(),
    );
  });

  it('shows the stored values, the container types read-only and a missing rate as 0', async () => {
    setup();
    await screen.findByRole('table', { name: 'Export Clearance Charges' });

    const [first, second] = rowsOf(clearanceTable());
    expect(within(first).getByRole('textbox', { name: 'Cntr Type' })).toHaveValue('20GP');
    expect(within(first).getByRole('textbox', { name: 'Cntr Type' })).toHaveAttribute('readonly');
    expect(within(first).getByRole('textbox', { name: 'Rate[USD]' })).toHaveValue('700');
    expect(within(second).getByRole('textbox', { name: 'Rate[USD]' })).toHaveValue('0');
    const freight = rowsOf(freightTable())[1];
    expect(within(freight).getByRole('textbox', { name: 'Port Code' })).toHaveValue('WSP');
    expect(within(freight).getByRole('textbox', { name: 'Port Name' })).toHaveValue('Westport');
  });

  it('rounds an edited rate to two decimals and ignores text that is not a number', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('table', { name: 'Export Clearance Charges' });

    const rate = within(rowsOf(clearanceTable())[0]).getByRole('textbox', { name: 'Rate[USD]' });
    await user.clear(rate);
    await user.type(rate, '712.456');
    await user.tab();
    expect(rate).toHaveValue('712.46');
    await user.clear(rate);
    await user.type(rate, 'abc');
    await user.tab();
    expect(rate).toHaveValue('712.46');
  });

  it('a stored NULL unit calculation type shows the first choice, like the Knockout select', async () => {
    setup();
    await screen.findByRole('table', { name: 'CFS Charges' });

    const row = rowsOf(cfsTable())[1];
    expect(within(row).getByRole('combobox', { name: 'Unit Cal' })).toHaveTextContent('Individual');
    expect(within(row).getByRole('combobox', { name: 'Unit Type' })).toHaveTextContent('PCS');
    expect(within(row).getByRole('combobox', { name: 'Table Type' })).toHaveTextContent(
      'Material Handling',
    );
    expect(within(row).getByRole('textbox', { name: 'Material Name' })).toHaveValue('Poly Bag');
  });

  it('enables Range1 and Range2 only for the Range calculation and the material search only for material tables', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('table', { name: 'CFS Charges' });

    const first = rowsOf(cfsTable())[0];
    expect(within(first).getByRole('textbox', { name: 'Range1' })).toHaveAttribute('readonly');
    expect(within(first).getByRole('textbox', { name: 'Range2' })).toHaveAttribute('readonly');
    expect(within(first).getByRole('button', { name: 'Search' })).toBeDisabled();

    await user.click(within(first).getByRole('combobox', { name: 'Unit Cal' }));
    await user.click(await screen.findByRole('option', { name: 'Range' }));
    expect(within(first).getByRole('textbox', { name: 'Range1' })).not.toHaveAttribute('readonly');

    await user.click(within(first).getByRole('combobox', { name: 'Table Type' }));
    await user.click(await screen.findByRole('option', { name: 'Material' }));
    expect(within(first).getByRole('button', { name: 'Search' })).toBeEnabled();
  });

  it('the plus button on the last CFS row adds an empty row with the first choice of each select', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('table', { name: 'CFS Charges' });

    expect(screen.getAllByRole('button', { name: 'Add charge' })).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Add charge' }));

    const rows = rowsOf(cfsTable());
    expect(rows).toHaveLength(3);
    const added = rows[2];
    expect(within(added).getByRole('textbox', { name: 'Chg Name' })).toHaveValue('');
    expect(within(added).getByRole('combobox', { name: 'Unit Type' })).toHaveTextContent('Storage');
    expect(within(added).getByRole('combobox', { name: 'Unit Cal' })).toHaveTextContent(
      'Individual',
    );
    expect(within(added).getByRole('combobox', { name: 'Table Type' })).toHaveTextContent(
      'ContractsInOut',
    );
    expect(within(added).getByRole('checkbox', { name: 'Active' })).not.toBeChecked();
    // the plus moved to the new last row
    expect(within(rows[1]).queryByRole('button', { name: 'Add charge' })).not.toBeInTheDocument();
    expect(within(added).getByRole('button', { name: 'Add charge' })).toBeInTheDocument();
  });

  it('the material search lists the packing materials and Select fills the row', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('table', { name: 'CFS Charges' });

    const row = rowsOf(cfsTable())[1];
    await user.click(within(row).getByRole('button', { name: 'Search' }));
    const dialog = await screen.findByRole('dialog', { name: 'Packing Material Master Listing' });
    const pm = within(dialog).getByText('Carton A4').closest('[role="row"]') as HTMLElement;
    await user.click(within(pm).getByRole('button', { name: 'Select' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(within(row).getByRole('textbox', { name: 'Material Code' })).toHaveValue('C0001');
    expect(within(row).getByRole('textbox', { name: 'Material Name' })).toHaveValue('Carton A4');
  });

  it('Load Rates replaces the tables with fresh rates (the legacy button appended a second copy)', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('table', { name: 'Export Clearance Charges' });

    await user.click(screen.getByRole('button', { name: 'Load Rates' }));

    await waitFor(() => expect(rateCalls()).toHaveLength(2));
    await waitFor(() => expect(rowsOf(clearanceTable())).toHaveLength(2));
    expect(rowsOf(freightTable())).toHaveLength(2);
    expect(rowsOf(cfsTable())).toHaveLength(2);
  });

  it('New empties the three tables; Load Rates brings them back', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('table', { name: 'Export Clearance Charges' });

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(
      screen.queryByRole('table', { name: 'Export Clearance Charges' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'CFS Charges' })).not.toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Rate Structure - CFS Charges' }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load Rates' }));
    expect(await screen.findByRole('table', { name: 'CFS Charges' })).toBeInTheDocument();
  });

  it('shows the legacy message when the rates cannot be loaded', async () => {
    rateReply = () => ({ status: 500, data: {} });
    setup();

    expect(await screen.findByText('Error Loading.... Rate Card Data')).toBeInTheDocument();
    expect(
      screen.queryByRole('table', { name: 'Export Clearance Charges' }),
    ).not.toBeInTheDocument();
  });
});
