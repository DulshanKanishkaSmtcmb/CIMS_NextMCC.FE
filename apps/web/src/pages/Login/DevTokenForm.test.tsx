import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetClient } from '@cims/api-client';
import { getDevToken } from '../../auth/devToken';
import { installMockApi } from '../../test/mockApi';
import { renderWithProviders } from '../../test/renderWithProviders';
import { DevTokenForm } from './DevTokenForm';

function jwt(claims: Record<string, unknown>): string {
  const encode = (value: unknown) => btoa(JSON.stringify(value)).replace(/=+$/, '');
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(claims)}.signature`;
}

const inOneHour = Math.floor(Date.now() / 1000) + 3600;
const token = jwt({ sub: 'Madhuka', username: 'Madhuka', tenant: 'NextMCC', exp: inOneHour });

beforeEach(() => window.sessionStorage.clear());
afterEach(() => resetClient());

describe('DevTokenForm', () => {
  it('"Get dev token" asks the API for a token for the typed user and signs in with it', async () => {
    const calls = installMockApi(() => ({
      status: 200,
      data: { token, expiresAt: '2026-10-18T20:00:00+00:00', claims: { username: 'Madhuka' } },
    }));
    const { store } = renderWithProviders(<DevTokenForm />);

    expect(screen.getByRole('button', { name: 'Get dev token' })).toBeDisabled();
    await userEvent.type(screen.getByLabelText('User name'), '  Madhuka ');
    await userEvent.click(screen.getByRole('button', { name: 'Get dev token' }));

    await waitFor(() => expect(store.getState().auth.status).toBe('authenticated'));
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: '/api/v1/dev/token',
      body: { username: 'Madhuka' },
    });
    expect(store.getState().auth.profile?.username).toBe('Madhuka');
    expect(getDevToken()).toBe(token);
    expect(screen.getByLabelText('Dev bearer token')).toHaveValue(token);
  });

  it('shows the API message and stays signed out when the user is unknown', async () => {
    installMockApi(() => ({ status: 404, data: { title: 'unknown user', status: 404 } }));
    const { store } = renderWithProviders(<DevTokenForm />);

    await userEvent.type(screen.getByLabelText('User name'), 'nobody');
    await userEvent.click(screen.getByRole('button', { name: 'Get dev token' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('unknown user');
    expect(store.getState().auth.status).not.toBe('authenticated');
    expect(getDevToken()).toBeNull();
  });

  it('shows the signing-key hint the API sends with a 503', async () => {
    installMockApi(() => ({
      status: 503,
      data: {
        title: 'No DevJwt signing key is configured.',
        detail: 'Run once: dotnet user-jwts create --scheme DevJwt',
      },
    }));
    renderWithProviders(<DevTokenForm />);

    await userEvent.type(screen.getByLabelText('User name'), 'Madhuka');
    await userEvent.click(screen.getByRole('button', { name: 'Get dev token' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'dotnet user-jwts create --scheme DevJwt',
    );
  });

  it('still signs in with a pasted token', async () => {
    const calls = installMockApi(() => undefined);
    const { store } = renderWithProviders(<DevTokenForm />);

    // userEvent.paste: a JWT contains characters that user-event's type() treats as key syntax.
    await userEvent.click(screen.getByLabelText('Dev bearer token'));
    await userEvent.paste(token);
    await userEvent.click(screen.getByRole('button', { name: 'Use dev token' }));

    expect(store.getState().auth.status).toBe('authenticated');
    expect(calls).toHaveLength(0);
  });
});
