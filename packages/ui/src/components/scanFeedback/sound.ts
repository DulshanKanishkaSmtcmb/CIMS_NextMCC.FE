export interface ScanSoundUrls {
  success: string;
  error: string;
}

/**
 * Default sound URLs. They point at the legacy /Sounds folder, which the gateway keeps serving from
 * the legacy host on the same hostname during the migration. The legacy pages play
 * "Phone Off Hook" on errors and have no success sound, so success uses button_push.
 * Override per app with ScanFeedbackProvider or useScanFeedback({ sounds }).
 */
export const DEFAULT_SOUND_URLS: ScanSoundUrls = {
  success: '/Sounds/button_push.mp3',
  error: encodeURI('/Sounds/Phone Off Hook-SoundBible.com-701991146.mp3'),
};

const cache = new Map<string, HTMLAudioElement>();

/** Plays a sound from the start. Never throws: browsers may block audio before the first user gesture. */
export function playSound(url: string, volume = 1): void {
  if (typeof Audio === 'undefined') return;
  let audio = cache.get(url);
  if (!audio) {
    audio = new Audio(url);
    cache.set(url, audio);
  }
  audio.volume = Math.min(1, Math.max(0, volume));
  audio.currentTime = 0;
  try {
    const result = audio.play() as Promise<void> | undefined;
    result?.catch(() => undefined);
  } catch {
    // Audio is a convenience; a failure must never break a scan.
  }
}

/** Test helper: drop cached audio elements. */
export function clearSoundCache(): void {
  cache.clear();
}
