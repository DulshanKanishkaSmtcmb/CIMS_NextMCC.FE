import { useState } from 'react';
import type { Dayjs } from 'dayjs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DMY_DISPLAY_FORMAT, formatIsoDate, parseIsoDate } from './dates';

export interface DmyDatePickerProps {
  label?: string;
  /** ISO date, yyyy-MM-dd, or null when empty. */
  value: string | null;
  /** Called with an ISO date, or null when the field is cleared or incomplete. */
  onChange: (value: string | null) => void;
  /** ISO dates, yyyy-MM-dd. */
  minDate?: string;
  maxDate?: string;
  id?: string;
  name?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  error?: boolean;
  helperText?: string;
  fullWidth?: boolean;
}

/** Date field that shows dd/MM/yyyy and exchanges ISO yyyy-MM-dd strings with the form. */
export function DmyDatePicker({
  label,
  value,
  onChange,
  minDate,
  maxDate,
  id,
  name,
  disabled,
  readOnly,
  required,
  error,
  helperText,
  fullWidth,
}: DmyDatePickerProps) {
  // The picker may hold a half-typed (invalid) date that the form sees as null. Keep that draft
  // until the parent supplies a different value, so typing over an existing date does not blank the field.
  const [draft, setDraft] = useState<Dayjs | null>(() => parseIsoDate(value));
  const draftIso = formatIsoDate(draft);
  if ((value ?? null) !== draftIso) {
    setDraft(parseIsoDate(value));
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      <DatePicker
        label={label}
        value={draft}
        format={DMY_DISPLAY_FORMAT}
        onChange={(next) => {
          setDraft(next);
          const iso = formatIsoDate(next);
          if (iso !== (value ?? null)) onChange(iso);
        }}
        minDate={parseIsoDate(minDate) ?? undefined}
        maxDate={parseIsoDate(maxDate) ?? undefined}
        disabled={disabled}
        readOnly={readOnly}
        slotProps={{
          textField: { id, name, required, error, helperText, fullWidth },
        }}
      />
    </LocalizationProvider>
  );
}
