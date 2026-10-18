import type { Ref } from 'react';
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
}: TextInputProps) {
  const isReadOnly = readOnly ?? onChange === undefined;
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
      helperText={helperText}
      fullWidth={fullWidth}
      slotProps={{ htmlInput: { readOnly: isReadOnly, 'aria-label': ariaLabel } }}
    />
  );
}
