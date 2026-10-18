import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import { mockViewportWidth } from '../../test/matchMedia';
import type { Country } from '../../services/masterDataApi';
import { CountryPage } from './CountryPage';

vi.setConfig({ testTimeout: 30_000 });

const country = (code: string, name: string, cargo = 'Both'): Country => ({
  countryCode: code,
  countryName: name,
  cargoMovement: cargo,
  dateEnter: '2026-08-21T09:38:42.950',
  enterBy: 'u1',
  dateUpdate: null,
  updateBy: '',
  contractBlock: false,
});

const ROWS = [country('IND', 'INDIA'), country('MYS', 'MALAYSIA', 'Export')];
const BASE = '/api/v1/master-data/countries';

let calls: MockCall[] = [];
let saveReply: MockHandler = () => ({
  status: 200,
  data: { countryCode: 'ZZT1', message: 'Data Saved Successfully' },
});
let restoreViewport: () => void = () => undefined;

function setup(extra: MockHandler = () => undefined) {
  calls = installMockApi((call) => {
    const custom = extra(call);
    if (custom) return custom;
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: ROWS };
    if (call.method === 'GET' && call.url === `${BASE}/search`) {
      const name = String(call.params?.name ?? '').toLowerCase();
      return {
        status: 200,
        data: ROWS.filter((r) => r.countryName.toLowerCase().startsWith(name)).map((r) => ({
          countryCode: r.countryCode,
          countryName: r.countryName,
          cargoMovement: r.cargoMovement,
        })),
      };
    }
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/`)) {
      const code = decodeURIComponent(call.url.slice(BASE.length + 1));
      const row = ROWS.find((r) => r.countryCode.toLowerCase() === code.toLowerCase());
      return row
        ? { status: 200, data: row }
        : { status: 404, data: { code: 'COUNTRY_NOT_FOUND' } };
    }
    if (call.method === 'POST' || call.method === 'PUT') return saveReply(call);
    return undefined;
  });
  return renderWithProviders(<CountryPage />, {
    preloadedState: signedInState,
    route: '/File/Country',
  });
}

beforeEach(() => {
  restoreViewport = mockViewportWidth(1440); // list and detail side by side
});

afterEach(() => {
  restoreViewport();
  resetClient();
  saveReply = () => ({
    status: 200,
    data: { countryCode: 'ZZT1', message: 'Data Saved Successfully' },
  });
});

const field = (label: RegExp) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const list = () => screen.getByRole('list', { name: 'Countries' });
const findList = () => screen.findByRole('list', { name: 'Countries' });
const writes = () => calls.filter((c) => c.method === 'POST' || c.method === 'PUT');

async function startNew(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByRole('button', { name: /INDIA/ });
  await user.click(screen.getAllByRole('button', { name: 'New country' })[0]);
  return screen.findByRole('region', { name: 'New country' });
}

async function openCountry(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await within(await findList()).findByRole('button', { name: new RegExp(name) }));
  await waitFor(() => expect(field(/Country name/)).toHaveValue(name));
}

describe('CountryPage', () => {
  it('lists the countries next to an empty detail, with the shortcuts legend', async () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'Countries' })).toBeInTheDocument();
    expect(screen.getByText('File · Master data')).toBeInTheDocument();
    const items = within(await findList()).getAllByRole('button');
    expect(items.map((i) => i.textContent)).toEqual(['INDIAIND · Both', 'MALAYSIAMYS · Export']);
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Select a country' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Keyboard shortcuts' })).toBeInTheDocument();
    // Opening the page reads the list only.
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`GET ${BASE}`]);
  });

  it('starts a new country from one default object, fields in task order and the cursor in the code', async () => {
    const user = userEvent.setup();
    setup();
    const panel = await startNew(user);

    const code = field(/Country code/);
    const name = field(/Country name/);
    await waitFor(() => expect(code).toHaveFocus());
    expect(code).toHaveValue('');
    expect(name).toHaveValue('');
    const cargo = screen.getByRole('group', { name: 'Cargo movement' });
    expect(within(cargo).getByRole('button', { name: 'Both' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(panel).getByText('New')).toBeInTheDocument();
    const inOrder = [code, name, cargo];
    inOrder.slice(1).forEach((el, i) => {
      expect(
        inOrder[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(screen.getByText('0/10')).toBeInTheDocument(); // the code's length limit is counted
  });

  it('asks for the name before the code, on the fields and in a summary, and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.click(save());
    const summary = await screen.findByTestId('save-problems');
    expect(
      within(summary)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Enter the country name', 'Enter the country code']);
    expect(field(/Country name/)).toHaveAccessibleDescription('Enter the country name');
    expect(save()).toBeEnabled();

    await user.click(within(summary).getByRole('button', { name: 'Enter the country code' }));
    expect(field(/Country code/)).toHaveFocus();
    await user.type(field(/Country name/), 'Zedland');
    // a field that became valid leaves the summary at once
    expect(within(screen.getByTestId('save-problems')).getAllByRole('listitem')).toHaveLength(1);
    await user.click(save());
    expect(
      within(await screen.findByTestId('save-problems')).getAllByRole('listitem'),
    ).toHaveLength(1);
    // only the list and the similar-names lookup (first keystroke) were sent
    expect(calls.filter((c) => c.url !== BASE && !c.url.endsWith('/search'))).toHaveLength(0);
  });

  it('checks the code, saves a new country with POST and shows it read-only', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Country code/), 'ZZT1');
    await user.type(field(/Country name/), 'Zedland');
    await user.click(screen.getByRole('button', { name: 'Imports' }));
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('Country ZZT1 created.');
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe(BASE);
    expect(post?.body).toEqual({
      countryCode: 'ZZT1',
      countryName: 'Zedland',
      cargoMovement: 'Imports',
    });
    // existence check first, then the save
    expect(calls.findIndex((c) => c.url === `${BASE}/ZZT1`)).toBeLessThan(
      calls.findIndex((c) => c.method === 'POST'),
    );
    // The saved country is shown read-only: no Save until Edit (legacy: Save disabled until New).
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(field(/Country name/)).toHaveAttribute('readonly');
    // ... and the list is read again so it appears there.
    await waitFor(() =>
      expect(calls.filter((c) => c.method === 'GET' && c.url === BASE)).toHaveLength(2),
    );
  });

  it('refuses a code that already exists in New mode without posting and offers to open it', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Country code/), 'IND');
    await user.tab();
    // Early warning from the loaded list, before any save.
    expect(field(/Country code/)).toHaveAccessibleDescription(
      'Already used by INDIA. Choose another code.',
    );
    await user.type(field(/Country name/), 'India again');
    await user.click(save());

    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'Country code IND already exists. Choose another code.',
    );
    expect(writes()).toHaveLength(0);
    expect(save()).toBeEnabled();

    await user.click(screen.getByRole('button', { name: 'Discard and open IND' }));
    await waitFor(() => expect(field(/Country name/)).toHaveValue('INDIA'));
    expect(screen.getByText('Viewing')).toBeInTheDocument();
  });

  it('shows the server message when the save fails and lets the user try again', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: { code: 'VALIDATION_FAILED', errors: { CountryName: ['Too long'] } },
    });
    setup();
    await startNew(user);

    await user.type(field(/Country code/), 'ZZT1');
    await user.type(field(/Country name/), 'Zedland');
    await user.click(save());

    const error = await screen.findByTestId('detail-error');
    expect(error).toHaveTextContent('Data not saved');
    expect(error).toHaveTextContent('Nothing was changed.');
    expect(error).toHaveTextContent('Too long');
    expect(save()).toBeEnabled();
    expect(field(/Country name/)).not.toHaveAttribute('readonly');
  });

  it('maps a 409 from the server to "already exists" on the code', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'COUNTRY_CODE_EXISTS' } });
    setup();
    await startNew(user);

    await user.type(field(/Country code/), 'ZZT1');
    await user.type(field(/Country name/), 'Zedland');
    await user.click(save());

    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'Country code ZZT1 already exists.',
    );
    expect(field(/Country code/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('opens a country from the list read-only, edits it with the code fixed and saves with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await openCountry(user, 'MALAYSIA');
    expect(calls.some((c) => c.method === 'GET' && c.url === `${BASE}/MYS`)).toBe(true);
    expect(screen.getByRole('heading', { name: 'MALAYSIA (MYS)' })).toBeInTheDocument();
    expect(screen.getByText('Viewing')).toBeInTheDocument();
    expect(field(/Country name/)).toHaveAttribute('readonly');
    expect(field(/Cargo movement/)).toHaveValue('Export');
    expect(screen.getByLabelText('Record history')).toHaveTextContent('Created');
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(field(/Country code/)).toHaveAttribute('readonly');
    await waitFor(() => expect(field(/Country name/)).toHaveFocus());
    await user.clear(field(/Country name/));
    await user.type(field(/Country name/), 'MALAYSIA (MY)');
    expect(screen.getByText('Unsaved changes')).toBeInTheDocument();
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('Country MYS saved.');
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${BASE}/MYS`);
    expect(put?.body).toEqual({ countryName: 'MALAYSIA (MY)', cargoMovement: 'Export' });
  });

  it('asks before leaving unsaved changes and keeps them on "Keep editing"', async () => {
    const user = userEvent.setup();
    setup();
    await openCountry(user, 'INDIA');
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.type(field(/Country name/), ' X');

    await user.click(within(list()).getByRole('button', { name: /MALAYSIA/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Discard unsaved changes?' });
    await user.click(within(dialog).getByRole('button', { name: 'Keep editing' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(field(/Country name/)).toHaveValue('INDIA X');

    await user.keyboard('{Escape}');
    await user.click(
      within(await screen.findByRole('dialog')).getByRole('button', { name: 'Discard changes' }),
    );
    await waitFor(() => expect(field(/Country name/)).toHaveValue('INDIA'));
    expect(screen.getByText('Viewing')).toBeInTheDocument();
    expect(writes()).toHaveLength(0);
  });

  it('opens a country by typing its code in the search and pressing Enter', async () => {
    const user = userEvent.setup();
    setup();
    await screen.findByRole('button', { name: /INDIA/ });

    await user.keyboard('/');
    expect(screen.getByRole('searchbox', { name: 'Search countries' })).toHaveFocus();
    await user.keyboard('mys{Enter}');
    await waitFor(() => expect(field(/Country name/)).toHaveValue('MALAYSIA'));
  });

  it('shows similar names while a new name is typed and narrows them', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/Country name/), 'M');
    const hint = await screen.findByTestId('similar-names');
    expect(hint).toHaveTextContent('MALAYSIA');
    expect(calls.some((c) => c.url === `${BASE}/search` && c.params?.name === 'M')).toBe(true);

    await user.type(field(/Country name/), 'AL');
    expect(screen.getByTestId('similar-names')).toHaveTextContent('MALAYSIA');
    await user.type(field(/Country name/), 'X');
    expect(screen.getByTestId('similar-names')).toHaveTextContent(
      'No existing countries with a similar name.',
    );
    // still one lookup: later letters only narrow
    expect(calls.filter((c) => c.url === `${BASE}/search`)).toHaveLength(1);

    await user.clear(field(/Country name/));
    expect(screen.queryByTestId('similar-names')).not.toBeInTheDocument();
  });

  it('on a tablet opens the detail in a drawer over the list and closes it again', async () => {
    restoreViewport();
    restoreViewport = mockViewportWidth(820);
    const user = userEvent.setup();
    setup();

    await openCountry(user, 'INDIA');
    const drawer = screen.getByRole('presentation');
    expect(within(drawer).getByRole('region', { name: 'INDIA (IND)' })).toBeInTheDocument();
    await user.click(within(drawer).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('region', { name: 'INDIA (IND)' })).toBeNull());
    expect(await screen.findByRole('heading', { level: 1, name: 'Countries' })).toBeInTheDocument();
  });

  it('says when the list cannot be loaded and retries', async () => {
    const user = userEvent.setup();
    let fail = true;
    setup((call) =>
      call.method === 'GET' && call.url === BASE && fail ? { status: 500 } : undefined,
    );

    expect(await screen.findByRole('alert')).toHaveTextContent('Countries could not be loaded');
    fail = false;
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(
      await within(await findList()).findByRole('button', { name: /INDIA/ }),
    ).toBeInTheDocument();
  });
});
