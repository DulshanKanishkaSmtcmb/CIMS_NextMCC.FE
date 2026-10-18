import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import type { CssVarsTheme } from '@mui/material/styles';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { CIMS_MODE_STORAGE_KEY, cimsTheme, cimsTokens } from '../theme';
import { ThemeModeToggle } from './ThemeModeToggle';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-light');
  document.documentElement.removeAttribute('data-dark');
});

/** WCAG relative-luminance contrast ratio of two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('light and dark colour schemes', () => {
  it('defines both schemes and exposes scheme-dependent tokens as CSS variables', () => {
    const schemes = (cimsTheme as unknown as CssVarsTheme).colorSchemes;
    expect(Object.keys(schemes)).toEqual(expect.arrayContaining(['light', 'dark']));
    expect(cimsTheme.cims.status.success.fg).toBe('var(--mui-palette-status-success-fg)');
    expect(cimsTheme.cims.focusRing.color).toBe('var(--mui-palette-focusRing)');
    expect(schemes.dark?.palette.status.success.fg).toBe(cimsTokens.darkStatus.success.fg);
    expect(schemes.light?.palette.background.default).toBe(cimsTokens.palette.background);
  });

  it('meets WCAG AA text contrast in both schemes', () => {
    for (const [p, status] of [
      [cimsTokens.palette, cimsTokens.status],
      [cimsTokens.darkPalette, cimsTokens.darkStatus],
    ] as const) {
      expect(contrast(p.textPrimary, p.background)).toBeGreaterThanOrEqual(7);
      expect(contrast(p.textSecondary, p.paper)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(p.primary, p.paper)).toBeGreaterThanOrEqual(4.5);
      for (const tone of Object.values(status)) {
        expect(contrast(tone.fg, tone.bg)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tone.fg, p.paper)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(tone.main, p.paper)).toBeGreaterThanOrEqual(3);
      }
    }
    expect(contrast(cimsTokens.focusRing.color, cimsTokens.palette.background)).toBeGreaterThan(3);
    expect(
      contrast(cimsTokens.focusRing.darkColor, cimsTokens.darkPalette.background),
    ).toBeGreaterThan(3);
  });
});

describe('ThemeModeToggle', () => {
  it('starts in System mode and switches to Dark, stored for the next visit', async () => {
    const user = userEvent.setup();
    render(
      <CimsThemeProvider>
        <ThemeModeToggle />
      </CimsThemeProvider>,
    );

    const button = screen.getByRole('button', { name: /^Theme: System/ });
    await user.click(button);
    const menu = screen.getByRole('menu', { name: 'Theme' });
    expect(within(menu).getByRole('menuitemradio', { name: /System/ })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    await user.click(within(menu).getByRole('menuitemradio', { name: /Dark/ }));

    expect(await screen.findByRole('button', { name: 'Theme: Dark' })).toBeInTheDocument();
    await waitFor(() => expect(window.localStorage.getItem(CIMS_MODE_STORAGE_KEY)).toBe('dark'));
    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-dark'));
  });

  it("keeps each signed-in user's choice and restores it at sign-in", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem('cims-theme-mode:u2', 'light');
    const { rerender } = render(
      <CimsThemeProvider>
        <ThemeModeToggle userId="u1" />
      </CimsThemeProvider>,
    );

    await user.click(screen.getByRole('button', { name: /^Theme:/ }));
    await user.click(screen.getByRole('menuitemradio', { name: /Dark/ }));
    expect(window.localStorage.getItem('cims-theme-mode:u1')).toBe('dark');

    rerender(
      <CimsThemeProvider>
        <ThemeModeToggle userId="u2" />
      </CimsThemeProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Theme: Light' })).toBeInTheDocument();
  });
});
