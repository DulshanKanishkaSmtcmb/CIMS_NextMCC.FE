import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import { mockViewportWidth } from '../../test/matchMedia';
import type { PmMaster } from '../../services/packingMaterialApi';
import { PmMasterPage } from './PmMasterPage';

// DataGrid interactions are slow in jsdom.
vi.setConfig({ testTimeout: 60_000 }); // slower when the suites run in parallel

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
let restoreViewport: () => void = () => undefined;

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

const field = (label: RegExp) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const box = (name: string) => screen.getByRole('checkbox', { name });
const category = () => screen.getByRole('combobox', { name: /PM category/ });
const findList = () => screen.findByRole('list', { name: 'Packing materials' });
const writes = () => calls.filter((c) => c.method === 'POST' || c.method === 'PUT');

async function startNew(user: ReturnType<typeof userEvent.setup>) {
  await within(await findList()).findByRole('button', { name: /60X30X40/ });
  await waitFor(() => expect(calls.some((c) => c.url === `${BASE}/categories`)).toBe(true));
  await user.click(screen.getAllByRole('button', { name: 'New packing material' })[0]);
  await screen.findByRole('region', { name: 'New packing material' });
  await waitFor(() => expect(category()).toHaveTextContent('Carton'));
}

async function openPm(user: ReturnType<typeof userEvent.setup>, description: string) {
  await user.click(
    await within(await findList()).findByRole('button', { name: new RegExp(description) }),
  );
  await waitFor(() => expect(field(/Description/)).toHaveValue(description));
}

/** Types into a numeric field and leaves it, which commits the value. */
async function typeNumber(user: ReturnType<typeof userEvent.setup>, label: RegExp, text: string) {
  await user.clear(field(label));
  await user.type(field(label), text);
  await user.tab();
}

