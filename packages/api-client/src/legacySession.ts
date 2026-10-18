import axios from 'axios';
import { post } from './client';

export const LEGACY_SESSION_PATH = '/api/v1/legacy-session';

export interface LegacySessionResult {
  /** True when the API issued the legacy cookie. False when the bridge is not available yet (HTTP 501). */
  available: boolean;
  status: number;
}

/**
 * Cookie bridge: after Identity sign-in the SPA asks the API to issue the legacy OWIN cookie so
 * not-yet-migrated pages on the same hostname keep working (modernization plan, section 4.3).
 */
export const legacySession = {
  /** POST /api/v1/legacy-session. HTTP 501 means "not available yet" and does not throw. */
  async create(): Promise<LegacySessionResult> {
    try {
      await post<unknown>(LEGACY_SESSION_PATH, undefined, { withCredentials: true });
      return { available: true, status: 200 };
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 501) {
        return { available: false, status: 501 };
      }
      throw error;
    }
  },
};
