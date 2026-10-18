import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosError } from 'axios';
import { configure, resetClient } from '@cims/api-client';
import { renderWithProviders, signedInState } from '../../test/renderWithProviders';
import { ConfirmArrivalPage } from './ConfirmArrivalPage';

const played: string[] = [];

class FakeAudio {
  volume = 1;
  currentTime = 0;
  constructor(public src: string) {}
  play() {
    played.push(this.src);
    return Promise.resolve();
  }
}

beforeEach(() => {
  played.length = 0;
  vi.stubGlobal('Audio', FakeAudio);
  // No API in this test: captions fall back to the built-in labels.
  configure({
    baseURL: 'http://api.test',
    axiosConfig: {
      adapter: async (config) => {
        throw new AxiosError('offline', 'ERR_NETWORK', config);
      },
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  resetClient();
});

describe('ConfirmArrivalPage', () => {
  it('moves from the first field to the second and lists the confirmed item', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfirmArrivalPage />, { preloadedState: signedInState });
    const contract = screen.getByLabelText('Contract No');
    const item = screen.getByLabelText('Item No');

    await user.type(contract, 'c-100{Enter}');
    expect(item).toHaveFocus();
    expect(contract).toHaveValue('C-100');

    await user.type(item, 'i-9{Enter}');
    expect(item).toHaveValue('');
    expect(item).toHaveFocus();
    expect(await screen.findByText('I-9')).toBeInTheDocument();
    expect(await screen.findByText('Item No I-9 confirmed')).toBeInTheDocument();
    expect(played).toHaveLength(2);
  });

  it('rejects an item scanned before the contract', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfirmArrivalPage />, { preloadedState: signedInState });

    await user.type(screen.getByLabelText('Item No'), 'i-9{Enter}');

    expect(await screen.findByText('Scan Contract No first')).toBeInTheDocument();
    expect(screen.getByLabelText('Contract No')).toHaveFocus();
    expect(screen.getByText('No items scanned yet')).toBeInTheDocument();
  });

  it('asks before clearing the list', async () => {
    const user = userEvent.setup();
    renderWithProviders(<ConfirmArrivalPage />, { preloadedState: signedInState });
    await user.type(screen.getByLabelText('Contract No'), 'c1{Enter}');
    await user.type(screen.getByLabelText('Item No'), 'i1{Enter}');

    await user.click(screen.getByRole('button', { name: 'Clear list' }));
    expect(screen.getByRole('dialog', { name: 'Clear scanned items?' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear' }));
    expect(await screen.findByText('No items scanned yet')).toBeInTheDocument();
  });
});
