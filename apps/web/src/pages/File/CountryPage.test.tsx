import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { installMockApi, type MockCall, type MockHandler } from '../../test/mockApi';
import type { Country } from '../../services/masterDataApi';
import { CountryPage } from './CountryPage';

// DataGrid interactions are slow in jsdom.
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

afterEach(() => {
  resetClient();
  saveReply = () => ({
    status: 200,
    data: { countryCode: 'ZZT1', message: 'Data Saved Successfully' },
  });
});

const field = (label: string) => screen.getByRole('textbox', { name: label });
const save = () => screen.getByRole('button', { name: 'Save' });

async function chooseOption(user: ReturnType<typeof userEvent.setup>, option: string) {
  await user.click(screen.getByRole('combobox', { name: 'Option' }));
  await user.click(await screen.findByRole('option', { name: option }));
}

async function pickFromList(user: ReturnType<typeof userEvent.setup>, rowText: string) {
  await user.click(document.getElementById('btnCountryCode') as HTMLElement);
  const dialog = await screen.findByRole('dialog', { name: 'Countries Listing' });
  const row = within(dialog).getByText(rowText).closest('[role="row"]') as HTMLElement;
  await user.click(within(row).getByRole('button', { name: 'Select' }));
}

describe('CountryPage', () => {
  it('shows the legacy fields in order with their ids and defaults', () => {
    setup();

    expect(screen.getByRole('heading', { name: 'Country Master Details' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Option' })).toHaveTextContent('New');
    const code = field('Country Code');
    const name = field('Country Name');
    expect(code).toHaveAttribute('id', 'CountryCode');
    expect(name).toHaveAttribute('id', 'CountryName');
    expect(document.getElementById('btnCountryCode')).not.toBeNull();
    const cargo = screen.getByRole('combobox', { name: 'Cargo Movement' });
    expect(cargo).toHaveTextContent('Both');
    const inOrder = [
      screen.getByRole('combobox', { name: 'Option' }),
      code,
      name,
      cargo,
      save(),
      screen.getByRole('button', { name: 'New' }),
      screen.getByRole('button', { name: 'Close' }),
    ];
    inOrder.slice(1).forEach((el, i) => {
      expect(
        inOrder[i].compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    });
    expect(calls).toHaveLength(0);
  });

  it('asks for the name before the code, with the legacy messages, and sends nothing', async () => {
    const user = userEvent.setup();
    setup();

    await user.click(save());
    expect(await screen.findByText('Enter Country Name')).toBeInTheDocument();
    expect(save()).toBeEnabled();

    await user.type(field('Country Name'), 'Zedland');
    await user.click(save());
    expect(await screen.findByText('Enter Country Code')).toBeInTheDocument();
    // only the pre-entered box lookups (first keystroke) were sent
    expect(calls.filter((c) => !c.url.endsWith('/search'))).toHaveLength(0);
  });

  it('checks the code, saves a new country with POST and keeps Save disabled until New', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Country Code'), 'ZZT1');
    await user.tab(); // the code is committed on blur, like the Knockout value binding
    await user.type(field('Country Name'), 'Zedland');
    await user.click(screen.getByRole('combobox', { name: 'Cargo Movement' }));
    await user.click(await screen.findByRole('option', { name: 'Imports' }));
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
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
    expect(save()).toBeDisabled();

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(save()).toBeEnabled();
    expect(field('Country Code')).toHaveValue('');
    expect(field('Country Name')).toHaveValue('');
    expect(screen.getByRole('combobox', { name: 'Cargo Movement' })).toHaveTextContent('Both');
  });

  it('refuses a code that already exists in New mode without posting', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Country Code'), 'IND');
    await user.type(field('Country Name'), 'India again');
    await user.click(save());

    expect(await screen.findByText('Country Code Already Exist')).toBeInTheDocument();
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
    expect(save()).toBeEnabled();
  });

  it('shows the server message when the save fails and lets the user try again', async () => {
    const user = userEvent.setup();
    saveReply = () => ({
      status: 400,
      data: { code: 'VALIDATION_FAILED', errors: { CountryName: ['Too long'] } },
    });
    setup();

    await user.type(field('Country Code'), 'ZZT1');
    await user.type(field('Country Name'), 'Zedland');
    await user.click(save());

    expect(await screen.findByText('Data not Saved [Too long]')).toBeInTheDocument();
    expect(save()).toBeEnabled();
  });

  it('maps a 409 from the server to the legacy "already exist" text', async () => {
    const user = userEvent.setup();
    saveReply = () => ({ status: 409, data: { code: 'COUNTRY_CODE_EXISTS' } });
    setup();

    await user.type(field('Country Code'), 'ZZT1');
    await user.type(field('Country Name'), 'Zedland');
    await user.click(save());

    expect(await screen.findByText('Country Code Already Exist')).toBeInTheDocument();
  });

  it('in Change mode locks the code, lists countries, loads the picked one and saves with PUT', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'Change');
    expect(field('Country Code')).toHaveAttribute('readonly');
    await pickFromList(user, 'MALAYSIA');

    await waitFor(() => expect(field('Country Name')).toHaveValue('MALAYSIA'));
    expect(field('Country Code')).toHaveValue('MYS');
    expect(screen.getByRole('combobox', { name: 'Cargo Movement' })).toHaveTextContent('Export');

    await user.clear(field('Country Name'));
    await user.type(field('Country Name'), 'MALAYSIA (MY)');
    await user.click(save());

    expect(await screen.findByText('Data Saved Successfully')).toBeInTheDocument();
    const put = calls.find((c) => c.method === 'PUT');
    expect(put?.url).toBe(`${BASE}/MYS`);
    expect(put?.body).toEqual({ countryName: 'MALAYSIA (MY)', cargoMovement: 'Export' });
  });

  it('lists the countries in New mode without filling the form', async () => {
    const user = userEvent.setup();
    setup();

    await pickFromList(user, 'INDIA');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(field('Country Code')).toHaveValue('');
    expect(field('Country Name')).toHaveValue('');
  });

  it('in View mode loads a record, locks the fields and disables Save; New unlocks them', async () => {
    const user = userEvent.setup();
    setup();

    await chooseOption(user, 'View');
    expect(save()).toBeDisabled();
    await pickFromList(user, 'INDIA');

    await waitFor(() => expect(field('Country Name')).toHaveValue('INDIA'));
    await waitFor(() => expect(field('Country Name')).toHaveAttribute('readonly'));
    expect(document.getElementById('btnCountryCode')).toBeDisabled();
    expect(save()).toBeDisabled();

    await chooseOption(user, 'New');
    expect(field('Country Name')).not.toHaveAttribute('readonly');
    expect(document.getElementById('btnCountryCode')).toBeEnabled();
    expect(save()).toBeEnabled();
  });

  it('shows the pre-entered box while a new name is typed, narrows it, and hides it on blur', async () => {
    const user = userEvent.setup();
    setup();

    await user.type(field('Country Name'), 'M');
    const box = await screen.findByText('Pre-Entered Supplier Listing');
    expect(box).toBeInTheDocument();
    const table = document.getElementById('tblPdata') as HTMLElement;
    expect(within(table).getByText('MALAYSIA')).toBeInTheDocument();
    expect(calls.some((c) => c.url === `${BASE}/search` && c.params?.name === 'M')).toBe(true);

    await user.type(field('Country Name'), 'AL');
    expect(within(table).getByText('MALAYSIA')).toBeInTheDocument();
    await user.type(field('Country Name'), 'X');
    expect(within(table).queryByText('MALAYSIA')).not.toBeInTheDocument();

    await user.tab();
    expect(screen.queryByText('Pre-Entered Supplier Listing')).not.toBeInTheDocument();
  });
});
