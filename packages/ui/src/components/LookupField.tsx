import { useState, type KeyboardEvent, type Ref } from 'react';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import SearchIcon from '@mui/icons-material/Search';

export interface LookupFieldProps {
  label?: string;
  /** The committed value. The typed text becomes the value on blur or Enter, like a Knockout `value` binding. */
  value: string;
  /** Called with the typed text when the field loses focus or Enter is pressed and the text changed. */
  onCommit?: (value: string) => void;
  /** Called when Enter is pressed, after a changed text was committed. */
  onEnter?: () => void;
  /** Called when the search button is clicked. */
  onSearch: () => void;
  /** Not editable (the search button still works unless `searchDisabled`). */
  readOnly?: boolean;
  searchDisabled?: boolean;
  /** Do not show the search button at all (legacy `visible:` binding on the button, e.g. PM Master in New mode). */
  hideSearch?: boolean;
  /** Id of the input (the legacy element id, e.g. "CountryCode"). */
  id?: string;
  /** Id of the search button (the legacy button id, e.g. "btnCountryCode"). */
  searchId?: string;
  /** Accessible name of the search button. Default "Search". */
  searchLabel?: string;
  /** Accessible name of the input when there is no visible label (cells of a table). */
  ariaLabel?: string;
  inputRef?: Ref<HTMLInputElement>;
  name?: string;
  disabled?: boolean;
  fullWidth?: boolean;
}

/**
 * Code field with a search button, replacing the legacy "input + magnifier button + dialog with a DataTable" lookup
 * pattern. It commits on blur or Enter (not on every keystroke) so a page can load the record for the code the way the
 * legacy `value` + `returnKey` bindings did. Pair it with `LookupDialog` for the list.
 */
export function LookupField({
  label,
  value,
  onCommit,
  onEnter,
  onSearch,
  readOnly = false,
  searchDisabled = false,
  hideSearch = false,
  id,
  searchId,
  searchLabel = 'Search',
  ariaLabel,
  inputRef,
  name,
  disabled,
  fullWidth = true,
}: LookupFieldProps) {
  const [text, setText] = useState(value);
  const [syncedValue, setSyncedValue] = useState(value);

  // A value set by the page (a selection from the dialog, a loaded record, New) replaces the typed text.
  if (value !== syncedValue) {
    setSyncedValue(value);
    setText(value);
  }

  const commit = () => {
    if (text !== value) onCommit?.(text);
  };

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    event.preventDefault();
    commit();
    onEnter?.();
  };

  return (
    <TextField
      label={label}
      value={text}
      onChange={readOnly ? undefined : (event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
      inputRef={inputRef}
      id={id}
      name={name}
      disabled={disabled}
      fullWidth={fullWidth}
      slotProps={{
        htmlInput: { readOnly, 'aria-label': ariaLabel },
        input: {
          readOnly,
          endAdornment: hideSearch ? undefined : (
            <InputAdornment position="end">
              <IconButton
                id={searchId}
                edge="end"
                size="small"
                color="info"
                aria-label={searchLabel}
                disabled={searchDisabled}
                onClick={onSearch}
              >
                <SearchIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
