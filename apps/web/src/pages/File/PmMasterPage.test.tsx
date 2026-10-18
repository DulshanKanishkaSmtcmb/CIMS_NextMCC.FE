import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { PmMaster } from '../../services/packingMaterialApi';
import { PmMasterPage } from './PmMasterPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 30_000 });

const pm = (code: string, description: string, extra: Partial<PmMaster> = {}): PmMaster => ({
  pmCode: code,
  pmDescription: description,
  pmCategory: 'Carton',
  pmIssueType: '',
  qtyInHand: 128,
  qtyReOrderLevel: 0,
  pmWgt: 1200,
  pmCbm: 0.072,
  getJokerCount: false,
  getPartCount: false,
  getCtnCount: false,
  stockCbm: 0,
  isActive: true,
  ...extra,
});

const ROWS = [
  pm('CT1', '60X30X40'),
  pm('NEXT P.', 'Next Printed Tags', {
    pmCategory: 'Sticker',
    qtyInHand: 120353,
    qtyReOrderLevel: 1000000,
    pmWgt: 0,
    pmCbm: 0,
    getJokerCount: true,
    isActive: false,
  }),
];
const CATEGORIES = [{ pmCategory: 'Carton' }, { pmCategory: 'Hanger' }, { pmCategory: 'Sticker' }];
const BASE = '/api/v1/master-data/pm-masters';
const SAVED = { status: 200, data: { pmCode: 'ZZT1', message: 'Data Saved Successfully' } };

let calls: MockCall[] = [];
let saveReply: MockHandler = () => SAVED;

