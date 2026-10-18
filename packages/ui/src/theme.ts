import { createTheme } from '@mui/material/styles';
import type {} from '@mui/x-data-grid/themeAugmentation';

/**
 * Theme tokens. All colours, spacing, typography and scanner sizing live here and nowhere else.
 * Application code reads them through the MUI theme (sx="primary.main", theme.spacing, theme.cims).
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
  },
  typography: {
    fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif',
    /** Base font size in px. Dense, for data-heavy warehouse screens. */
    fontSize: 13,
  },
  /** Corner radius in px. */
  radius: 4,
  /** Spacing unit in px (theme.spacing(1)). */
  spacing: 8,
  /** Sizing for scanner stations (hand-held and fixed scanners). */
  scanner: {
    inputFontSize: '1.125rem',
    inputMinHeight: 44,
  },
} as const;

export interface CimsThemeTokens {
  scanner: {
    inputFontSize: string;
    inputMinHeight: number;
  };
}

declare module '@mui/material/styles' {
  interface Theme {
    cims: CimsThemeTokens;
  }
  interface ThemeOptions {
    cims?: CimsThemeTokens;
  }
}

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
  },
  typography: {
    fontFamily: cimsTokens.typography.fontFamily,
    fontSize: cimsTokens.typography.fontSize,
  },
  shape: { borderRadius: cimsTokens.radius },
  spacing: cimsTokens.spacing,
  cims: {
    scanner: {
      inputFontSize: cimsTokens.scanner.inputFontSize,
      inputMinHeight: cimsTokens.scanner.inputMinHeight,
    },
  },
  components: {
    MuiTextField: { defaultProps: { size: 'small', variant: 'outlined' } },
    MuiFormControl: { defaultProps: { size: 'small' } },
    MuiSelect: { defaultProps: { size: 'small' } },
    MuiButton: { defaultProps: { size: 'small', disableElevation: true } },
    MuiIconButton: { defaultProps: { size: 'small' } },
    MuiTable: { defaultProps: { size: 'small' } },
    MuiDataGrid: { defaultProps: { density: 'compact' } },
    MuiPaper: { defaultProps: { variant: 'outlined' } },
  },
});
