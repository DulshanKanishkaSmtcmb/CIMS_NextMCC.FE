import { configure } from '@cims/api-client';
import { clearDevToken, getDevToken } from '../auth/devToken';
import { userManager } from '../auth/userManager';
import { env } from '../config/env';
import { store } from '../redux/store';
import { signedOut } from '../redux/slices/authSlice';

/** Wires @cims/api-client to this app: base URL, token from oidc-client-ts, tenant from Redux, 401 handling. */
export function configureApi(): void {
  configure({
    baseURL: env.apiBaseUrl,
    // Development only: a `dotnet user-jwts` token (auth/devToken.ts) wins over the oidc session.
    getToken: async () => getDevToken() ?? (await userManager.getUser())?.access_token,
    getTenant: () => store.getState().tenant.selectedTenantId,
    onUnauthorized: () => {
      // The token was rejected. Forget the session so ProtectedRoute sends the user to sign in again.
      clearDevToken();
      store.dispatch(signedOut());
      void userManager.removeUser();
    },
  });
}
