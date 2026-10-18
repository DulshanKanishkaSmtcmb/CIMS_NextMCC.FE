import dayjs, { type Dayjs } from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';

dayjs.extend(customParseFormat);

/** What the user sees: day, month, year, as on the legacy date pickers. */
export const DMY_DISPLAY_FORMAT = 'DD/MM/YYYY';
/** What forms, state and the API carry. */
export const ISO_DATE_FORMAT = 'YYYY-MM-DD';

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
