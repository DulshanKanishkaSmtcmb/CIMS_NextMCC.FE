import type { Ref } from 'react';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';

export interface TextInputProps {
  label?: string;
  value: string;
  /** Omit for a read-only display field. */
  onChange?: (value: string) => void;
  /** Called when the field loses focus (legacy `event: { blur: ... }`). */
  onBlur?: () => void;
  /** Read-only: shown and selectable, not editable (legacy readonly="readonly" inputs). Default: true when onChange is omitted. */
  readOnly?: boolean;
  inputRef?: Ref<HTMLInputElement>;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
  /** Accessible name when there is no visible label. */
  ariaLabel?: string;
  /** A text area (legacy <textarea>) of at least this many rows instead of a one-line field. */
  rows?: number;
  /** The longest value the server accepts (the API validator's limit): typing stops there. */
  maxLength?: number;
  /** Show "n/max" under the field. Default: when the limit is short (20 or less) and the field is editable. */
  showCount?: boolean;
}

/**
 * Plain text field for typed (not scanned) input and read-only display values. For scanner fields use ScanInput,
 * which commits on Enter and can force upper case.
 */
export function TextInput({
  label,
  value,
  onChange,
  readOnly,
  onBlur,
  inputRef,
  id,
  name,
  placeholder,
  disabled,
  required,
  error,
  helperText,
  fullWidth = true,
  ariaLabel,
  rows,
  maxLength,
  showCount,
}: TextInputProps) {
  const isReadOnly = readOnly ?? onChange === undefined;
  const counted =
    maxLength !== undefined && (showCount ?? (maxLength <= 20 && !isReadOnly && !disabled));
  const helper = counted ? (
    <Box component="span" sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
      <span>{helperText}</span>
      <Box component="span" aria-hidden sx={{ flex: 'none', fontVariantNumeric: 'tabular-nums' }}>
        {`${value.length}/${maxLength}`}
      </Box>
    </Box>
  ) : (
    helperText
  );
  return (
    <TextField
      label={label}
      value={value}
      onChange={onChange ? (event) => onChange(event.target.value) : undefined}
      onBlur={onBlur}
      inputRef={inputRef}
      id={id}
      name={name}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      error={error}
      helperText={helper}
      fullWidth={fullWidth}
      multiline={rows !== undefined}
      minRows={rows}
      slotProps={{
        input: { readOnly: isReadOnly },
        htmlInput: { readOnly: isReadOnly, 'aria-label': ariaLabel, maxLength },
      }}
    />
  );
}
