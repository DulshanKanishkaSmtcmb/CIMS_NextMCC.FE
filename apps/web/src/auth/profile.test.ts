import type { User } from 'oidc-client-ts';
import { describe, expect, it } from 'vitest';
import { parseTenants, sessionFromUser } from './profile';

describe('parseTenants', () => {
  it('reads an array of strings', () => {
    expect(parseTenants(['MCC', 'CFS'])).toEqual([
      { id: 'MCC', name: 'MCC' },
      { id: 'CFS', name: 'CFS' },
    ]);
  });

  it('reads an array of objects', () => {
    expect(parseTenants([{ id: 'MCC', name: 'Next MCC' }, { id: 'CFS' }])).toEqual([
      { id: 'MCC', name: 'Next MCC' },
      { id: 'CFS', name: 'CFS' },
    ]);
  });

  it('reads a delimited string and a JSON string', () => {
    expect(parseTenants('MCC, CFS;MCC').map((t) => t.id)).toEqual(['MCC', 'CFS']);
    expect(parseTenants('["A","B"]').map((t) => t.id)).toEqual(['A', 'B']);
  });

  it('ignores junk', () => {
    expect(parseTenants(undefined)).toEqual([]);
    expect(parseTenants(42)).toEqual([]);
    expect(parseTenants('[not json')).toEqual([]);
    expect(parseTenants([null, '', {}, 7])).toEqual([]);
  });
});

describe('sessionFromUser', () => {
  const user = (profile: Record<string, unknown>) => ({ profile }) as unknown as User;

  it('maps claims to a profile and tenants', () => {
    const session = sessionFromUser(
      user({
        sub: 's-1',
        name: 'Ann Perera',
        preferred_username: 'ann',
        email: 'ann@example.test',
        tenants: ['MCC'],
      }),
    );

    expect(session.profile).toEqual({
      sub: 's-1',
      name: 'Ann Perera',
      username: 'ann',
      email: 'ann@example.test',
    });
    expect(session.allowedTenants).toEqual([{ id: 'MCC', name: 'MCC' }]);
  });

  it('falls back to username, then sub, for the display name', () => {
    expect(sessionFromUser(user({ sub: 's-1', preferred_username: 'ann' })).profile.name).toBe(
      'ann',
    );
    expect(sessionFromUser(user({ sub: 's-1' })).profile.name).toBe('s-1');
  });
});
