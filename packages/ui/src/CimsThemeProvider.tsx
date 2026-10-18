import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, type Theme } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import { ScanFeedbackProvider } from './components/scanFeedback/ScanFeedbackProvider';
import type { ScanFeedbackConfig } from './components/scanFeedback/ScanFeedbackContext';
import { CIMS_COLOR_SCHEME_STORAGE_KEY, CIMS_MODE_STORAGE_KEY, cimsTheme } from './theme';

export type CimsThemeMode = 'light' | 'dark' | 'system';

export interface CimsThemeProviderProps {
  children: ReactNode;
  /** Override the theme. Defaults to cimsTheme. */
  theme?: Theme;
  /** Mode before the user chooses one (ThemeModeToggle). Default "system": follows prefers-color-scheme. */
  defaultMode?: CimsThemeMode;
  /** Sound URLs, mute and volume for useScanFeedback(). */
  scanFeedback?: ScanFeedbackConfig;
  /** Most toasts shown at once. Default 3. */
  maxToasts?: number;
}

/**
 * Wrap the app once: theme with light/dark colour schemes (choice kept in localStorage under the same key as the
 * Toolpad shell), CSS reset, toasts and scan feedback settings.
 */
export function CimsThemeProvider({
  children,
  theme = cimsTheme,
  defaultMode = 'system',
  scanFeedback,
  maxToasts = 3,
}: CimsThemeProviderProps) {
  return (
    <ThemeProvider
      theme={theme}
      defaultMode={defaultMode}
      modeStorageKey={CIMS_MODE_STORAGE_KEY}
      colorSchemeStorageKey={CIMS_COLOR_SCHEME_STORAGE_KEY}
      disableTransitionOnChange
    >
      <CssBaseline enableColorScheme />
      <SnackbarProvider
        maxSnack={maxToasts}
        autoHideDuration={3000}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <ScanFeedbackProvider {...scanFeedback}>{children}</ScanFeedbackProvider>
      </SnackbarProvider>
    </ThemeProvider>
  );
}
