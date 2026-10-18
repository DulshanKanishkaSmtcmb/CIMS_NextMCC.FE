import { screen } from '@testing-library/react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import type { RootState } from '../redux/store';
import { renderWithProviders, signedInState } from '../test/renderWithProviders';
import { ProtectedRoute } from './ProtectedRoute';

function LoginProbe() {
  const location = useLocation();
  return <div>login page, from {(location.state as { from?: string } | null)?.from}</div>;
}

function renderRoute(preloadedState: Partial<RootState>) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginProbe />} />
      <Route
        path="/Data/ConfirmArrival"
        element={
          <ProtectedRoute>
            <div>secret page</div>
          </ProtectedRoute>
        }
      />
    </Routes>,
    { route: '/Data/ConfirmArrival?x=1', preloadedState },
  );
}

describe('ProtectedRoute', () => {
  it('shows the page to a signed-in user', () => {
    renderRoute(signedInState);
    expect(screen.getByText('secret page')).toBeInTheDocument();
  });

  it('sends an anonymous user to sign in and remembers where they were going', () => {
    renderRoute({
      auth: { status: 'unauthenticated', profile: null, allowedTenants: [] },
    });
    expect(screen.getByText('login page, from /Data/ConfirmArrival?x=1')).toBeInTheDocument();
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
  });

  it('waits while the session is being restored', () => {
    renderRoute({
      auth: { status: 'initializing', profile: null, allowedTenants: [] },
    });
    expect(screen.getByText('Checking your session...')).toBeInTheDocument();
    expect(screen.queryByText('secret page')).not.toBeInTheDocument();
    expect(screen.queryByText(/login page/)).not.toBeInTheDocument();
  });
});
