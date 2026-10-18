import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { CimsThemeProvider } from '@cims/ui';
import { createAppStore } from '../redux/store';
import type { RootState } from '../redux/store';

interface Options {
  route?: string;
  preloadedState?: Partial<RootState>;
}

/** Renders with Redux, the CIMS theme and a memory router. Returns the store for assertions. */
export function renderWithProviders(
  ui: ReactElement,
  { route = '/', preloadedState }: Options = {},
) {
  const store = createAppStore(preloadedState);
  const result = render(
    <Provider store={store}>
      <CimsThemeProvider>
        <MemoryRouter initialEntries={[route]}>{ui}</MemoryRouter>
      </CimsThemeProvider>
    </Provider>,
  );
  return { store, ...result };
}

export const signedInState: Partial<RootState> = {
  auth: {
    status: 'authenticated',
    profile: { sub: 'u1', name: 'Test User', username: 'tuser', email: 'tuser@example.test' },
    allowedTenants: [
      { id: 'MCC', name: 'Next MCC' },
      { id: 'CFS', name: 'Next CFS' },
    ],
  },
  tenant: { selectedTenantId: 'MCC' },
};
