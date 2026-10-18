import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import { mockViewportWidth } from '../../test/matchMedia';
import type { Country, Dc } from '../../services/masterDataApi';
import { DcPage } from './DcPage';

// DataGrid interactions (the country lookup dialog) are slow in jsdom.
vi.setConfig({ testTimeout: 30_000 });

const dc = (whDes: string, countryCode: string): Dc =>
  ({
    whCode: '3905',
    whDes,
    whDesMain: 'Kohls',
    countryCode,
    loadingOrder: 100,
    stockUpdate: true,
    outerLabel: false,
    brandText: null,
    address: '',
  }) as Dc;
const country = (code: string, name: string): Country => ({
  countryCode: code,
  countryName: name,
  cargoMovement: 'Both',
  dateEnter: null,
  enterBy: 'u1',
  dateUpdate: null,
  updateBy: '',
  contractBlock: false,
});

const DCS = [dc('Kohls Online', 'US'), dc('Re-Export', 'Dubai'), dc('Orphan DC', '')];
const COUNTRIES = [country('IND', 'INDIA'), country('US', 'United States of America')];
const BASE = '/api/v1/master-data/dcs';
const COUNTRIES_URL = '/api/v1/master-data/countries';

let calls: MockCall[] = [];
let saveReply: MockHandler = () => ({
  status: 200,
  data: { whDes: 'ZZT1 DC', message: 'Data Saved Successfully' },
});
let restoreViewport: () => void = () => undefined;

function setup() {
  calls = installMockApi((call) => {
    if (call.method === 'GET' && call.url === BASE) return { status: 200, data: DCS };
    if (call.method === 'GET' && call.url.startsWith(`${BASE}/`)) {
      const name = decodeURIComponent(call.url.slice(BASE.length + 1));
      const row = DCS.find((d) => d.whDes.toLowerCase() === name.toLowerCase());
      return row ? { status: 200, data: row } : { status: 404, data: { code: 'DC_NOT_FOUND' } };
    }
    if (call.method === 'GET' && call.url === COUNTRIES_URL)
      return { status: 200, data: COUNTRIES };
    if (call.method === 'GET' && call.url.startsWith(`${COUNTRIES_URL}/`)) {
      const code = decodeURIComponent(call.url.slice(COUNTRIES_URL.length + 1));
      const row = COUNTRIES.find((c) => c.countryCode === code);
      return row ? { status: 200, data: row } : { status: 404, data: {} };
    }
    if (call.method === 'POST' || call.method === 'PUT') return saveReply(call);
    return undefined;
  });
  return renderWithProviders(<DcPage />, { preloadedState: signedInState, route: '/File/DC' });
}

beforeEach(() => {
  restoreViewport = mockViewportWidth(1440);
});

afterEach(() => {
  restoreViewport();
  resetClient();
  saveReply = () => ({
    status: 200,
    data: { whDes: 'ZZT1 DC', message: 'Data Saved Successfully' },
  });
});

const field = (label: RegExp) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });
const findList = () => screen.findByRole('list', { name: 'DCs' });
const writes = () => calls.filter((c) => c.method === 'POST' || c.method === 'PUT');

async function startNew(user: ReturnType<typeof userEvent.setup>) {
  await within(await findList()).findByRole('button', { name: /Kohls Online/ });
  await user.click(screen.getAllByRole('button', { name: 'New DC' })[0]);
  return screen.findByRole('region', { name: 'New DC' });
}

async function openDc(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(await within(await findList()).findByRole('button', { name: new RegExp(name) }));
  await waitFor(() => expect(field(/DC name/)).toHaveValue(name));
}

async function pickCountry(user: ReturnType<typeof userEvent.setup>, rowText: string) {
  await user.click(screen.getByRole('button', { name: 'Search countries' }));
  const dialog = await screen.findByRole('dialog', { name: 'Countries' });
  const row = within(dialog).getByText(rowText).closest('[role="row"]') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Select' }));
}

