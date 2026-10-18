import { parseTenants, type SessionInfo } from './profile';

/**
 * DEVELOPMENT ONLY: sign in with a bearer token minted locally by `dotnet user-jwts` (the API's DevJwt scheme), for
 * machines that cannot reach CIMS Identity. The token comes from VITE_DEV_BEARER_TOKEN (.env.local), is pasted on the
 * sign-in page, or is fetched there from the API's Development-only POST /api/v1/dev/token ("Get dev token"); it is
 * kept in sessionStorage for the tab. Every function is inert outside `vite dev`
 * (import.meta.env.DEV is false in production builds, so the code is dropped from the bundle), unless the build sets
 * VITE_ENABLE_DEV_TOKEN=true: the API repo's local gateway (deploy/dev-gateway) builds the SPA that way because CIMS
 * Identity is not reachable there either. A deployed build never sets it.
 */
const STORAGE_KEY = 'cims.devBearerToken';

export const devTokenEnabled =
  import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEV_TOKEN === 'true';

export function getDevToken(): string | null {
  if (!devTokenEnabled) return null;
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored) return stored;
  } catch {
    // Storage blocked: fall back to the env variable.
  }
  return import.meta.env.VITE_DEV_BEARER_TOKEN?.trim() || null;
}

export function setDevToken(token: string): void {
  if (!devTokenEnabled) return;
  window.sessionStorage.setItem(STORAGE_KEY, token.trim());
}

export function clearDevToken(): void {
  if (!devTokenEnabled) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

function decodePayload(token: string): Record<string, unknown> | null {
  const part = token.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part
      .replace(/-/g, '+')
      .replace(/_/g, '/')
      .padEnd(Math.ceil(part.length / 4) * 4, '=');
    const json = decodeURIComponent(
      Array.from(atob(base64), (c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`).join(''),
    );
    const payload: unknown = JSON.parse(json);
    return payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * Profile for Redux from the token's claims (username, sub, exp). Null when the token cannot be read or has expired.
 * The token is NOT verified here; the API verifies it on every call.
 */
export function sessionFromDevToken(token: string, now: number = Date.now()): SessionInfo | null {
  const claims = decodePayload(token);
  if (!claims) return null;
  if (typeof claims.exp === 'number' && claims.exp * 1000 <= now) return null;

  const text = (key: string): string | null =>
    typeof claims[key] === 'string' && claims[key] ? (claims[key] as string) : null;
  const username = text('username') ?? text('unique_name') ?? text('sub');
  return {
    profile: {
      sub: text('sub') ?? username ?? 'dev',
      name: username ?? 'Developer',
      username,
      email: null,
    },
    // Only a "tenants" claim selects an X-Tenant header; a plain "tenant" claim is used by the API directly.
    allowedTenants: parseTenants(claims.tenants),
  };
}
