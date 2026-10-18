import type { ReactNode } from 'react';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, type Theme } from '@mui/material/styles';
import { SnackbarProvider } from 'notistack';
import { ScanFeedbackProvider } from './components/scanFeedback/ScanFeedbackProvider';
import type { ScanFeedbackConfig } from './components/scanFeedback/ScanFeedbackContext';
import { cimsTheme } from './theme';

export interface CimsThemeProviderProps {
  children: ReactNode;
  /** Override the theme. Defaults to cimsTheme. */
  theme?: Theme;
  /** Sound URLs, mute and volume for useScanFeedback(). */
  scanFeedback?: ScanFeedbackConfig;
  /** Most toasts shown at once. Default 3. */
  maxToasts?: number;
}

/** Wrap the application once: theme, CSS reset, toasts and scan feedback settings. */
export function CimsThemeProvider({
  children,
  theme = cimsTheme,
  scanFeedback,
  maxToasts = 3,
}: CimsThemeProviderProps) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
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
