import { alpha, createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

/**
 * Theme tokens. All colours, spacing, typography and scanner sizing live here and nowhere else.
 * Application code reads them through the MUI theme (sx="primary.main", theme.spacing, theme.cims).
 * Design rationale: legacy workspace docs/19-ux-design-principles.md, section 8.
 */
export const cimsTokens = {
  palette: {
    primary: '#0d4a8a',
    secondary: '#546e7a',
    success: '#2e7d32',
    error: '#c62828',
    warning: '#ed6c02',
    info: '#0277bd',
    background: '#f4f6f8',
    paper: '#ffffff',
    /** Body text and secondary text: at least 7:1 and 4.5:1 on the background, for bright warehouse halls. */
    textPrimary: '#1a2027',
    textSecondary: '#4a5561',
    divider: '#d5dbe1',
  },
  /**
   * Status colours for chips, hints and banners. `fg` on `bg` and `fg` on white both pass WCAG AA (4.5:1) for text;
   * `main` is the border/icon colour. Status is never shown by colour alone: always with an icon and a word.
   */
  status: {
    success: { main: '#2e7d32', fg: '#1b5e20', bg: '#e8f5e9' },
    warning: { main: '#ed6c02', fg: '#7a4100', bg: '#fff3e0' },
    error: { main: '#c62828', fg: '#b71c1c', bg: '#fdecea' },
    info: { main: '#0277bd', fg: '#01579b', bg: '#e3f2fd' },
    neutral: { main: '#78909c', fg: '#37474f', bg: '#eceff1' },
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
}

const ring = cimsTokens.focusRing;
const focusOutline = {
  outline: `${ring.width}px solid ${ring.color}`,
  outlineOffset: ring.offset,
} as const;

/** Light theme with dense defaults (small inputs, compact tables) for scanner stations. */
export const cimsTheme = createTheme({
  cssVariables: true,
  palette: {
    mode: 'light',
    primary: { main: cimsTokens.palette.primary },
    secondary: { main: cimsTokens.palette.secondary },
    success: { main: cimsTokens.palette.success },
    error: { main: cimsTokens.palette.error },
    warning: { main: cimsTokens.palette.warning },
    info: { main: cimsTokens.palette.info },
    background: {
      default: cimsTokens.palette.background,
      paper: cimsTokens.palette.paper,
    },
    text: {
      primary: cimsTokens.palette.textPrimary,
      secondary: cimsTokens.palette.textSecondary,
    },
    divider: cimsTokens.palette.divider,
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
    status: cimsTokens.status,
    focusRing: cimsTokens.focusRing,
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
          border: `1px solid ${cimsTokens.palette.divider}`,
          borderBottomWidth: 2,
          backgroundColor: cimsTokens.palette.paper,
          color: cimsTokens.palette.textPrimary,
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
          '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(cimsTokens.palette.primary, 0.2)}` },
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
