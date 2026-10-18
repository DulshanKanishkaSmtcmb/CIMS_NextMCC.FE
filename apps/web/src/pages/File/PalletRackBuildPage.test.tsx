import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { PalletPosition, PalletRackData } from '../../services/palletRackApi';
import { PalletRackBuildPage } from './PalletRackBuildPage';

vi.setConfig({ testTimeout: 30_000 });

const BASE = '/api/v1/master-data/pallet-racks';
const A35 = { rackNo: 'A35', nofRows: 39, nofLayers: 8, nofPositions: 303 };
const SAVED = {
  status: 200,
  data: { rackNo: 'B1', positions: 4, message: 'Data Saved Successfully' },
};

const position = (positionNo: string, rackNo = 'A35'): PalletPosition => ({
  rackNo,
  positionNo,
  grnNo: "'",
  palletNo: '',
});

let calls: MockCall[] = [];
let rackReply: (rackNo: string, withPositions: boolean) => PalletRackData = () => ({
  rack: null,
  positions: [],
});
let saveReply: MockHandler = () => SAVED;

function setup() {
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: [A35] };
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/`)) {
      const rackNo = decodeURIComponent(call.url.slice(BASE.length + 1));
      const withPositions = (call.params as { positions: boolean }).positions;
      return { status: 200, data: rackReply(rackNo, withPositions) };
    }
    if (call.method === 'POST' && call.url === BASE) return saveReply(call);
    return undefined;
  });
  return renderWithProviders(<PalletRackBuildPage />, {
    preloadedState: signedInState,
    route: '/Data/PalletRackBuildArr',
  });
}

afterEach(() => {
  resetClient();
  rackReply = () => ({ rack: null, positions: [] });
  saveReply = () => SAVED;
});

const field = (label: string) => screen.getByRole('textbox', { name: label });
const layoutButton = () => document.getElementById('btnLoadData') as HTMLElement;
const tiles = () => screen.queryAllByRole('group');
const tile = (name: string) => screen.getByRole('group', { name });
const total = () => field('Total Pallet Positions');
const writes = () => calls.filter((c) => c.method === 'POST');

async function setNumber(user: ReturnType<typeof userEvent.setup>, label: string, value: string) {
  await user.clear(field(label));
  await user.type(field(label), value);
  await user.tab();
}

describe('PalletRackBuildPage', () => {
  it('shows the legacy fields, defaults and ids in order', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Pallets Rack Build' })).toBeInTheDocument();
    const ordered = [
      screen.getByRole('combobox', { name: 'Entry Type' }),
      field('Rack No'),
      field('No of Rows'),
      field('No of Layers'),
      total(),
      layoutButton(),
      screen.getByRole('heading', { name: 'Pallets Positions' }),
      screen.getByRole('button', { name: 'Save' }),
      screen.getByRole('button', { name: 'New' }),
      screen.getByRole('button', { name: 'Close' }),
    ];
    ordered.slice(1).forEach((node, i) => {
      expect(
        ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(screen.getByRole('combobox', { name: 'Entry Type' })).toHaveTextContent('New');
    expect(field('Rack No')).toHaveValue('A35');
    expect(field('No of Rows')).toHaveValue('39');
    expect(field('No of Layers')).toHaveValue('8');
    expect(total()).toHaveValue('0');
    expect(total()).toHaveAttribute('readonly');
    expect(field('Rack No')).toHaveAttribute('id', 'RackNo');
    expect(field('No of Rows')).toHaveAttribute('id', 'NofRows');
    expect(field('No of Layers')).toHaveAttribute('id', 'NofLayers');
    expect(total()).toHaveAttribute('id', 'TotPltPositions');
    expect(document.getElementById('btnRackNo')).toBeInTheDocument();
    expect(layoutButton()).toHaveTextContent('Create Pallet Position Layout');
  });

  it('draws one tile per position, numbered rack-row-layer, and counts them', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(layoutButton());

    expect(tiles()).toHaveLength(39 * 8);
    expect(tiles()[0]).toHaveAttribute('aria-label', 'A35-01-01');
    expect(tiles()[7]).toHaveAttribute('aria-label', 'A35-01-08');
    expect(tiles()[8]).toHaveAttribute('aria-label', 'A35-02-01');
    expect(tiles()[39 * 8 - 1]).toHaveAttribute('aria-label', 'A35-39-08');
    expect(total()).toHaveValue('312');
    expect(
      within(tile('A35-01-01')).getByRole('button', { name: 'Disable A35-01-01' }),
    ).toHaveTextContent('Disable');
  });

  it('a tile switches its position off (red, no number, Enable) and on again, and the total follows', async () => {
    const user = userEvent.setup();
    setup();
    await setNumber(user, 'No of Rows', '2');
    await setNumber(user, 'No of Layers', '3');
    await user.click(layoutButton());
    expect(tiles()).toHaveLength(6);
    expect(total()).toHaveValue('6');

    await user.click(screen.getByRole('button', { name: 'Disable A35-01-02' }));

    expect(total()).toHaveValue('5');
    const off = within(tile('A35-01-02'));
    expect(off.getByRole('button', { name: 'Enable A35-01-02' })).toHaveTextContent('Enable');
    expect(off.queryByRole('heading')?.textContent ?? '').toBe('');
    expect(within(tile('A35-01-01')).getByRole('heading')).toHaveTextContent('A35-01-01');

    await user.click(screen.getByRole('button', { name: 'Enable A35-01-02' }));
    expect(total()).toHaveValue('6');
    expect(within(tile('A35-01-02')).getByRole('heading')).toHaveTextContent('A35-01-02');
  });

  it('checks the fields in the legacy order with the legacy messages when creating the layout', async () => {
    const user = userEvent.setup();
    setup();

    await user.clear(field('Rack No'));
    await user.tab();
    await user.click(layoutButton());
    expect(await screen.findByText('Enter Rack No')).toBeInTheDocument();

    await user.type(field('Rack No'), 'B1');
    await setNumber(user, 'No of Rows', '0');
    await user.click(layoutButton());
    expect(await screen.findByText('Enter Nof of Rows in side Rack')).toBeInTheDocument();

    await setNumber(user, 'No of Rows', '100');
    await user.click(layoutButton());
    expect(await screen.findByText('Nof of Rows must be less than 99')).toBeInTheDocument();

    await setNumber(user, 'No of Rows', '2');
    await setNumber(user, 'No of Layers', '13');
    await user.click(layoutButton());
    expect(await screen.findByText('Nof of Layers must be less than 12')).toBeInTheDocument();
    expect(tiles()).toHaveLength(0);
  });

  it('saves the rack and the positions that are on after checking that the rack does not exist', async () => {
    const user = userEvent.setup();
    setup();
    await user.clear(field('Rack No'));
    await user.type(field('Rack No'), 'B1');
    await setNumber(user, 'No of Rows', '2');
    await setNumber(user, 'No of Layers', '2');
    await user.click(layoutButton());
    await user.click(screen.getByRole('button', { name: 'Disable B1-02-02' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    const reads = calls.filter((c) => c.method === 'GET');
    expect(reads.map((c) => [c.url, c.params])).toEqual([[`${BASE}/B1`, { positions: false }]]);
    expect(writes()).toHaveLength(1);
    expect(writes()[0].body).toEqual({
      rackNo: 'B1',
      nofRows: 2,
      nofLayers: 2,
      nofPositions: 3,
      positions: ['B1-01-01', 'B1-01-02', 'B1-02-01'],
    });
  });

  it('refuses to save before a layout exists or when every position is off', async () => {
    const user = userEvent.setup();
    setup();
    await setNumber(user, 'No of Rows', '1');
    await setNumber(user, 'No of Layers', '1');

    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Nothing to save any Pallet Positions')).toBeInTheDocument();

    await user.click(layoutButton());
    await user.click(screen.getByRole('button', { name: 'Disable A35-01-01' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findAllByText('Nothing to save any Pallet Positions')).not.toHaveLength(0);
    expect(writes()).toHaveLength(0);
  });

  it('refuses a rack that already exists, which the legacy page never checked', async () => {
    const user = userEvent.setup();
    rackReply = () => ({ rack: A35, positions: [] });
    setup();
    await user.click(layoutButton());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Pallet Rack Already Exist')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('maps a 409 from the server to the same message and shows a validation message of the server', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'PALLET_RACK_EXISTS' } });
    setup();
    await user.click(layoutButton());
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Pallet Rack Already Exist')).toBeInTheDocument();

    saveReply = () => ({
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        errors: { Positions: ['Position No can not be longer than 10 characters'] },
      },
    });
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(
      await screen.findByText('Data not Saved [Position No can not be longer than 10 characters]'),
    ).toBeInTheDocument();
  });

  it('Delete and View load the stored layout: positions that are not stored are off and the total is recounted', async () => {
    const user = userEvent.setup();
    rackReply = () => ({
      rack: A35,
      positions: [position('A35-01-01'), position('A35-01-03'), position('A35-02-02')],
    });
    setup();
    await setNumber(user, 'No of Rows', '2');
    await setNumber(user, 'No of Layers', '3');
    await user.click(screen.getByRole('combobox', { name: 'Entry Type' }));
    await user.click(await screen.findByRole('option', { name: 'View' }));
    expect(layoutButton()).toHaveTextContent('Load Pallet Position Layout');

    await user.click(layoutButton());

    await waitFor(() => expect(tiles()).toHaveLength(6));
    await waitFor(() => expect(total()).toHaveValue('3'));
    expect(screen.getByRole('button', { name: 'Disable A35-01-01' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enable A35-01-02' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Disable A35-02-02' })).toBeInTheDocument();
    const read = calls.find((c) => c.method === 'GET');
    expect(read?.params).toEqual({ positions: true });
  });

  it('a rack with no stored positions loads with every position off (the legacy page froze here)', async () => {
    const user = userEvent.setup();
    setup();
    await setNumber(user, 'No of Rows', '2');
    await setNumber(user, 'No of Layers', '4');
    await user.click(screen.getByRole('combobox', { name: 'Entry Type' }));
    await user.click(await screen.findByRole('option', { name: 'Delete' }));
    await user.click(layoutButton());

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: /^Enable / })).toHaveLength(8),
    );
    expect(total()).toHaveValue('0');
  });

  it('outside New a missing rack cannot be saved: "Pallet Rack not Exist"', async () => {
    const user = userEvent.setup();
    setup();
    await setNumber(user, 'No of Rows', '1');
    await setNumber(user, 'No of Layers', '1');
    await user.click(layoutButton());
    await user.click(screen.getByRole('combobox', { name: 'Entry Type' }));
    await user.click(await screen.findByRole('option', { name: 'Delete' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Pallet Rack not Exist')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('the Rack No field is typed in New and chosen from the Pallets Area Listing otherwise', async () => {
    const user = userEvent.setup();
    setup();
    expect(field('Rack No')).not.toHaveAttribute('readonly');
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();

    await user.click(screen.getByRole('combobox', { name: 'Entry Type' }));
    await user.click(await screen.findByRole('option', { name: 'View' }));
    expect(field('Rack No')).toHaveAttribute('readonly');
    await setNumber(user, 'No of Rows', '5');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    const dialog = await screen.findByRole('dialog', { name: 'Pallets Area Listing' });
    expect(
      within(dialog)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['', 'RackNo', 'NofRows', 'NofLayers', 'NofPositions']);
    const row = within(dialog).getByText('A35').closest('[role="row"]') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Select' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(field('Rack No')).toHaveValue('A35');
    expect(field('No of Rows')).toHaveValue('39');
    expect(field('No of Layers')).toHaveValue('8');
    expect(total()).toHaveValue('303');
  });

  it('New clears the layout', async () => {
    const user = userEvent.setup();
    setup();
    await setNumber(user, 'No of Rows', '1');
    await user.click(layoutButton());
    expect(tiles()).toHaveLength(8);

    await user.click(screen.getByRole('button', { name: 'New' }));

    expect(tiles()).toHaveLength(0);
    expect(total()).toHaveValue('0');
  });
});
