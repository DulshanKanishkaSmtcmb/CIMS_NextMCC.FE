import { afterEach, describe, expect, it } from 'vitest';
import { clearDevToken, getDevToken, sessionFromDevToken, setDevToken } from './devToken';

const b64url = (value: unknown) =>
  btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const jwt = (payload: Record<string, unknown>) =>
  `${b64url({ alg: 'HS256' })}.${b64url(payload)}.sig`;

afterEach(() => clearDevToken());

describe('dev token (development only)', () => {
  it('builds the session from the username claim', () => {
    const token = jwt({ sub: 'Madhuka', username: 'Madhuka', tenant: 'NextMCC', exp: 4102444800 });
    expect(sessionFromDevToken(token)).toEqual({
      profile: { sub: 'Madhuka', name: 'Madhuka', username: 'Madhuka', email: null },
      allowedTenants: [],
    });
  });

  it('uses a tenants claim for the tenant switcher', () => {
    const token = jwt({ sub: 'u', tenants: ['NextMCC', 'NextCFS'] });
    expect(sessionFromDevToken(token)?.allowedTenants.map((t) => t.id)).toEqual([
      'NextMCC',
      'NextCFS',
    ]);
  });

  it('rejects expired and unreadable tokens', () => {
    expect(sessionFromDevToken(jwt({ sub: 'u', exp: 1000 }), 2_000_000)).toBeNull();
    expect(sessionFromDevToken('not-a-jwt')).toBeNull();
  });

  it('keeps a pasted token for the tab only', () => {
    setDevToken('  abc.def.ghi  ');
    expect(getDevToken()).toBe('abc.def.ghi');
    clearDevToken();
    expect(getDevToken()).toBeNull();
  });
});
