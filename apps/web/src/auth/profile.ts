import type { User } from 'oidc-client-ts';
import type { Tenant } from '@cims/ui';

export interface UserProfile {
  sub: string;
  name: string;
  username: string | null;
  email: string | null;
}

export interface SessionInfo {
  profile: UserProfile;
  allowedTenants: Tenant[];
}

/**
 * Name of the token claim that lists the tenants a user may work in.
 * ASSUMPTION: Identity has not defined it yet (plan section 4.2). Confirm with the Identity team.
 */
export const TENANTS_CLAIM = 'tenants';

function toTenant(entry: unknown): Tenant | null {
  if (typeof entry === 'string') {
    const id = entry.trim();
    return id ? { id, name: id } : null;
  }
  if (entry && typeof entry === 'object') {
    const { id, name } = entry as { id?: unknown; name?: unknown };
    if (typeof id === 'string' && id.trim()) {
      return {
        id: id.trim(),
        name: typeof name === 'string' && name.trim() ? name.trim() : id.trim(),
      };
    }
  }
  return null;
}

/** Accepts a JSON array, an array of strings or objects, or a comma, semicolon or space separated string. */
export function parseTenants(claim: unknown): Tenant[] {
  let entries: unknown[] = [];
  if (Array.isArray(claim)) {
    entries = claim;
  } else if (typeof claim === 'string') {
    const text = claim.trim();
    if (text.startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(text);
        entries = Array.isArray(parsed) ? parsed : [];
      } catch {
        entries = [];
      }
    } else {
      entries = text.split(/[\s,;]+/);
    }
  }

  const seen = new Set<string>();
  const tenants: Tenant[] = [];
  for (const entry of entries) {
    const tenant = toTenant(entry);
    if (tenant && !seen.has(tenant.id)) {
      seen.add(tenant.id);
      tenants.push(tenant);
    }
  }
  return tenants;
}

/** What the app keeps in Redux about a signed-in user. No tokens. */
export function sessionFromUser(user: User): SessionInfo {
  const claims = user.profile as Record<string, unknown>;
  const text = (key: string): string | null =>
    typeof claims[key] === 'string' && claims[key] ? (claims[key] as string) : null;

  const username = text('preferred_username');
  return {
    profile: {
      sub: user.profile.sub,
      name: text('name') ?? username ?? user.profile.sub,
      username,
      email: text('email'),
    },
    allowedTenants: parseTenants(claims[TENANTS_CLAIM]),
  };
}
