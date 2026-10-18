import { createContext } from 'react';
import type { ScanSoundUrls } from './sound';

export interface ScanFeedbackConfig {
  /** Sound URLs. Missing entries fall back to DEFAULT_SOUND_URLS. */
  sounds?: Partial<ScanSoundUrls>;
  /** Silence all sounds. Toasts still show. */
  muted?: boolean;
  /** 0 to 1. Default 1. */
  volume?: number;
}

export const ScanFeedbackContext = createContext<ScanFeedbackConfig>({});
