import type { Ref } from 'react';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';

export type SelectOption = string | { value: string; label: string };

export interface SelectFieldProps {
  label?: string;
  value: string;
  /** Plain strings (value = label) or { value, label } pairs, shown in this order. */
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  inputRef?: Ref<HTMLInputElement>;
  id?: string;
  name?: string;
  disabled?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
}

const toOption = (option: SelectOption) =>
  typeof option === 'string' ? { value: option, label: option } : option;

/**
 * Single-choice drop-down, the replacement for the legacy Knockout `<select data-bind="options: ..., value: ...">`.
 * A value that is not among the options shows as empty (MUI warns in development).
 */
export function SelectField({
  label,
  value,
  options,
  onChange,
  inputRef,
  id,
  name,
  disabled,
  required,
  error,
  helperText,
  fullWidth = true,
}: SelectFieldProps) {
  return (
    <TextField
      select
      label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      inputRef={inputRef}
      id={id}
      name={name}
      disabled={disabled}
      required={required}
      error={error}
      helperText={helperText}
      fullWidth={fullWidth}
    >
      {options.map(toOption).map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.label}
        </MenuItem>
      ))}
    </TextField>
  );
}
