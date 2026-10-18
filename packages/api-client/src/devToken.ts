import { post } from './client';

export const DEV_TOKEN_PATH = '/api/v1/dev/token';

export interface DevTokenResult {
  token: string;
  expiresAt: string;
  claims: Record<string, string>;
}

/**
 * DEVELOPMENT ONLY: the API's Development-only endpoint that mints a DevJwt token for a PwInfo user, answering 404
 * everywhere else. Used by the sign-in page of builds with VITE_ENABLE_DEV_TOKEN=true.
 */
export const devTokenApi = {
  /** POST /api/v1/dev/token. 404 "unknown user", 503 when the API has no DevJwt signing key yet. */
  create(username: string, validForHours?: number): Promise<DevTokenResult> {
    return post<DevTokenResult>(DEV_TOKEN_PATH, { username, validForHours });
  },
};
