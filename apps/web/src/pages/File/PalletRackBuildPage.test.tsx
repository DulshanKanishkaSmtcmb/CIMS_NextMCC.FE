import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { PalletPosition, PalletRackData } from '../../services/palletRackApi';
import { PalletRackBuildPage } from './PalletRackBuildPage';

vi.setConfig({ testTimeout: 60_000 }); // slower when the suites run in parallel

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
let listReply: unknown[] = [A35];

function setup() {
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: listReply };
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
  listReply = [A35];
});

const field = (label: RegExp) => screen.getByRole('textbox', { name: label });
const layoutButton = () => screen.getByTestId('layout-button');
const tiles = () => screen.queryAllByTestId('position-tile');
const tile = (position: string) =>
  screen.getByRole('button', { name: new RegExp(`^${position}:`) });
const writes = () => calls.filter((c) => c.method === 'POST');
const save = () => screen.getByRole('button', { name: 'Save rack' });
const problem = () => screen.getByTestId('save-problem');

async function setNumber(user: ReturnType<typeof userEvent.setup>, label: RegExp, value: string) {
  await user.clear(field(label));
  await user.type(field(label), value);
  await user.tab();
}

async function rack(
  user: ReturnType<typeof userEvent.setup>,
  no: string,
  rows: string,
  layers: string,
) {
  await user.type(field(/Rack number/), no);
  await user.tab();
  await setNumber(user, /Rows/, rows);
  await setNumber(user, /Layers/, layers);
}

async function viewMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'View stored rack' }));
}

