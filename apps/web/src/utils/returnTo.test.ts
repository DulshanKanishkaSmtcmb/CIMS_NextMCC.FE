import { describe, expect, it } from 'vitest';
import { safeReturnTo } from './returnTo';

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
    [undefined],
    [42],
  ])('falls back to Home for %s', (value) => {
    expect(safeReturnTo(value)).toBe('/Home/Index');
  });
});
