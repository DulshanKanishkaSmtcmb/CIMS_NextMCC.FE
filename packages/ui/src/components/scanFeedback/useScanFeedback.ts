import { useContext, useMemo } from 'react';
import { useSnackbar } from 'notistack';
import { ScanFeedbackContext, type ScanFeedbackConfig } from './ScanFeedbackContext';
import { DEFAULT_SOUND_URLS, playSound } from './sound';

export interface ScanFeedback {
  /** Play the success sound. */
  playSuccess: () => void;
  /** Play the error sound. */
  playError: () => void;
  /** Toast only. */
  notifySuccess: (message: string) => void;
  notifyError: (message: string) => void;
  notifyWarning: (message: string) => void;
  /** Success sound plus an optional success toast. */
  success: (message?: string) => void;
  /** Error sound plus an error toast. */
  error: (message: string) => void;
}

/** Audio and toast feedback for scans. Needs a notistack SnackbarProvider (CimsThemeProvider has one). */
export function useScanFeedback(options: ScanFeedbackConfig = {}): ScanFeedback {
  const context = useContext(ScanFeedbackContext);
  const { enqueueSnackbar } = useSnackbar();

  const successUrl =
    options.sounds?.success ?? context.sounds?.success ?? DEFAULT_SOUND_URLS.success;
  const errorUrl = options.sounds?.error ?? context.sounds?.error ?? DEFAULT_SOUND_URLS.error;
  const muted = options.muted ?? context.muted ?? false;
  const volume = options.volume ?? context.volume ?? 1;

  return useMemo<ScanFeedback>(() => {
    const playSuccess = () => {
      if (!muted) playSound(successUrl, volume);
    };
    const playError = () => {
      if (!muted) playSound(errorUrl, volume);
    };
    const notifySuccess = (message: string) => enqueueSnackbar(message, { variant: 'success' });
    const notifyError = (message: string) => enqueueSnackbar(message, { variant: 'error' });
    const notifyWarning = (message: string) => enqueueSnackbar(message, { variant: 'warning' });

    return {
      playSuccess,
      playError,
      notifySuccess,
      notifyError,
      notifyWarning,
      success: (message) => {
        playSuccess();
        if (message) notifySuccess(message);
      },
      error: (message) => {
        playError();
        notifyError(message);
      },
    };
  }, [successUrl, errorUrl, muted, volume, enqueueSnackbar]);
}
