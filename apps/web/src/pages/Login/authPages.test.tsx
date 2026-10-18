import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/renderWithProviders';

const { signinRedirect, signinCallback, create, loadPage } = vi.hoisted(() => ({
  signinRedirect: vi.fn(),
  signinCallback: vi.fn(),
  create: vi.fn(),
  loadPage: vi.fn(),
}));

vi.mock('../../auth/userManager', () => ({
  userManager: { signinRedirect, signinCallback },
}));

vi.mock('@cims/api-client', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@cims/api-client')>()),
  legacySession: { create },
}));

vi.mock('../../utils/loadPage', () => ({ loadPage }));

import { AuthCallbackPage } from '../AuthCallback/AuthCallbackPage';
import { LoginPage } from './LoginPage';
import { signedInState } from '../../test/renderWithProviders';

beforeEach(() => {
  signinRedirect.mockReset().mockResolvedValue(undefined);
  signinCallback.mockReset();
  create.mockReset();
  loadPage.mockReset();
  window.sessionStorage.clear();
});

describe('LoginPage at the legacy /Account/Login (flipped at the gateway)', () => {
  function renderSignedIn(route: string) {
    return renderWithProviders(
      <Routes>
        <Route path="/Account/Login" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/Data/ConfirmArrival" element={<div>arrival page</div>} />
        <Route path="/Home/Index" element={<div>home page</div>} />
      </Routes>,
      { route, preloadedState: signedInState },
    );
  }

  it('issues the legacy cookie, then loads the ReturnUrl in full so the gateway routes it', async () => {
    create.mockResolvedValue({ available: true, status: 200 });

    renderSignedIn('/Account/Login?ReturnUrl=%2FData%2FContainersAllocation%3Fx%3D1');

    await waitFor(() => expect(loadPage).toHaveBeenCalledWith('/Data/ContainersAllocation?x=1'));
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('never leaves the site through ReturnUrl', async () => {
    create.mockResolvedValue({ available: true, status: 200 });

    renderSignedIn('/Account/Login?ReturnUrl=https%3A%2F%2Fevil.example%2F');

    await waitFor(() => expect(loadPage).toHaveBeenCalledWith('/Home/Index'));
  });

  it('stops with a message when the legacy app sends the user straight back', async () => {
    create.mockResolvedValue({ available: true, status: 200 });
    window.sessionStorage.setItem(
      'cims.legacyReturn',
      JSON.stringify({ path: '/Home/Index', at: Date.now() - 1000 }),
    );

    renderSignedIn('/Account/Login?ReturnUrl=%2FHome%2FIndex');

    expect(await screen.findByText(/did not accept your session/)).toBeInTheDocument();
    expect(loadPage).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('on /login without ReturnUrl, issues the legacy cookie and stays in the app router', async () => {
    create.mockRejectedValue(new Error('network'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderSignedIn('/login');

    expect(await screen.findByText('home page')).toBeInTheDocument();
    expect(create).toHaveBeenCalledTimes(1);
    expect(loadPage).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('marks the OIDC state for a full page load when the user came from a legacy page', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, {
      route: '/Account/Login?ReturnUrl=%2FHome%2FIndex',
      preloadedState: { auth: { status: 'unauthenticated', profile: null, allowedTenants: [] } },
    });

    await user.click(screen.getByRole('button', { name: /sign in with cims identity/i }));

    expect(signinRedirect).toHaveBeenCalledWith({
      state: { returnTo: '/Home/Index', fullPageLoad: true },
    });
  });
});

describe('LoginPage', () => {
  it('starts the Identity redirect and passes the return path in the OIDC state', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />, {
      route: '/login',
      preloadedState: { auth: { status: 'unauthenticated', profile: null, allowedTenants: [] } },
    });

    await user.click(screen.getByRole('button', { name: /sign in with cims identity/i }));

    expect(signinRedirect).toHaveBeenCalledWith({ state: { returnTo: '/Home/Index' } });
  });

  it('shows an error when the redirect cannot start', async () => {
    const user = userEvent.setup();
    signinRedirect.mockRejectedValue(new Error('metadata unreachable'));
    renderWithProviders(<LoginPage />, {
      route: '/login',
      preloadedState: { auth: { status: 'unauthenticated', profile: null, allowedTenants: [] } },
    });

    await user.click(screen.getByRole('button', { name: /sign in with cims identity/i }));

    expect(await screen.findByText('metadata unreachable')).toBeInTheDocument();
  });
});

describe('AuthCallbackPage', () => {
  const user = {
    profile: { sub: 'u1', name: 'Ann', preferred_username: 'ann', tenants: ['MCC', 'CFS'] },
    state: { returnTo: '/Data/ConfirmArrival' },
  };

  function renderCallback() {
    return renderWithProviders(
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="/Data/ConfirmArrival" element={<div>arrival page</div>} />
        <Route path="/Home/Index" element={<div>home page</div>} />
        <Route path="/login" element={<div>login page</div>} />
      </Routes>,
      { route: '/auth/callback?code=abc&state=xyz' },
    );
  }

  it('signs in, keeps only the profile in Redux, treats 501 as not available, and returns to the saved path', async () => {
    signinCallback.mockResolvedValue(user);
    create.mockResolvedValue({ available: false, status: 501 });

    const { store } = renderCallback();

    expect(await screen.findByText('arrival page')).toBeInTheDocument();
    expect(create).toHaveBeenCalledTimes(1);
    const state = store.getState();
    expect(state.auth.status).toBe('authenticated');
    expect(state.auth.profile?.name).toBe('Ann');
    expect(state.tenant.selectedTenantId).toBe('MCC');
    expect(JSON.stringify(state)).not.toMatch(/access_token|id_token|refresh_token/);
  });

  it('still signs the user in when the legacy session call fails', async () => {
    signinCallback.mockResolvedValue({ ...user, state: undefined });
    create.mockRejectedValue(new Error('network'));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    renderCallback();

    expect(await screen.findByText('home page')).toBeInTheDocument();
    warn.mockRestore();
  });

  it('shows the failure and a way back when the callback is rejected', async () => {
    signinCallback.mockRejectedValue(new Error('invalid_grant'));

    renderCallback();

    expect(await screen.findByText('invalid_grant')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Back to sign in' }));
    await waitFor(() => expect(screen.getByText('login page')).toBeInTheDocument());
    expect(create).not.toHaveBeenCalled();
  });
});
