import { UserManager } from 'oidc-client-ts';
import { env } from '../config/env';
import { PATHS } from '../routes/paths';

export const OIDC_SCOPE = 'openid profile cims.nextmcc';

/**
 * Public client using authorization code + PKCE. There is no client secret and no password grant in
 * the browser. oidc-client-ts keeps the tokens in its own store (session storage by default);
 * they are never copied into Redux.
 */
export function createUserManager(origin: string = window.location.origin): UserManager {
  return new UserManager({
    authority: env.identityAuthority,
    client_id: env.clientId,
    redirect_uri: `${origin}${PATHS.authCallback}`,
    post_logout_redirect_uri: `${origin}${PATHS.login}`,
    // Silent renew loads the callback route in a hidden iframe; main.tsx handles that case.
    silent_redirect_uri: `${origin}${PATHS.authCallback}`,
    response_type: 'code',
    scope: OIDC_SCOPE,
    automaticSilentRenew: true,
  });
}

export const userManager = createUserManager();
