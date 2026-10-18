import { useState } from 'react';
import { TextInput } from '@cims/ui';

export interface NumericFieldProps {
  label?: string;
  /** Accessible name when there is no visible label (cells of a table). */
  ariaLabel?: string;
  /** The committed number, or null for an empty field. */
  value: number | null;
  /** Digits after the decimal point; typed values are rounded to this (legacy `ko.extenders.numeric`). */
  decimals: number;
  onCommit: (value: number) => void;
  readOnly?: boolean;
  id?: string;
}

const show = (value: number | null) => (value === null ? '' : String(value));

/**
 * Text field for a number, like the legacy `value` binding with the `numeric` extender: the typed text becomes the value
 * on blur, is rounded to `decimals`, and text that is not a number is ignored (the field goes back to the last value).
 */
export function NumericField({
  label,
  ariaLabel,
  value,
  decimals,
  onCommit,
  readOnly,
  id,
}: NumericFieldProps) {
  const [text, setText] = useState(show(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // A value set by the page (a loaded record, New) replaces the typed text.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(show(value));
  }

  const commit = () => {
    const typed = text.trim();
    if (typed === '' || !Number.isFinite(Number(typed))) {
      setText(show(value));
      return;
    }
    const factor = 10 ** decimals;
    const rounded = Math.round(Number(typed) * factor) / factor;
    setText(show(rounded));
    if (rounded !== value) onCommit(rounded);
  };

  return (
    <TextInput
      id={id}
      label={label}
      ariaLabel={ariaLabel}
      value={text}
      readOnly={readOnly}
      onChange={readOnly ? undefined : setText}
      onBlur={commit}
    />
  );
}
