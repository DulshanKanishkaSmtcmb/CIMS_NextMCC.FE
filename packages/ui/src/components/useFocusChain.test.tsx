import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { describe, expect, it } from 'vitest';
import { CimsThemeProvider } from '../CimsThemeProvider';
import { ScanInput } from './ScanInput';
import { useFocusChain, type FocusChain } from './useFocusChain';

const KEYS = ['first', 'second', 'third'] as const;
type Key = (typeof KEYS)[number];
const LABELS: Record<Key, string> = { first: 'First', second: 'Second', third: 'Third' };

function renderChain(options: { wrap?: boolean; disabled?: Key } = {}) {
  const holder: { chain?: FocusChain<Key> } = {};
  function Harness() {
    const chain = useFocusChain<Key>(KEYS, { wrap: options.wrap });
    useEffect(() => {
      holder.chain = chain;
    });
    return (
      <CimsThemeProvider>
        {KEYS.map((key) => (
          <ScanInput
            key={key}
            label={LABELS[key]}
            inputRef={chain.ref(key)}
            disabled={options.disabled === key}
            onScan={() => chain.advance(key)}
          />
        ))}
      </CimsThemeProvider>
    );
  }
  render(<Harness />);
  return { holder, field: (key: Key) => screen.getByLabelText(LABELS[key]) };
}

describe('useFocusChain', () => {
  it('moves focus to the next field after a scan', async () => {
    const user = userEvent.setup();
    const { field } = renderChain();

    await user.type(field('first'), 'a{Enter}');
    expect(field('second')).toHaveFocus();

    await user.type(field('second'), 'b{Enter}');
    expect(field('third')).toHaveFocus();
  });

  it('stays on the last field and reports false at the end', () => {
    const { holder, field } = renderChain();
    act(() => field('third').focus());

    let moved = true;
    act(() => {
      moved = holder.chain!.advance();
    });

    expect(moved).toBe(false);
    expect(field('third')).toHaveFocus();
  });

  it('wraps to the first field when wrap is set', () => {
    const { holder, field } = renderChain({ wrap: true });
    act(() => field('third').focus());

    act(() => {
      holder.chain!.advance();
    });

    expect(field('first')).toHaveFocus();
  });

  it('skips disabled fields', async () => {
    const user = userEvent.setup();
    const { field } = renderChain({ disabled: 'second' });

    await user.type(field('first'), 'a{Enter}');

    expect(field('third')).toHaveFocus();
  });

  it('focuses a given key and resets to the first field', () => {
    const { holder, field } = renderChain();

    act(() => {
      holder.chain!.focus('third');
    });
    expect(field('third')).toHaveFocus();

    act(() => {
      holder.chain!.reset();
    });
    expect(field('first')).toHaveFocus();
  });

  it('returns a stable ref callback per key', () => {
    const { holder } = renderChain();
    expect(holder.chain!.ref('first')).toBe(holder.chain!.ref('first'));
  });
});
