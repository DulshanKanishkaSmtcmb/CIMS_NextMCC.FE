import { useMemo, type ReactNode } from 'react';
import { ScanFeedbackContext, type ScanFeedbackConfig } from './ScanFeedbackContext';

export interface ScanFeedbackProviderProps extends ScanFeedbackConfig {
  children: ReactNode;
}

/** Sets sound URLs, mute and volume for every useScanFeedback() below it. */
export function ScanFeedbackProvider({
  sounds,
  muted,
  volume,
  children,
}: ScanFeedbackProviderProps) {
  const value = useMemo(() => ({ sounds, muted, volume }), [sounds, muted, volume]);
  return <ScanFeedbackContext.Provider value={value}>{children}</ScanFeedbackContext.Provider>;
}
