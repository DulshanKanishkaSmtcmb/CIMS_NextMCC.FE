import { useEffect, useMemo, useRef } from 'react';

export interface FocusChainOptions {
  /** After the last field, continue with the first one. Default false. */
  wrap?: boolean;
}

export interface FocusChain<K extends string> {
  /** Stable ref callback for the input registered under `key`. Pass it as ScanInput's inputRef. */
  ref: (key: K) => (element: HTMLInputElement | null) => void;
  /** Focus a specific field. Returns false when it is missing or not focusable. */
  focus: (key: K) => boolean;
  /** Focus the field after the current one. Call it after a successful scan. Returns false at the end. */
  advance: (from?: K) => boolean;
  /** Focus the first focusable field. */
  reset: () => boolean;
}

function isFocusable(element: HTMLInputElement | null | undefined): element is HTMLInputElement {
  return !!element && !element.disabled && !element.readOnly && element.isConnected;
}

/**
 * Ordered focus for scanner screens: after each successful scan the cursor moves to the next field,
 * the way the legacy pages chain their inputs.
 */
export function useFocusChain<K extends string>(
  order: readonly K[],
  options: FocusChainOptions = {},
): FocusChain<K> {
  const wrap = options.wrap ?? false;
  const orderRef = useRef(order);
  const wrapRef = useRef(wrap);
  useEffect(() => {
    orderRef.current = order;
    wrapRef.current = wrap;
  });

  const elements = useRef(new Map<K, HTMLInputElement>());
  const callbacks = useRef(new Map<K, (element: HTMLInputElement | null) => void>());
  const lastIndex = useRef(-1);

  return useMemo<FocusChain<K>>(() => {
    const focusIndex = (index: number): boolean => {
      const key = orderRef.current[index];
      const element = key === undefined ? undefined : elements.current.get(key);
      if (!isFocusable(element)) return false;
      element.focus();
      lastIndex.current = index;
      return true;
    };

    const currentIndex = (from?: K): number => {
      if (from !== undefined) return orderRef.current.indexOf(from);
      const active = document.activeElement;
      const activeIndex = orderRef.current.findIndex((key) => elements.current.get(key) === active);
      return activeIndex >= 0 ? activeIndex : lastIndex.current;
    };

    return {
      ref: (key) => {
        let callback = callbacks.current.get(key);
        if (!callback) {
          callback = (element) => {
            if (element) elements.current.set(key, element);
            else elements.current.delete(key);
          };
          callbacks.current.set(key, callback);
        }
        return callback;
      },
      focus: (key) => focusIndex(orderRef.current.indexOf(key)),
      advance: (from) => {
        const count = orderRef.current.length;
        const start = currentIndex(from);
        for (let index = start + 1; index < count; index++) {
          if (focusIndex(index)) return true;
        }
        if (wrapRef.current) {
          for (let index = 0; index <= Math.min(start, count - 1); index++) {
            if (focusIndex(index)) return true;
          }
        }
        return false;
      },
      reset: () => {
        for (let index = 0; index < orderRef.current.length; index++) {
          if (focusIndex(index)) return true;
        }
        return false;
      },
    };
  }, []);
}
