import { describe, expect, it } from 'vitest';
import { legacyReturnUrl, safeReturnTo } from './returnTo';

describe('safeReturnTo', () => {
  it('keeps in-app paths with query strings', () => {
    expect(safeReturnTo('/Data/ConfirmArrival')).toBe('/Data/ConfirmArrival');
    expect(safeReturnTo('/Reference/FieldCaptions?x=1')).toBe('/Reference/FieldCaptions?x=1');
  });

  it.each([
    ['https://evil.example/x'],
    ['//evil.example'],
    ['/\\evil.example'],
    ['javascript:alert(1)'],
    ['relative/path'],
    ['/login'],
    ['/auth/callback?code=1'],
    ['/Account/Login?ReturnUrl=%2FHome%2FIndex'],
    ['/account/login'],
    [undefined],
    [42],
  ])('falls back to Home for %s', (value) => {
    expect(safeReturnTo(value)).toBe('/Home/Index');
  });
});

describe('legacyReturnUrl', () => {
  it('reads the decoded ReturnUrl that legacy pages put on the login redirect', () => {
    expect(legacyReturnUrl('?ReturnUrl=%2FData%2FConfirmArrival')).toBe('/Data/ConfirmArrival');
  });

  it('is null without one', () => {
    expect(legacyReturnUrl('')).toBeNull();
    expect(legacyReturnUrl('?ReturnUrl=')).toBeNull();
  });
});