function setup() {
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === `${BASE}/categories`)
      return { status: 200, data: CATEGORIES };
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: ROWS };
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/`)) {
      const code = decodeURIComponent(call.url.slice(BASE.length + 1));
      const row = ROWS.find((p) => p.pmCode.toLowerCase() === code.toLowerCase());
      return row ? { status: 200, data: row } : { status: 404, data: { code: 'PM_NOT_FOUND' } };
    }
    if (call.method === 'POST' || call.method === 'PUT') return saveReply(call);
    return undefined;
  });
  return renderWithProviders(<PmMasterPage />, {
    preloadedState: signedInState,
    route: '/File/PMMaster',
  });
}

afterEach(() => {
  resetClient();
  saveReply = () => SAVED;
});

const field = (label: string) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const el = (id: string) => document.getElementById(id);
const box = (name: string) => screen.getByRole('checkbox', { name });
const category = () => screen.getByRole('combobox', { name: 'PM Category' });
const writes = () => calls.filter((c) => c.method === 'POST' || c.method === 'PUT');

async function chooseOption(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Option' }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function pickFromList(user: ReturnType<typeof userEvent.setup>, rowText: string) {
  await user.click(el('btnPMCode') as HTMLElement);
  const dialog = await screen.findByRole('dialog', { name: 'Packing Material Master Listing' });
  const row = within(dialog).getByText(rowText).closest('[role="row"]') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Select' }));
}

/** Types into a numeric field and leaves it, which commits the value. */
async function typeNumber(user: ReturnType<typeof userEvent.setup>, label: string, text: string) {
  await user.clear(field(label));
  await user.type(field(label), text);
  await user.tab();
}

describe('PmMasterPage', () => {
  it('shows the legacy fields in order with their ids and defaults', async () => {
    setup();

    expect(
      screen.getByRole('heading', { name: 'Packing Material Master Details' }),
    ).toBeInTheDocument();
    // the first PMCategories row is selected on load
    await waitFor(() => expect(category()).toHaveTextContent('Carton'));
    const ordered = [
      screen.getByRole('combobox', { name: 'Option' }),
      field('Packing Material Code'),
      field('PM Description'),
      category(),
      field('QTY in hand'),
      field('Reorder Level'),
      field('Weight (g)'),
      field('CBM'),
      box('Get Jokers Count'),
      box('Get Parts Count'),
      box('Is Acive'),
      save(),
      screen.getByRole('button', { name: 'Close' }),
    ];
    ordered.slice(1).forEach((node, i) => {
      expect(
        ordered[i].compareDocumentPosition(node) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(field('Packing Material Code')).toHaveAttribute('id', 'PMCode');
    expect(field('PM Description')).toHaveAttribute('id', 'PMDescription');
    // the search button exists only outside New, and there is no New button on this page
    expect(el('btnPMCode')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New' })).not.toBeInTheDocument();
    expect(field('QTY in hand')).toHaveAttribute('readonly');
    expect(box('Is Acive')).toBeChecked();
    expect(box('Get Jokers Count')).not.toBeChecked();
    expect(box('Get Parts Count')).not.toBeChecked();
    // only New and Change are offered
    await userEvent.click(screen.getByRole('combobox', { name: 'Option' }));
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['New', 'Change']);
  });

  it('checks description, then code, then the three numbers, with the legacy messages', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(category()).toHaveTextContent('Carton'));

    await user.click(save());
    expect(await screen.findByText('Enter Description')).toBeInTheDocument();
    await user.type(field('PM Description'), 'Zed carton');
    await user.click(save());
    expect(await screen.findByText('Enter PM Code')).toBeInTheDocument();
    await user.type(field('Packing Material Code'), 'ZZT1');
    await user.tab();

    await typeNumber(user, 'Reorder Level', '-3');
    await user.click(save());
    expect(await screen.findByText('Reorder Level must be positive number')).toBeInTheDocument();
    await typeNumber(user, 'Reorder Level', '3');

    await typeNumber(user, 'Weight (g)', '-1');
    await user.click(save());
    expect(await screen.findByText('PM Weight must be positive number')).toBeInTheDocument();
    await typeNumber(user, 'Weight (g)', '1');

    await typeNumber(user, 'CBM', '-0.5');
    await user.click(save());
    expect(await screen.findByText('CBM must be positive number')).toBeInTheDocument();

    expect(save()).toBeEnabled();
    expect(calls.filter((c) => !c.url.endsWith('/categories'))).toHaveLength(0);
  });

  it('saves a new packing material with POST, rounding the numbers, and keeps Save disabled until the Option changes', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(category()).toHaveTextContent('Carton'));

    await user.type(field('Packing Material Code'), 'ZZT1');
    await user.tab();
    await user.type(field('PM Description'), 'Zed carton');
    await user.click(category());
    await user.click(await screen.findByRole('option', { name: 'Hanger' }));
    await typeNumber(user, 'Reorder Level', '10.6');
    expect(field('Reorder Level')).toHaveValue('11');
    await typeNumber(user, 'Weight (g)', '12.345');
    expect(field('Weight (g)')).toHaveValue('12.35');
    await typeNumber(user, 'CBM', '0.25');
    await user.click(box('Get Parts Count'));
    await user.click(box('Is Acive'));
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    // the code is looked up first (the legacy existence check), then saved
    expect(calls.some((c) => c.method === 'GET' && c.url === `${BASE}/ZZT1`)).toBe(true);
    const post = writes()[0];
    expect(post.method).toBe('POST');
    expect(post.url).toBe(BASE);
    expect(post.body).toEqual({
      pmCode: 'ZZT1',
      pmDescription: 'Zed carton',
      pmCategory: 'Hanger',
      reorderLevel: 11,
      pmWeight: 12.35,
      cbm: 0.25,
      getJokersCount: false,
      getPartsCount: true,
      isActive: false,
    });
    expect(save()).toBeDisabled();

    await chooseOption(user, 'Change');
    expect(save()).toBeEnabled();
  });

  it('sends zeros for the numbers the user never touched', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(category()).toHaveTextContent('Carton'));

    await user.type(field('Packing Material Code'), 'ZZT1');
    await user.tab();
    await user.type(field('PM Description'), 'Plain');
    await user.click(save());

    await screen.findByText('Data Saved Successfully');
    expect(writes()[0].body).toMatchObject({
      pmCategory: 'Carton',
      reorderLevel: 0,
      pmWeight: 0,
      cbm: 0,
      isActive: true,
    });
  });

  it('refuses a code that already exists in New mode without posting', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Packing Material Code'), 'CT1');
    await user.tab();
    await user.type(field('PM Description'), 'Again');
    await user.click(save());

    expect(await screen.findByText('Meterial Code Already Exist')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
    expect(save()).toBeEnabled();
  });

  it('refuses both counts together instead of showing the message and saving, like legacy did', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Packing Material Code'), 'ZZT1');
    await user.tab();
    await user.type(field('PM Description'), 'Both');
    await user.click(box('Get Jokers Count'));
    await user.click(box('Get Parts Count'));
    await user.click(save());

    expect(
      await screen.findByText(
        'can not be select Get Jokers Count and Get Parts Count both check box',
      ),
    ).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
    expect(save()).toBeEnabled();
  });

  it('in Change mode shows the search button, loads the picked record and saves with PUT', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(category()).toHaveTextContent('Carton'));

    await chooseOption(user, 'Change');
    expect(field('Packing Material Code')).toHaveAttribute('readonly');
    await pickFromList(user, 'Next Printed Tags');

    await waitFor(() => expect(field('PM Description')).toHaveValue('Next Printed Tags'));
    expect(field('Packing Material Code')).toHaveValue('NEXT P.');
    expect(category()).toHaveTextContent('Sticker');
    expect(field('QTY in hand')).toHaveValue('120353');
    expect(field('Reorder Level')).toHaveValue('1000000');
    expect(box('Get Jokers Count')).toBeChecked();
    expect(box('Is Acive')).not.toBeChecked();

    await typeNumber(user, 'Weight (g)', '3');
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    const put = writes()[0];
    expect(put.method).toBe('PUT');
    expect(put.url).toBe(`${BASE}/${encodeURIComponent('NEXT P.')}`);
    expect(put.body).toEqual({
      pmDescription: 'Next Printed Tags',
      pmCategory: 'Sticker',
      reorderLevel: 1000000,
      pmWeight: 3,
      cbm: 0,
      getJokersCount: true,
      getPartsCount: false,
      isActive: false,
    });
  });

  it('keeps the decimals of a loaded CBM (the legacy page rounded 0.072 to 0)', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    await pickFromList(user, '60X30X40');

    await waitFor(() => expect(field('CBM')).toHaveValue('0.07'));
    expect(field('Weight (g)')).toHaveValue('1200');
  });

  it('going back to New resets the numbers, the flags and the category, and clears code and description', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(category()).toHaveTextContent('Carton'));

    await chooseOption(user, 'Change');
    await pickFromList(user, 'Next Printed Tags');
    await waitFor(() => expect(field('PM Description')).toHaveValue('Next Printed Tags'));
    await chooseOption(user, 'New');

    expect(field('Packing Material Code')).toHaveValue('');
    expect(field('PM Description')).toHaveValue('');
    expect(category()).toHaveTextContent('Hanger');
    expect(field('QTY in hand')).toHaveValue('0');
    expect(field('Reorder Level')).toHaveValue('0');
    expect(field('Weight (g)')).toHaveValue('0');
    expect(field('CBM')).toHaveValue('0');
    expect(box('Get Jokers Count')).not.toBeChecked();
    expect(box('Is Acive')).toBeChecked();
    expect(el('btnPMCode')).toBeNull();
  });

  it('switching to Change keeps the other fields and clears the code and description', async () => {
    const user = userEvent.setup();
    setup();
    await waitFor(() => expect(category()).toHaveTextContent('Carton'));

    await user.type(field('Packing Material Code'), 'ZZT1');
    await user.tab();
    await user.type(field('PM Description'), 'Typed');
    await typeNumber(user, 'Weight (g)', '5');
    await chooseOption(user, 'Change');

    expect(field('Packing Material Code')).toHaveValue('');
    expect(field('PM Description')).toHaveValue('');
    expect(field('Weight (g)')).toHaveValue('5');
  });

  it('shows the API message of a refused save and enables Save again', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        errors: { PmCategory: ['Select a valid PM Category'] },
      },
    });
    setup();

    await user.type(field('Packing Material Code'), 'ZZT1');
    await user.tab();
    await user.type(field('PM Description'), 'Refused');
    await user.click(save());

    expect(
      await screen.findByText('Data not Saved [Select a valid PM Category]'),
    ).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it('maps a 409 from the server to the legacy "already exist" text', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'PM_CODE_EXISTS' } });
    setup();

    await user.type(field('Packing Material Code'), 'ZZT1');
    await user.tab();
    await user.type(field('PM Description'), 'Raced');
    await user.click(save());

    expect(await screen.findByText('Meterial Code Already Exist')).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });
});
