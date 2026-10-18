import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CimsThemeProvider } from '../../CimsThemeProvider';
import { DEFAULT_SOUND_URLS, clearSoundCache, playSound } from './sound';
import { useScanFeedback } from './useScanFeedback';
import type { ScanFeedbackConfig } from './ScanFeedbackContext';

const played: Array<{ src: string; volume: number }> = [];

class FakeAudio {
  volume = 1;
  currentTime = 0;
  constructor(public src: string) {}
  play() {
    played.push({ src: this.src, volume: this.volume });
    return Promise.resolve();
  }
}

beforeEach(() => {
  played.length = 0;
  clearSoundCache();
  vi.stubGlobal('Audio', FakeAudio);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function Buttons({ options }: { options?: ScanFeedbackConfig }) {
  const feedback = useScanFeedback(options);
  return (
    <>
      <button onClick={() => feedback.playSuccess()}>play-success</button>
      <button onClick={() => feedback.playError()}>play-error</button>
      <button onClick={() => feedback.success('Item confirmed')}>success</button>
      <button onClick={() => feedback.error('Unknown item')}>error</button>
      <button onClick={() => feedback.notifyWarning('Check quantity')}>warn</button>
    </>
  );
}

function renderButtons(provider?: ScanFeedbackConfig, hook?: ScanFeedbackConfig) {
  render(
    <CimsThemeProvider scanFeedback={provider}>
      <Buttons options={hook} />
    </CimsThemeProvider>,
  );
  return userEvent.setup();
}

describe('playSound', () => {
  it('plays the URL from the start with the given volume', () => {
    playSound('/s/a.mp3', 0.4);
    expect(played).toEqual([{ src: '/s/a.mp3', volume: 0.4 }]);
  });

  it('reuses the audio element for the same URL', () => {
    const created = vi.fn();
    class Counting extends FakeAudio {
      constructor(src: string) {
        super(src);
        created(src);
      }
    }
    vi.stubGlobal('Audio', Counting);
    playSound('/s/a.mp3');
    playSound('/s/a.mp3');
    expect(created).toHaveBeenCalledTimes(1);
  });

  it('swallows a blocked or failing play()', () => {
    class Blocked extends FakeAudio {
      override play() {
        return Promise.reject(new Error('NotAllowedError'));
      }
    }
    vi.stubGlobal('Audio', Blocked);
    expect(() => playSound('/s/a.mp3')).not.toThrow();
  });
});

describe('useScanFeedback', () => {
  it('plays the default sounds', async () => {
    const user = renderButtons();

    await user.click(screen.getByText('play-success'));
    await user.click(screen.getByText('play-error'));

    expect(played.map((p) => p.src)).toEqual([
      DEFAULT_SOUND_URLS.success,
      DEFAULT_SOUND_URLS.error,
    ]);
  });

  it('uses sound URLs from the provider and lets the hook override them', async () => {
    const user = renderButtons(
      { sounds: { success: '/p/ok.mp3', error: '/p/bad.mp3' } },
      { sounds: { error: '/h/bad.mp3' } },
    );

    await user.click(screen.getByText('play-success'));
    await user.click(screen.getByText('play-error'));

    expect(played.map((p) => p.src)).toEqual(['/p/ok.mp3', '/h/bad.mp3']);
  });

  it('plays nothing when muted but still shows toasts', async () => {
    const user = renderButtons({ muted: true });

    await user.click(screen.getByText('error'));

    expect(played).toHaveLength(0);
    expect(await screen.findByText('Unknown item')).toBeInTheDocument();
  });

  it('success() plays the success sound and toasts the message', async () => {
    const user = renderButtons({ sounds: { success: '/p/ok.mp3' } });

    await user.click(screen.getByText('success'));

    expect(played.map((p) => p.src)).toEqual(['/p/ok.mp3']);
    expect(await screen.findByText('Item confirmed')).toBeInTheDocument();
  });

  it('error() plays the error sound and toasts the message', async () => {
    const user = renderButtons({ sounds: { error: '/p/bad.mp3' } });

    await user.click(screen.getByText('error'));

    expect(played.map((p) => p.src)).toEqual(['/p/bad.mp3']);
    expect(await screen.findByText('Unknown item')).toBeInTheDocument();
  });

  it('toast-only helpers do not play a sound', async () => {
    const user = renderButtons();

    await user.click(screen.getByText('warn'));

    expect(await screen.findByText('Check quantity')).toBeInTheDocument();
    expect(played).toHaveLength(0);
  });
});