describe('PalletRackBuildPage', () => {
  it('starts with empty fields (no developer defaults), the steps in order and nothing read', () => {
    setup();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Pallet rack build' }),
    ).toBeInTheDocument();
    expect(field(/Rack number/)).toHaveValue('');
    expect(field(/Rows/)).toHaveValue('');
    expect(field(/Layers/)).toHaveValue('');
    expect(screen.getByRole('button', { name: 'New rack' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('No layout yet')).toBeInTheDocument();
    const ordered = [
      screen.getByRole('heading', { name: /Rack/, level: 2 }),
      field(/Rack number/),
      field(/Rows/),
      field(/Layers/),
      layoutButton(),
      screen.getByRole('heading', { name: /Pallet positions/ }),
      save(),
    ];
    ordered.slice(1).forEach((node, i) => {
      expect(
        ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(calls).toHaveLength(0);
  });

  it('draws one tile per position, numbered rack-row-layer, all in use, and counts them', async () => {
    const user = userEvent.setup();
    setup();
    await rack(user, 'A35', '39', '8');
    await user.click(layoutButton());

    expect(tiles()).toHaveLength(312);
    expect(tile('A35-01-01')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('A35-39-08')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Row 39' })).toBeInTheDocument();
    expect(screen.getByTestId('in-use-count')).toHaveTextContent('312 of 312 in use');
    expect(field(/Positions in use/)).toHaveValue('312 of 312');
    expect(calls).toHaveLength(0); // a new layout is drawn without asking the server
  });

  it('a tile switches its position off and on again, in words, and the counts follow', async () => {
    const user = userEvent.setup();
    setup();
    await rack(user, 'A35', '1', '2');
    await user.click(layoutButton());

    await user.click(tile('A35-01-02'));
    expect(tile('A35-01-02')).toHaveAttribute('aria-pressed', 'false');
    expect(tile('A35-01-02')).toHaveAccessibleName('A35-01-02: off');
    expect(tile('A35-01-02')).toHaveTextContent('Off');
    expect(screen.getByTestId('in-use-count')).toHaveTextContent('1 of 2 in use');
    await user.click(tile('A35-01-02'));
    expect(tile('A35-01-02')).toHaveTextContent('In use');

    await user.click(screen.getByRole('button', { name: 'All off' }));
    expect(screen.getByTestId('in-use-count')).toHaveTextContent('0 of 2 in use');
    await user.click(screen.getByRole('button', { name: 'All in use' }));
    expect(screen.getByTestId('in-use-count')).toHaveTextContent('2 of 2 in use');
  });

  it('checks the fields in the legacy order, with the legacy limits, when creating the layout', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(layoutButton());
    expect(problem()).toHaveTextContent('Enter the rack number');
    await user.type(field(/Rack number/), 'B1');
    await user.tab();
    await user.click(layoutButton());
    expect(problem()).toHaveTextContent('Enter the number of rows');
    await setNumber(user, /Rows/, '100');
    await user.click(layoutButton());
    expect(problem()).toHaveTextContent('A rack has 1 to 99 rows');
    await setNumber(user, /Rows/, '99');
    await setNumber(user, /Layers/, '13');
    await user.click(layoutButton());
    expect(problem()).toHaveTextContent('A rack has at most 12 layers');
    await setNumber(user, /Layers/, '12'); // 99 rows and 12 layers pass, as in legacy
    await user.click(layoutButton());
    expect(tiles()).toHaveLength(99 * 12);
  });

  it('saves the rack and the positions that are on after checking that the rack does not exist', async () => {
    const user = userEvent.setup();
    setup();
    await rack(user, 'B1', '2', '2');
    await user.click(layoutButton());
    await user.click(tile('B1-02-02'));
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent(
      'Rack B1 saved with 3 positions in use.',
    );
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

  it('refuses to save without a layout, with every position off, or when the inputs changed after the layout', async () => {
    const user = userEvent.setup();
    setup();
    await rack(user, 'B1', '1', '1');

    await user.click(save());
    expect(problem()).toHaveTextContent('Create the layout first, then save');
    await user.click(layoutButton());
    await user.click(tile('B1-01-01'));
    await user.click(save());
    expect(problem()).toHaveTextContent('Turn at least one position on before saving');
    await user.click(tile('B1-01-01'));
    await setNumber(user, /Layers/, '2');
    expect(screen.getByTestId('layout-stale')).toBeInTheDocument();
    await user.click(save());
    expect(problem()).toHaveTextContent('Create the layout again.');
    expect(writes()).toHaveLength(0);
  });

  it('refuses a rack that already exists, which the legacy page never checked', async () => {
    const user = userEvent.setup();
    rackReply = () => ({ rack: A35, positions: [] });
    setup();
    await rack(user, 'A35', '1', '1');
    await user.click(layoutButton());
    await user.click(save());

    expect(await screen.findByTestId('save-problem')).toHaveTextContent(
      'Rack A35 already exists. Choose View stored rack to see it.',
    );
    expect(writes()).toHaveLength(0);
  });

  it('maps a 409 to "already exists" and shows a validation message of the server verbatim', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'PALLET_RACK_EXISTS' } });
    setup();
    await rack(user, 'B1', '1', '1');
    await user.click(layoutButton());
    await user.click(save());
    expect(await screen.findByTestId('save-problem')).toHaveTextContent('Rack B1 already exists.');

    saveReply = () => ({
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        errors: { Positions: ['Position No can not be longer than 10 characters'] },
      },
    });
    await user.click(save());
    const error = await screen.findByTestId('save-error');
    expect(error).toHaveTextContent('Data not saved');
    expect(error).toHaveTextContent('Position No can not be longer than 10 characters');
  });

  it('View picks a stored rack from the list and loads its layout: only stored positions are in use', async () => {
    const user = userEvent.setup();
    const A23 = { rackNo: 'A23', nofRows: 2, nofLayers: 3, nofPositions: 3 };
    listReply = [A35, A23];
    rackReply = () => ({
      rack: A23,
      positions: [
        position('A23-01-01', 'A23'),
        position('A23-01-03', 'A23'),
        position('A23-02-02', 'A23'),
      ],
    });
    setup();
    await viewMode(user);
    expect(field(/Rack number/)).toHaveAttribute('readonly');
    expect(screen.queryByRole('button', { name: 'Save rack' })).toBeNull();
    expect(layoutButton()).toHaveTextContent('Load layout');

    await user.click(screen.getByRole('button', { name: 'Search racks' }));
    const dialog = await screen.findByRole('dialog', { name: 'Stored racks' });
    expect(
      within(dialog)
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['', 'Rack', 'Rows', 'Layers', 'Positions']);
    const row = within(dialog).getByText('A23').closest('[role="row"]') as HTMLElement;
    await user.click(within(row).getByRole('button', { name: 'Select' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(field(/Rack number/)).toHaveValue('A23');
    expect(field(/Rows/)).toHaveValue('2');
    expect(field(/Positions in use/)).toHaveValue('3');

    await user.click(layoutButton());
    await waitFor(() => expect(tiles()).toHaveLength(6));
    const read = calls.find((c) => c.method === 'GET' && c.url !== BASE);
    expect(read?.params).toEqual({ positions: true });
    expect(tile('A23-01-01')).toHaveAttribute('aria-pressed', 'true');
    expect(tile('A23-01-02')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('in-use-count')).toHaveTextContent('3 of 6 in use');
    // a stored rack is shown, not edited
    await user.click(tile('A23-01-02'));
    expect(tile('A23-01-02')).toHaveAttribute('aria-pressed', 'false');
  });

  it('a stored rack with no positions loads with every position off (the legacy page froze here)', async () => {
    const user = userEvent.setup();
    listReply = [{ rackNo: 'E1', nofRows: 2, nofLayers: 4, nofPositions: 0 }];
    setup();
    await viewMode(user);
    await user.click(screen.getByRole('button', { name: 'Search racks' }));
    const dialog = await screen.findByRole('dialog', { name: 'Stored racks' });
    await user.click(within(dialog).getByRole('button', { name: 'Select' }));
    await user.click(layoutButton());

    await waitFor(() => expect(tiles()).toHaveLength(8));
    expect(screen.getByTestId('in-use-count')).toHaveTextContent('0 of 8 in use');
  });

  it('Start over asks before throwing away switched positions', async () => {
    const user = userEvent.setup();
    setup();
    await rack(user, 'B1', '1', '2');
    await user.click(layoutButton());
    await user.click(tile('B1-01-01'));

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard this layout?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(tiles()).toHaveLength(2);
    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(await screen.findByRole('button', { name: 'Discard layout' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(tiles()).toHaveLength(0);
    expect(field(/Rack number/)).toHaveValue('B1'); // the fields stay, as legacy New
  });

  it('creates the layout with Alt+L and saves with Ctrl+S', async () => {
    const user = userEvent.setup();
    setup();
    await rack(user, 'B2', '1', '1');
    await user.keyboard('{Alt>}l{/Alt}');
    expect(tiles()).toHaveLength(1);
    await user.keyboard('{Control>}s{/Control}');
    expect(await screen.findByTestId('save-result')).toHaveTextContent('Rack B2 saved');
  });
});
