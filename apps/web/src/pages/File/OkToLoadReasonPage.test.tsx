import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { Dc } from '../../services/masterDataApi';
import type { OkToLoadReason } from '../../services/okToLoadReasonApi';
import { OkToLoadReasonPage } from './OkToLoadReasonPage';

vi.setConfig({ testTimeout: 30_000 });

const dc = (whDes: string) => ({ whDes, whCode: '1', countryCode: 'US' }) as Dc;
const DCS = [dc('Aramex Fulfillment Centre'), dc('Zalora Online')];
const reason = (r: string, detail: string, dcName: string, allocated = false): OkToLoadReason => ({
  reason: r,
  dtlReson: detail,
  dc: dcName,
  isAllocated: allocated,
});
const ZALORA = [
  reason('data needs loading', 'Needs loading', 'Zalora Online', true),
  reason('no data', 'No data available', 'Zalora Online'),
  reason('', 'hidden: blank reason', 'Zalora Online'),
];

const BASE = '/api/v1/master-data/ok-to-load-reasons';
const SAVED = {
  status: 200,
  data: { dc: 'Zalora Online', count: 2, message: 'Data Saved Successfully' },
};

let calls: MockCall[] = [];
let saveReply: MockHandler = () => SAVED;
let listReply: MockHandler | null = null;

function setup(dcs: Dc[] = DCS) {
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === '/api/v1/master-data/dcs')
      return { status: 200, data: dcs };
    if (call.method === 'GET' && call.url === BASE) {
      if (listReply) return listReply(call);
      const name = (call.params as { dc: string }).dc;
      return { status: 200, data: name === 'Zalora Online' ? ZALORA : [] };
    }
    if (call.method === 'PUT' && call.url === BASE) return saveReply(call);
    return undefined;
  });
  return renderWithProviders(<OkToLoadReasonPage />, {
    preloadedState: signedInState,
    route: '/File/OkToLoadReason',
  });
}

afterEach(() => {
  resetClient();
  saveReply = () => SAVED;
  listReply = null;
});

const dcSelect = () => screen.getByRole('combobox', { name: 'DC' });
const rowsShown = () => screen.queryAllByTestId('reason-row');
const listCalls = () => calls.filter((c) => c.method === 'GET' && c.url === BASE);
const writes = () => calls.filter((c) => c.method === 'PUT');
const save = () => screen.getByRole('button', { name: 'Save reasons' });
const reasonField = (n: number) => screen.getByRole('textbox', { name: `Reason ${n}` });
const detailField = (n: number) => screen.getByRole('textbox', { name: `Details ${n}` });

async function chooseDc(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(dcSelect());
  await user.click(await screen.findByRole('option', { name }));
}

async function openZalora(user: ReturnType<typeof userEvent.setup>) {
  await waitFor(() => expect(listCalls()).toHaveLength(1));
  await chooseDc(user, 'Zalora Online');
  await waitFor(() => expect(rowsShown()).toHaveLength(2));
}

