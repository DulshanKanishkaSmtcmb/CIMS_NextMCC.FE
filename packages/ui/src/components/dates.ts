import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/** What the user sees: day, month, year, as on the legacy date pickers. */
export const DMY_DISPLAY_FORMAT = 'DD/MM/YYYY';
/** What forms, state and the API carry. */
export const ISO_DATE_FORMAT = 'YYYY-MM-DD';
/** Date and time as the legacy datetime pickers show it (dd/mm/yy HH:mm in jQuery UI terms). */
export const DMY_TIME_DISPLAY_FORMAT = 'DD/MM/YYYY HH:mm';
/** Local date-time without offset, as forms and the API carry it. Never converted to UTC. */
export const ISO_DATE_TIME_FORMAT = 'YYYY-MM-DDTHH:mm:ss';

/** Parses a strict yyyy-MM-dd string. Anything else gives null. */
export function parseIsoDate(value: string | null | undefined): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, ISO_DATE_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

/** Formats a valid date as yyyy-MM-dd, or null when empty or invalid. */
export function formatIsoDate(value: Dayjs | null | undefined): string | null {
  return value && value.isValid() ? value.format(ISO_DATE_FORMAT) : null;
}

/** Parses a strict local yyyy-MM-ddTHH:mm:ss string (no offset). Anything else gives null. */
export function parseIsoDateTime(value: string | null | undefined): Dayjs | null {
  if (!value) return null;
  const parsed = dayjs(value, ISO_DATE_TIME_FORMAT, true);
  return parsed.isValid() ? parsed : null;
}

/** Formats a valid date-time as local yyyy-MM-ddTHH:mm:ss, or null when empty or invalid. */
export function formatIsoDateTime(value: Dayjs | null | undefined): string | null {
  return value && value.isValid() ? value.format(ISO_DATE_TIME_FORMAT) : null;
}

/**
 * Shows an ISO date or local date-time from the API (yyyy-MM-dd or yyyy-MM-ddTHH:mm[:ss]) as dd/MM/yyyy, or with
 * withTime as dd/MM/yyyy HH:mm. Empty for null or anything unparseable.
 */
export function formatDmy(value: string | null | undefined, withTime = false): string {
  if (!value) return '';
  const parsed = dayjs(value);
  return parsed.isValid()
    ? parsed.format(withTime ? DMY_TIME_DISPLAY_FORMAT : DMY_DISPLAY_FORMAT)
    : '';
}