describe('DcPage', () => {
  it('lists the DCs (code, main group, country) next to an empty detail', async () => {
    setup();

    expect(screen.getByRole('heading', { level: 1, name: 'DCs' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search DCs' })).toBeInTheDocument();
    const items = within(await findList()).getAllByRole('button');
    expect(items.map((i) => i.textContent)).toEqual([
      'Kohls Online3905 · Kohls · US',
      'Re-Export3905 · Kohls · Dubai',
      'Orphan DC3905 · Kohls · No country',
    ]);
    expect(screen.getByRole('heading', { name: 'Select a DC' })).toBeInTheDocument();
    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([`GET ${BASE}`]);
  });

  it('asks for the DC name only and sends nothing', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);
    await waitFor(() => expect(field(/DC name/)).toHaveFocus());

    await user.click(save());
    const summary = await screen.findByTestId('save-problems');
    expect(
      within(summary)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Enter the DC name']);
    expect(save()).toBeEnabled();
    expect(calls.filter((c) => c.url !== BASE)).toHaveLength(0);
  });

  it('saves a new DC with POST after the existence check, then shows it read-only', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/DC name/), 'ZZT1 DC');
    await user.tab();
    await pickCountry(user, 'INDIA');
    await waitFor(() => expect(field(/Country/)).toHaveAccessibleDescription('INDIA'));
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('DC ZZT1 DC created.');
    const post = calls.find((c) => c.method === 'POST');
    expect(post?.url).toBe(BASE);
    expect(post?.body).toEqual({ whDes: 'ZZT1 DC', countryCode: 'IND' });
    expect(calls.findIndex((c) => c.url === `${BASE}/ZZT1%20DC`)).toBeLessThan(
      calls.findIndex((c) => c.method === 'POST'),
    );
    expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument();
    expect(field(/DC name/)).toHaveAttribute('readonly');
  });

  it('can save a DC without a country, like the legacy page', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/DC name/), 'ZZT2 DC');
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('DC ZZT2 DC created.');
    expect(calls.find((c) => c.method === 'POST')?.body).toEqual({
      whDes: 'ZZT2 DC',
      countryCode: '',
    });
  });

  it('refuses a DC that already exists in New mode without posting', async () => {
    const user = userEvent.setup();
    setup();
    await startNew(user);

    await user.type(field(/DC name/), 'Kohls Online');
    await user.tab();
    expect(field(/DC name/)).toHaveAccessibleDescription(
      'This DC is already in the list. Choose another name.',
    );
    await user.click(save());

    expect(await screen.findByTestId('save-problems')).toHaveTextContent(
      'DC Kohls Online already exists. Choose another name.',
    );
    expect(writes()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Discard and open Kohls Online' }));
    await waitFor(() => expect(screen.getByText('Viewing')).toBeInTheDocument());
  });

  it('opens a DC with its country name and settings, changes the country and saves with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await openDc(user, 'Kohls Online');
    await waitFor(() =>
      expect(field(/Country/)).toHaveAccessibleDescription('United States of America'),
    );
    const settings = screen.getByTestId('dc-settings');
    const value = (term: string) =>
      within(settings).getByText(term, { selector: 'dt' }).nextElementSibling?.textContent;
    expect(value('Loading order')).toBe('100');
    expect(value('Stock update')).toBe('Yes');

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    expect(field(/DC name/)).toHaveAttribute('readonly');
    await waitFor(() => expect(field(/Country/)).toHaveFocus());
    await pickCountry(user, 'INDIA');
    await waitFor(() => expect(field(/Country/)).toHaveValue('IND'));
    await user.click(save());

    expect(await screen.findByTestId('save-result')).toHaveTextContent('DC Kohls Online saved.');
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${BASE}/Kohls%20Online`);
    expect(put?.body).toEqual({ countryCode: 'IND' });
  });

  it('shows a DC whose country code has no country without a name', async () => {
    const user = userEvent.setup();
    setup();

    await openDc(user, 'Re-Export');
    expect(field(/Country/)).toHaveValue('Dubai');
    await openDc(user, 'Orphan DC');
    expect(field(/Country/)).toHaveAccessibleDescription('No country');
  });
});