describe('OkToLoadReasonPage', () => {
  it('selects the first DC when it opens and loads that DC’s reasons with the allocation check', async () => {
    setup();

    expect(
      screen.getByRole('heading', { level: 1, name: 'OK-to-load and hold reasons' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(dcSelect()).toHaveTextContent('Aramex Fulfillment Centre'));
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    expect(listCalls()[0].params).toEqual({
      dc: 'Aramex Fulfillment Centre',
      checkAllocation: true,
    });
    expect(
      await screen.findByText('No reasons for Aramex Fulfillment Centre yet'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('reason-count')).toHaveTextContent('0 reasons');
    expect(
      within(screen.getByRole('table', { name: 'Reasons' }))
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['No', 'Reason', 'Details', 'Actions']);
  });

  it('shows the reasons of the chosen DC in order, stored reasons read-only, used ones locked, blank ones hidden', async () => {
    const user = userEvent.setup();
    setup();
    await openZalora(user);

    expect(reasonField(1)).toHaveValue('data needs loading');
    expect(reasonField(1)).toHaveAttribute('readonly');
    expect(detailField(1)).toHaveValue('Needs loading');
    expect(reasonField(2)).toHaveValue('no data');
    const [first, second] = rowsShown();
    // the allocated reason cannot be removed: it says why instead of offering the button
    expect(within(first).getByText('Used by contracts')).toBeInTheDocument();
    expect(within(first).queryByRole('button', { name: /Remove/ })).toBeNull();
    expect(within(second).getByRole('button', { name: 'Remove no data' })).toBeInTheDocument();
    expect(screen.getByTestId('reason-count')).toHaveTextContent('2 reasons');
    expect(listCalls()[1].params).toEqual({ dc: 'Zalora Online', checkAllocation: true });
  });

  it('empties the list when the DC changes and loads the other DC', async () => {
    const user = userEvent.setup();
    setup();
    await openZalora(user);

    await chooseDc(user, 'Aramex Fulfillment Centre');

    await waitFor(() => expect(rowsShown()).toHaveLength(0));
    expect(listCalls()).toHaveLength(3);
  });

  it('asks before a DC change throws away unsaved changes', async () => {
    const user = userEvent.setup();
    setup();
    await openZalora(user);
    await user.type(detailField(2), ' more');
    expect(screen.getByTestId('change-summary')).toHaveTextContent('1 changed');

    await chooseDc(user, 'Aramex Fulfillment Centre');
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(dcSelect()).toHaveTextContent('Zalora Online');
    expect(detailField(2)).toHaveValue('No data available more');

    await chooseDc(user, 'Aramex Fulfillment Centre');
    await user.click(await screen.findByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(rowsShown()).toHaveLength(0));
  });

  it('removes a reason with Undo until it is saved', async () => {
    const user = userEvent.setup();
    setup();
    await openZalora(user);

    await user.click(screen.getByRole('button', { name: 'Remove no data' }));
    expect(rowsShown()).toHaveLength(1);
    expect(screen.getByTestId('removed-hint')).toHaveTextContent('Removed “no data”.');
    expect(screen.getByTestId('change-summary')).toHaveTextContent('1 removed');
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(rowsShown()).toHaveLength(2);
    expect(reasonField(2)).toHaveValue('no data');
    expect(screen.queryByTestId('change-summary')).toBeNull();
  });

  it('adds an editable row, saves the whole list in order and says what was saved', async () => {
    const user = userEvent.setup();
    setup();
    await openZalora(user);

    await user.click(screen.getByRole('button', { name: 'Add reason' }));
    await waitFor(() => expect(reasonField(3)).toHaveFocus());
    expect(reasonField(3)).not.toHaveAttribute('readonly');
    await user.type(reasonField(3), 'new reason');
    await user.type(detailField(3), 'new detail');
    expect(screen.getByTestId('change-summary')).toHaveTextContent('1 added');
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent(
      'Saved 3 reasons for Zalora Online.',
    );
    expect(writes()[0].body).toEqual({
      dc: 'Zalora Online',
      reasons: [
        { reason: 'data needs loading', dtlReson: 'Needs loading' },
        { reason: 'no data', dtlReson: 'No data available' },
        { reason: 'new reason', dtlReson: 'new detail' },
      ],
    });
    // the saved reason keeps its text from now on (a reload would show it read-only too)
    expect(reasonField(3)).toHaveAttribute('readonly');
    expect(screen.queryByText('Unsaved changes')).toBeNull();
  });

  it('does not save a blank reason and puts the cursor in it', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Add reason' }));
    await user.click(save());

    expect(screen.getByTestId('save-problem')).toHaveTextContent('One reason has no text');
    expect(reasonField(1)).toHaveAccessibleDescription('Enter the reason');
    expect(reasonField(1)).toHaveFocus();
    expect(writes()).toHaveLength(0);
  });

  it('shows the server’s message when the save is refused, e.g. an empty list', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        errors: { Reasons: ['Contract Data not found.[Empty List]'] },
      },
    });
    setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await user.click(save());

    const error = await screen.findByTestId('save-error');
    expect(error).toHaveTextContent('Data not saved');
    expect(error).toHaveTextContent('Contract Data not found.[Empty List]');
    expect(writes()).toHaveLength(1);
  });

  it('explains a 409 (a reason contracts use was left out)', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'REASON_ALLOCATED' } });
    setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Add reason' }));
    await user.type(reasonField(1), 'x');
    await user.click(save());

    expect(await screen.findByTestId('save-error')).toHaveTextContent(
      'A reason that contracts already use was left out. Nothing was changed.',
    );
  });

  it('says so when the reasons cannot be loaded, with Try again', async () => {
    listReply = () => ({ status: 500, data: {} });
    setup();

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent('The reasons could not be loaded');
    expect(within(error).getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('with no DC to choose Save says to choose the DC first', async () => {
    const user = userEvent.setup();
    setup([]);
    await screen.findByText('Choose a DC');
    await user.click(save());

    expect(screen.getByTestId('save-problem')).toHaveTextContent('Choose the DC first');
    expect(writes()).toHaveLength(0);
  });

  it('saves with Ctrl+S and adds a row with Alt+R', async () => {
    const user = userEvent.setup();
    setup();
    await openZalora(user);

    await user.keyboard('{Alt>}r{/Alt}');
    await waitFor(() => expect(reasonField(3)).toHaveFocus());
    await user.keyboard('third');
    await user.keyboard('{Control>}s{/Control}');
    expect(await screen.findByTestId('save-result')).toHaveTextContent('Saved 3 reasons');
  });
});
