import { useState } from 'react';
import type { Dayjs } from 'dayjs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import {
  DMY_DISPLAY_FORMAT,
  DMY_TIME_DISPLAY_FORMAT,
  formatIsoDate,
  formatIsoDateTime,
  parseIsoDate,
  parseIsoDateTime,
} from './dates';

export interface DmyDatePickerProps {
  label?: string;
  /** ISO date, yyyy-MM-dd (with withTime: local yyyy-MM-ddTHH:mm:ss), or null when empty. */
  value: string | null;
  /** Called with an ISO value in the same format, or null when the field is cleared or incomplete. */
  onChange: (value: string | null) => void;
  /**
   * Also pick hours and minutes: shows dd/MM/yyyy HH:mm (24 h, like the legacy datetimepicker) and exchanges local
   * yyyy-MM-ddTHH:mm:ss strings with no offset. Default false.
   */
  withTime?: boolean;
  /** ISO dates (date-times with withTime). */
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

/** Date (or date-time) field that shows dd/MM/yyyy[ HH:mm] and exchanges ISO strings with the form. */
export function DmyDatePicker({
  label,
  value,
  onChange,
  withTime = false,
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
  const parse = withTime ? parseIsoDateTime : parseIsoDate;
  const format = withTime ? formatIsoDateTime : formatIsoDate;

  // The picker may hold a half-typed (invalid) date that the form sees as null. Keep that draft
  // until the parent supplies a different value, so typing over an existing date does not blank the field.
  const [draft, setDraft] = useState<Dayjs | null>(() => parse(value));
  const draftIso = format(draft);
  if ((value ?? null) !== draftIso) {
    setDraft(parse(value));
  }

  const handleChange = (next: Dayjs | null) => {
    setDraft(next);
    const iso = format(next);
    if (iso !== (value ?? null)) onChange(iso);
  };

  const common = {
    label,
    value: draft,
    onChange: handleChange,
    minDate: parse(minDate) ?? undefined,
    maxDate: parse(maxDate) ?? undefined,
    disabled,
    readOnly,
    slotProps: {
      textField: { id, name, required, error, helperText, fullWidth },
    },
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
      {withTime ? (
        <DateTimePicker {...common} format={DMY_TIME_DISPLAY_FORMAT} ampm={false} />
      ) : (
        <DatePicker {...common} format={DMY_DISPLAY_FORMAT} />
      )}
    </LocalizationProvider>
  );
}
