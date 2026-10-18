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
const table = () => screen.getByRole('table', { name: 'Reasons Listing' });
const bodyRows = () => within(table()).getAllByRole('row').slice(1, -1);
const listCalls = () => calls.filter((c) => c.method === 'GET' && c.url === BASE);
const writes = () => calls.filter((c) => c.method === 'PUT');

async function chooseDc(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(dcSelect());
  await user.click(await screen.findByRole('option', { name }));
}

describe('OkToLoadReasonPage', () => {
  it('selects the first DC when it opens and loads that DC’s reasons with the allocation check', async () => {
    setup();

    expect(
      screen.getByRole('heading', { name: 'Shipments Ok To Load / Hold Reasons' }),
    ).toBeInTheDocument();
    await waitFor(() => expect(dcSelect()).toHaveTextContent('Aramex Fulfillment Centre'));
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    expect(listCalls()[0].params).toEqual({
      dc: 'Aramex Fulfillment Centre',
      checkAllocation: true,
    });
    expect(await screen.findByText('Reasons Data Loaded successfully')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Reasons Listing' })).toBeInTheDocument();
    expect(
      within(table())
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(['', 'Reason', 'Detail Reson']);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('shows the reasons of the chosen DC in order, stored reasons read-only, blank reasons hidden', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await chooseDc(user, 'Zalora Online');

    await waitFor(() => expect(bodyRows()).toHaveLength(2));
    const [first, second] = bodyRows();
    expect(within(first).getByRole('textbox', { name: 'Reason' })).toHaveValue(
      'data needs loading',
    );
    expect(within(first).getByRole('textbox', { name: 'Reason' })).toHaveAttribute('readonly');
    expect(within(first).getByRole('textbox', { name: 'Detail Reson' })).toHaveValue(
      'Needs loading',
    );
    expect(within(second).getByRole('textbox', { name: 'Reason' })).toHaveValue('no data');
    expect(listCalls()[1].params).toEqual({ dc: 'Zalora Online', checkAllocation: true });
  });

  it('empties the list when the DC changes and loads the other DC', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await chooseDc(user, 'Zalora Online');
    await waitFor(() => expect(bodyRows()).toHaveLength(2));

    await chooseDc(user, 'Aramex Fulfillment Centre');

    await waitFor(() => expect(bodyRows()).toHaveLength(0));
    expect(listCalls()).toHaveLength(3);
  });

  it('refuses to remove a reason contracts already carry and removes the others', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await chooseDc(user, 'Zalora Online');
    await waitFor(() => expect(bodyRows()).toHaveLength(2));

    await user.click(within(bodyRows()[0]).getByRole('button', { name: 'Remove reason' }));
    expect(
      await screen.findByText(
        'This Reason is already allocated into Contracts. So not allow to Remove',
      ),
    ).toBeInTheDocument();
    expect(bodyRows()).toHaveLength(2);

    await user.click(within(bodyRows()[1]).getByRole('button', { name: 'Remove reason' }));
    expect(bodyRows()).toHaveLength(1);
  });

  it('adds an editable row, saves the whole list in order and shows the legacy success text', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await chooseDc(user, 'Zalora Online');
    await waitFor(() => expect(bodyRows()).toHaveLength(2));

    await user.click(screen.getByRole('button', { name: 'Add reason' }));
    const added = bodyRows()[2];
    expect(within(added).getByRole('textbox', { name: 'Reason' })).not.toHaveAttribute('readonly');
    await user.type(within(added).getByRole('textbox', { name: 'Reason' }), 'new reason');
    await user.type(within(added).getByRole('textbox', { name: 'Detail Reson' }), 'new detail');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    expect(writes()).toHaveLength(1);
    expect(writes()[0].body).toEqual({
      dc: 'Zalora Online',
      reasons: [
        { reason: 'data needs loading', dtlReson: 'Needs loading' },
        { reason: 'no data', dtlReson: 'No data available' },
        { reason: 'new reason', dtlReson: 'new detail' },
      ],
    });
  });

  it('does not save a blank reason', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Add reason' }));
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('Enter Reason')).toBeInTheDocument();
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
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText('Data not Saved [Contract Data not found.[Empty List]]'),
    ).toBeInTheDocument();
    expect(writes()).toHaveLength(1);
  });

  it('maps a 409 to the allocated-reason message', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'REASON_ALLOCATED' } });
    setup();
    await waitFor(() => expect(listCalls()).toHaveLength(1));
    await user.click(screen.getByRole('button', { name: 'Add reason' }));
    await user.type(screen.getByRole('textbox', { name: 'Reason' }), 'x');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(
      await screen.findByText(
        'This Reason is already allocated into Contracts. So not allow to Remove',
      ),
    ).toBeInTheDocument();
  });

  it('says so when the reasons cannot be loaded', async () => {
    listReply = () => ({ status: 500, data: {} });
    setup();

    expect(
      await screen.findByText('Something went wrong.Please contact administrator'),
    ).toBeInTheDocument();
  });

  it('with no DC to select Save says "DC not selected"', async () => {
    const user = userEvent.setup();
    setup([]);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(await screen.findByText('DC not selected')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });
});
