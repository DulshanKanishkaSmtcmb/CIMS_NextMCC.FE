import { useState, type ChangeEvent, type KeyboardEvent, type Ref } from 'react';
import TextField from '@mui/material/TextField';

export interface ScanInputProps {
  label?: string;
  /** Called with the trimmed value when Enter is pressed on a non-empty field. */
  onScan: (value: string) => void;
  /** Clear the field after onScan. Default true. */
  clearOnScan?: boolean;
  /** Convert typed or scanned text to upper case, as the legacy "capsOn" fields do. Default false. */
  forceUppercase?: boolean;
  /** Select the existing content when the field gets focus. Default true. */
  selectOnFocus?: boolean;
  /** Controlled value. Omit to let the component keep its own state. */
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  /** Ref to the underlying input element, for example from useFocusChain().ref(key). */
  inputRef?: Ref<HTMLInputElement>;
  id?: string;
  name?: string;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  autoFocus?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Text field for barcode scanners and keyboards. Scanners send the code followed by Enter,
 * so Enter commits the value.
 */
export function ScanInput({
  label,
  onScan,
  clearOnScan = true,
  forceUppercase = false,
  selectOnFocus = true,
  value,
  defaultValue = '',
  onValueChange,
  inputRef,
  id,
  name,
  placeholder,
  disabled,
  required,
  autoFocus,
  error,
  helperText,
  fullWidth = true,
}: ScanInputProps) {
  const [innerValue, setInnerValue] = useState(defaultValue);
  const isControlled = value !== undefined;
  const current = isControlled ? value : innerValue;

  const update = (next: string) => {
    if (!isControlled) setInnerValue(next);
    onValueChange?.(next);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    update(forceUppercase ? raw.toLocaleUpperCase() : raw);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    const trimmed = current.trim();
    if (!trimmed) return;
    onScan(trimmed);
    update(clearOnScan ? '' : trimmed);
  };

  return (
    <TextField
      id={id}
      name={name}
      label={label}
      value={current}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      autoFocus={autoFocus}
      error={error}
      helperText={helperText}
      fullWidth={fullWidth}
      inputRef={inputRef}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onFocus={selectOnFocus ? (event) => event.target.select() : undefined}
      slotProps={{
        htmlInput: { autoComplete: 'off', autoCapitalize: 'off', spellCheck: false },
      }}
      sx={(theme) => ({
        '& .MuiInputBase-input': {
          fontSize: theme.cims?.scanner.inputFontSize,
          minHeight: theme.cims?.scanner.inputMinHeight,
          boxSizing: 'border-box',
        },
      })}
    />
  );
}