describe('PmMasterPage', () => {
  beforeEach(() => {
    restoreViewport = mockViewportWidth(1440);
  });
  afterEach(() => restoreViewport());

  it('lists the packing materials (inactive ones marked) and reads the categories and the list on open', async () => {
    setup();

    expect(
      screen.getByRole('heading', { level: 1, name: 'Packing materials' }),
    ).toBeInTheDocument();
    const items = within(await findList()).getAllByRole('button');
    expect(items.map((i) => i.textContent)).toEqual([
      '60X30X40CT1 · Carton',
      'Next Printed TagsNEXT P. · StickerInactive',
    ]);
    await waitFor(() =>
      expect(calls.map((c) => `${c.method} ${c.url}`).sort()).toEqual([
        `GET ${BASE}`,
        `GET ${BASE}/categories`,
      ]),
    );
  });

  it('starts a new packing material from one default object (first category, zeros, active)', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await waitFor(() => expect(field(/Packing material code/)).toHaveFocus());
    expect(field(/Reorder level/)).toHaveValue('0');
    expect(field(/Weight \(g\)/)).toHaveValue('0');
    expect(field(/^CBM/)).toHaveValue('0');
    expect(box('Get jokers count')).not.toBeChecked();
    expect(box('Get parts count')).not.toBeChecked();
    expect(box('Active')).toBeChecked();
    expect(screen.queryByRole('textbox', { name: /Qty in hand/ })).not.toBeInTheDocument();
  });

  it('checks description, then code, then the three numbers, one at a time and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);
    const problems = async () => (await screen.findByTestId('save-problems')).textContent;

    await user.click(save());
    expect(await problems()).toContain('Enter the description');
    await user.type(field(/Description/), 'Zed');
    await user.click(save());
    expect(await problems()).toContain('Enter the packing material code');
    await user.type(field(/Packing material code/), 'ZZT1');
    await typeNumber(user, /Reorder level/, '-1');
    await user.click(save());
    expect(await problems()).toContain('Enter a reorder level of 0 or more');
    await typeNumber(user, /Reorder level/, '0');
    await typeNumber(user, /Weight \(g\)/, '-1');
    await user.click(save());
    expect(await problems()).toContain('Enter a weight of 0 or more');
    await typeNumber(user, /Weight \(g\)/, '0');
    await typeNumber(user, /^CBM/, '-1');
    await user.click(save());
    expect(await problems()).toContain('Enter a CBM of 0 or more');
    expect(calls.filter((c) => c.url !== BASE && c.url !== `${BASE}/categories`)).toHaveLength(0);
  });

  it('saves a new packing material with POST, rounding the numbers, then shows it read-only', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Packing material code/), 'ZZT1');
    await user.tab();
    await user.type(field(/Description/), 'Zed carton');
    await user.click(category());
    await user.click(await screen.findByRole('option', { name: 'Hanger' }));
    await typeNumber(user, /Reorder level/, '10.6');
    expect(field(/Reorder level/)).toHaveValue('11');
    await typeNumber(user, /Weight \(g\)/, '12.345');
    expect(field(/Weight \(g\)/)).toHaveValue('12.35');
    await typeNumber(user, /^CBM/, '0.25');
    await user.click(box('Get parts count'));
    await user.click(box('Active'));
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent(
      'Packing material ZZT1 created.',
    );
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
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(field(/^Active/)).toHaveValue('No');
  });

  it('sends zeros for the numbers the user never touched', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Packing material code/), 'ZZT1');
    await user.type(field(/Description/), 'Plain');
    await user.click(save());

    await screen.findByTestId('save-result');
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
    await startNew(user);

    await user.type(field(/Packing material code/), 'CT1');
    await user.tab();
    expect(field(/Packing material code/)).toHaveAccessibleDescription(
      'Already used by 60X30X40. Choose another code.',
    );
    await user.type(field(/Description/), 'Again');
    await user.click(save());

    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'Packing material code CT1 already exists. Choose another code.',
    );
    expect(writes()).toHaveLength(0);
  });

  it('refuses both counts together (legacy showed the message and saved), after the existence check', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Packing material code/), 'ZZT1');
    await user.type(field(/Description/), 'Both');
    await user.click(box('Get jokers count'));
    await user.click(box('Get parts count'));
    await user.click(save());

    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'Choose either jokers count or parts count, not both',
    );
    expect(calls.some((c) => c.method === 'GET' && c.url === `${BASE}/ZZT1`)).toBe(true);
    expect(writes()).toHaveLength(0);
  });

  it('opens a packing material read-only, edits it and saves with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await openPm(user, 'Next Printed Tags');
    expect(field(/Packing material code/)).toHaveValue('NEXT P.');
    expect(field(/PM category/)).toHaveValue('Sticker');
    expect(field(/Qty in hand/)).toHaveValue('120,353');
    expect(field(/Reorder level/)).toHaveValue('1000000');
    expect(field(/Get jokers count/)).toHaveValue('Yes');
    expect(field(/^Active/)).toHaveValue('No');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(field(/Packing material code/)).toHaveAttribute('readonly');
    expect(category()).toHaveTextContent('Sticker');
    expect(box('Get jokers count')).toBeChecked();
    await typeNumber(user, /Weight \(g\)/, '3');
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent(
      'Packing material NEXT P. saved.',
    );
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

  it('keeps the decimals of a loaded CBM and says that the save keeps two (the legacy page rounded 0.072 to 0)', async () => {
    const user = userEvent.setup();
    setup();

    await openPm(user, '60X30X40');
    expect(field(/^CBM/)).toHaveValue('0.07');
    expect(field(/^CBM/)).toHaveAccessibleDescription(
      'Stored as 0.072. Saving keeps two decimals (business question Q1).',
    );
    expect(field(/Weight \(g\)/)).toHaveValue('1200');
  });

  it('shows the API message of a refused save and keeps the form editable', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: { code: 'VALIDATION_FAILED', errors: { PmCategory: ['Select a valid PM Category'] } },
    });
    setup();
    await startNew(user);

    await user.type(field(/Packing material code/), 'ZZT1');
    await user.type(field(/Description/), 'X');
    await user.click(save());

    const error = await screen.findByTestId('detail-error');
    expect(error).toHaveTextContent('Data not saved');
    expect(error).toHaveTextContent('Select a valid PM Category');
    expect(save()).toBeEnabled();
  });

  it('maps a 409 from the server to "already exists" on the code', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'PM_CODE_EXISTS' } });
    setup();
    await startNew(user);

    await user.type(field(/Packing material code/), 'ZZT1');
    await user.type(field(/Description/), 'X');
    await user.click(save());

    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'Packing material code ZZT1 already exists.',
    );
  });
});
