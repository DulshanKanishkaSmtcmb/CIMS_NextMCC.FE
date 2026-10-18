import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { renderWithProviders, signedInState } from '../test/renderWithProviders';

vi.mock('../auth/userManager', () => ({
  userManager: { signinRedirect: vi.fn(), signoutRedirect: vi.fn() },
}));

import { AppLayout } from './AppLayout';

describe('AppLayout', () => {
  it('shows the legacy-shaped menu, the tenant switcher and the routed page', async () => {
    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/Home/Index" element={<div>home content</div>} />
        </Route>
      </Routes>,
      { route: '/Home/Index', preloadedState: signedInState },
    );

    expect(await screen.findByText('home content')).toBeInTheDocument();
    // Toolpad renders the sidebar for desktop and mobile, so each title can appear more than once.
    expect((await screen.findAllByText('Home')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Data').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Reference').length).toBeGreaterThan(0);
    expect(screen.getByRole('combobox', { name: 'Tenant' })).toHaveTextContent('Next MCC');
  });

  it('links menu entries to the legacy URLs', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/Home/Index" element={<div>home content</div>} />
        </Route>
      </Routes>,
      { route: '/Home/Index', preloadedState: signedInState },
    );

    const homeLinks = await screen.findAllByRole('link', { name: 'Home' });
    expect(homeLinks.some((link) => link.getAttribute('href') === '/Home/Index')).toBe(true);

    await user.click(screen.getAllByText('Data')[0]!);
    const arrivalLinks = await screen.findAllByRole('link', { name: 'Confirm Arrival' });
    expect(arrivalLinks.some((link) => link.getAttribute('href') === '/Data/ConfirmArrival')).toBe(
      true,
    );
  });
});
