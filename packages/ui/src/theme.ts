import { createTheme, type Theme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

/**
 * Theme tokens. All colours, spacing, typography and scanner sizing live here and nowhere else.
 * Application code reads them through the MUI theme (sx="primary.main", theme.spacing, theme.cims).
 * Design rationale: legacy workspace docs/19-ux-design-principles.md, sections 8 (tokens) and 8.1 (theme modes).
 *
 * Two colour schemes, light (default, bright halls) and dark (night shifts, office preference). Colours that differ per
 * scheme are CSS variables at run time, so `theme.cims.status.*` and `theme.cims.focusRing.color` hold `var(...)`
 * references, not hex values; read the hex values from `cimsTokens` only for documentation and tests.
 */
export const cimsTokens = {
  /** Light scheme. */
  palette: {
    primary: '#0d4a8a',
    secondary: '#546e7a',
    success: '#2e7d32',
    error: '#c62828',
    warning: '#ed6c02',
    info: '#0277bd',
    background: '#f4f6f8',
    paper: '#ffffff',
    /** Body text 15:1 and secondary text 7:1 on the background, for bright warehouse halls. */
    textPrimary: '#1a2027',
    textSecondary: '#4a5561',
    divider: '#d5dbe1',
  },
  /** Dark scheme. Text 14–16:1 and secondary text 8:1; primary is a light blue with dark text on filled buttons. */
  darkPalette: {
    primary: '#82b4f2',
    primaryContrastText: '#0a1929',
    secondary: '#90a4ae',
    success: '#66bb6a',
    error: '#f47373',
    warning: '#ffa726',
    info: '#4fc3f7',
    background: '#0f1419',
    paper: '#171d24',
    textPrimary: '#e6edf3',
    textSecondary: '#a9b4c0',
    divider: '#33404d',
  },
  /**
   * Status colours for chips, hints and banners (light scheme). `fg` on `bg` and `fg` on white both pass WCAG AA (4.5:1)
   * for text; `main` is the border/icon colour (3:1 or more). Status is never shown by colour alone: always with an icon
   * and a word.
   */
  status: {
    success: { main: '#2e7d32', fg: '#1b5e20', bg: '#e8f5e9' },
    warning: { main: '#ed6c02', fg: '#7a4100', bg: '#fff3e0' },
    error: { main: '#c62828', fg: '#b71c1c', bg: '#fdecea' },
    info: { main: '#0277bd', fg: '#01579b', bg: '#e3f2fd' },
    neutral: { main: '#78909c', fg: '#37474f', bg: '#eceff1' },
  },
  /** Status colours of the dark scheme: `fg` on `bg` 9:1 or more, `main` on paper 6:1 or more. */
  darkStatus: {
    success: { main: '#66bb6a', fg: '#a5d6a7', bg: '#14291a' },
    warning: { main: '#ffa726', fg: '#ffcc80', bg: '#2e2210' },
    error: { main: '#f47373', fg: '#ffb4ab', bg: '#3b1716' },
    info: { main: '#4fc3f7', fg: '#a6dcff', bg: '#0d2533' },
    neutral: { main: '#90a4ae', fg: '#cfd8dc', bg: '#232c33' },
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    /** Base font size in px (MUI default). 13 px was too small for bright halls and long shifts (docs/19 section 8). */
    fontSize: 14,
  },
  /** Corner radius in px. */
  radius: 6,
  /** Spacing unit in px (theme.spacing(1)). */
  spacing: 8,
  /** Sizing for scanner stations (hand-held and fixed scanners). */
  scanner: {
    inputFontSize: '1.125rem',
    inputMinHeight: 44,
  },
  /** Keyboard focus ring: thick and offset so it shows on any background and under glare. */
  focusRing: {
    width: 3,
    offset: 2,
    color: '#0b5cad',
    darkColor: '#9cc3ff',
  },
  /** Page anatomy: paddings and widths used by PageShell and the page templates (spacing units unless noted). */
  layout: {
    pagePaddingX: { xs: 2, md: 3 },
    pagePaddingY: 2,
    sectionGap: 2,
    /** px */
    contentMaxWidth: 1680,
    /** px, width of the side panel of OperationalPage / list of MasterDataPage at md and up. */
    asideWidth: { narrow: 320, wide: 420 },
  },
  /** Minimum size of a click/touch target for primary actions (px; WCAG 2.5.5 and gloved hands). */
  density: {
    touchTarget: 44,
  },
} as const;

export interface CimsStatusColour {
  main: string;
  fg: string;
  bg: string;
}

export type CimsStatusTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

export interface CimsThemeTokens {
  scanner: {
    inputFontSize: string;
    inputMinHeight: number;
  };
  /** CSS variable references that follow the active colour scheme. */
  status: Record<CimsStatusTone, CimsStatusColour>;
  focusRing: { width: number; offset: number; color: string };
  layout: {
    pagePaddingX: { xs: number; md: number };
    pagePaddingY: number;
    sectionGap: number;
    contentMaxWidth: number;
    asideWidth: { narrow: number; wide: number };
  };
  density: { touchTarget: number };
}

declare module '@mui/material/styles' {
  interface Theme {
    cims: CimsThemeTokens;
  }
  interface ThemeOptions {
    cims?: CimsThemeTokens;
  }
  interface Palette {
    status: Record<CimsStatusTone, CimsStatusColour>;
    focusRing: string;
  }
  interface PaletteOptions {
    status?: Record<CimsStatusTone, CimsStatusColour>;
    focusRing?: string;
  }
}

/** The colour-scheme storage keys. They equal Toolpad's, so the shell (Toolpad AppProvider) and pages outside it agree. */
export const CIMS_MODE_STORAGE_KEY = 'toolpad-mode';
export const CIMS_COLOR_SCHEME_STORAGE_KEY = 'toolpad-color-scheme';

/** CSS variable for a palette path, e.g. cssVar('status-success-fg') -> var(--mui-palette-status-success-fg). */
const paletteVar = (path: string) => `var(--mui-palette-${path})`;

const statusVars = Object.fromEntries(
  (['success', 'warning', 'error', 'info', 'neutral'] as const).map((tone) => [
    tone,
    {
      main: paletteVar(`status-${tone}-main`),
      fg: paletteVar(`status-${tone}-fg`),
      bg: paletteVar(`status-${tone}-bg`),
    },
  ]),
) as Record<CimsStatusTone, CimsStatusColour>;

const ring = cimsTokens.focusRing;
const focusOutline = {
  outline: `${ring.width}px solid ${paletteVar('focusRing')}`,
  outlineOffset: ring.offset,
} as const;

const light = cimsTokens.palette;
const dark = cimsTokens.darkPalette;

/**
 * The CIMS theme: light and dark colour schemes on CSS variables (selector `[data-light]` / `[data-dark]` on <html>),
 * default mode "system" (follows prefers-color-scheme), dense defaults (small inputs, compact tables).
 */
export const cimsTheme: Theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: light.primary },
        secondary: { main: light.secondary },
        success: { main: light.success },
        error: { main: light.error },
        warning: { main: light.warning },
        info: { main: light.info },
        background: { default: light.background, paper: light.paper },
        text: { primary: light.textPrimary, secondary: light.textSecondary },
        divider: light.divider,
        status: cimsTokens.status,
        focusRing: ring.color,
      },
    },
    dark: {
      palette: {
        primary: { main: dark.primary, contrastText: dark.primaryContrastText },
        secondary: { main: dark.secondary },
        success: { main: dark.success },
        error: { main: dark.error },
        warning: { main: dark.warning },
        info: { main: dark.info },
        background: { default: dark.background, paper: dark.paper },
        text: { primary: dark.textPrimary, secondary: dark.textSecondary },
        divider: dark.divider,
        status: cimsTokens.darkStatus,
        focusRing: ring.darkColor,
      },
    },
  },
  typography: {
    fontFamily: cimsTokens.typography.fontFamily,
    fontSize: cimsTokens.typography.fontSize,
    // Type scale: one page title (h1), section titles (h2), group titles (h3). Weights, not sizes, carry hierarchy
    // inside dense screens.
    h1: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.3 },
    h2: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.35 },
    h3: { fontSize: '1rem', fontWeight: 600, lineHeight: 1.4 },
    h5: { fontWeight: 600 },
    subtitle1: { fontWeight: 500 },
    subtitle2: { fontWeight: 600 },
    overline: { fontWeight: 600, letterSpacing: '0.08em', lineHeight: 1.6 },
    // Sentence-case buttons read faster than all caps (docs/19 section 11).
    button: { textTransform: 'none', fontWeight: 600 },
  },
  shape: { borderRadius: cimsTokens.radius },
  spacing: cimsTokens.spacing,
  cims: {
    scanner: {
      inputFontSize: cimsTokens.scanner.inputFontSize,
      inputMinHeight: cimsTokens.scanner.inputMinHeight,
    },
    status: statusVars,
    focusRing: { width: ring.width, offset: ring.offset, color: paletteVar('focusRing') },
    layout: cimsTokens.layout,
    density: cimsTokens.density,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // Respect the operating system's reduced-motion setting everywhere (WCAG 2.3.3).
        '@media (prefers-reduced-motion: reduce)': {
          '*, *::before, *::after': {
            animationDuration: '0.01ms !important',
            animationIterationCount: '1 !important',
            transitionDuration: '0.01ms !important',
            scrollBehavior: 'auto !important',
          },
        },
        kbd: {
          fontFamily: 'inherit',
          fontSize: '0.75rem',
          fontWeight: 600,
          padding: '1px 6px',
          borderRadius: 4,
          border: `1px solid ${paletteVar('divider')}`,
          borderBottomWidth: 2,
          backgroundColor: paletteVar('background-paper'),
          color: paletteVar('text-primary'),
          whiteSpace: 'nowrap',
        },
      },
    },
    // Visible keyboard focus on every button, checkbox, tab, list item and menu item.
    MuiButtonBase: {
      styleOverrides: {
        root: { '&.Mui-focusVisible': focusOutline },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          '&.Mui-focused': {
            boxShadow: `0 0 0 3px rgba(${paletteVar('primary-mainChannel')} / 0.25)`,
          },
          // Read-only values (a record in view mode, display fields) look different from fields that take input.
          '&.MuiInputBase-readOnly': {
            backgroundColor: paletteVar('action-hover'),
            '& .MuiOutlinedInput-notchedOutline': { borderStyle: 'dashed' },
          },
        },
      },
    },
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiButton: { defaultProps: { size: 'small', disableElevation: true } },
    MuiIconButton: { defaultProps: { size: 'small' } },
    MuiTable: { defaultProps: { size: 'small' } },
    MuiDataGrid: {
      defaultProps: { density: 'compact' },
      styleOverrides: {
        columnHeaderTitle: { fontWeight: 600 },
        cell: { '&:focus-visible, &:focus-within': { outlineOffset: -2 } },
      },
    },
    MuiPaper: { defaultProps: { variant: 'outlined' } },
  },
});
