import { useEffect, useRef } from 'react';

export interface KeyboardShortcut {
  /**
   * Key combination, lower case, joined with "+": "ctrl+s", "ctrl+enter", "alt+l", "escape", "/". "mod" means Ctrl
   * (or Cmd on a Mac). Letters match by physical key too, so "alt+l" works with any keyboard layout.
   */
  keys: string;
  /** What it does, as a verb phrase for the legend: "Confirm arrival". */
  description: string;
  handler: (event: KeyboardEvent) => void;
  /** Default true. A disabled shortcut stays in the legend but does nothing. */
  enabled?: boolean;
  /**
   * Fire while focus is in a text field. Default: true for combinations with Ctrl/Alt/Meta and for Escape, false for
   * plain keys ("/", "?") so typing is never hijacked.
   */
  allowInInputs?: boolean;
}

interface ParsedKeys {
  key: string;
  ctrl: boolean;
  alt: boolean;
  shift: boolean;
  meta: boolean;
  mod: boolean;
}

const KEY_ALIASES: Record<string, string> = { esc: 'escape', return: 'enter', space: ' ' };

function parse(keys: string): ParsedKeys {
  const parts = keys.toLowerCase().split('+');
  // "ctrl++" style is not supported; a trailing "+" key is written as "plus".
  const raw = parts.pop() ?? '';
  const key = KEY_ALIASES[raw] ?? (raw === 'plus' ? '+' : raw);
  return {
    key,
    ctrl: parts.includes('ctrl'),
    alt: parts.includes('alt'),
    shift: parts.includes('shift'),
    meta: parts.includes('meta'),
    mod: parts.includes('mod'),
  };
}

function keyMatches(event: KeyboardEvent, key: string): boolean {
  if (event.key.toLowerCase() === key) return true;
  if (/^[a-z]$/.test(key)) return event.code === `Key${key.toUpperCase()}`;
  if (/^[0-9]$/.test(key)) return event.code === `Digit${key}`;
  return false;
}

/** Whether the event matches a combination such as "ctrl+enter". Exported for tests and custom handlers. */
export function matchesShortcut(event: KeyboardEvent, keys: string): boolean {
  const p = parse(keys);
  const wantCtrl = p.ctrl || (p.mod && !event.metaKey);
  const wantMeta = p.meta || (p.mod && event.metaKey);
  if (event.ctrlKey !== wantCtrl || event.metaKey !== wantMeta || event.altKey !== p.alt) {
    return false;
  }
  // Shift is only checked when asked for, or for letters (so "?" = shift+/ still matches "?").
  if ((p.shift || /^[a-z]$/.test(p.key)) && event.shiftKey !== p.shift) return false;
  return keyMatches(event, p.key);
}

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return target.getAttribute('role') === 'spinbutton';
  const type = (target as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'reset'].includes(type);
}

function insidePopup(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    !!target.closest('[role="dialog"], [role="listbox"], [role="menu"], [role="alertdialog"]')
  );
}

/** Text for the legend: "ctrl+enter" -> ["Ctrl", "Enter"]. */
export function formatShortcut(keys: string): string[] {
  const names: Record<string, string> = {
    ctrl: 'Ctrl',
    mod: 'Ctrl',
    alt: 'Alt',
    shift: 'Shift',
    meta: 'Meta',
    enter: 'Enter',
    escape: 'Esc',
    esc: 'Esc',
    ' ': 'Space',
    space: 'Space',
    arrowup: '↑',
    arrowdown: '↓',
  };
  return keys
    .toLowerCase()
    .split('+')
    .map((part) => names[part] ?? (part.length === 1 ? part.toUpperCase() : part));
}

/**
 * Page-level keyboard shortcuts on window. Shortcuts never fire during IME composition; plain keys (no Ctrl/Alt/Meta)
 * do not fire for events another handler already handled (defaultPrevented: ScanInput's Enter, a menu's Escape), and
 * plain Escape does not fire while focus is inside a dialog, menu or list box (those close themselves). Combinations
 * still fire after a field handled the bare key (Ctrl+Enter in a ScanInput confirms). Show the same list with ShortcutsLegend so shortcuts are discoverable.
 */
export function useKeyboardShortcuts(shortcuts: readonly KeyboardShortcut[]): void {
  const ref = useRef(shortcuts);
  useEffect(() => {
    ref.current = shortcuts;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      for (const shortcut of ref.current) {
        if (shortcut.enabled === false || !matchesShortcut(event, shortcut.keys)) continue;
        const p = parse(shortcut.keys);
        const hasModifier = p.ctrl || p.alt || p.meta || p.mod;
        if (event.defaultPrevented && !hasModifier) continue;
        const allowInInputs = shortcut.allowInInputs ?? (hasModifier || p.key === 'escape');
        if (!allowInInputs && isTypingTarget(event.target)) continue;
        if (p.key === 'escape' && !hasModifier && insidePopup(event.target)) continue;
        event.preventDefault();
        shortcut.handler(event);
        return;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
