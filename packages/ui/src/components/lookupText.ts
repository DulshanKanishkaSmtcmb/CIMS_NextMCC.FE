import { formatDmy } from './dates';

/** How a column's values are shown: the legacy DataTable renderers by column type. */
export type LookupColumnKind = 'text' | 'number' | 'boolean' | 'date' | 'dateTime';

/** Display text of a cell, as the legacy list dialog rendered it (also what the column search boxes match). */
export function lookupCellText(value: unknown, kind: LookupColumnKind = 'text'): string {
  if (value === null || value === undefined) return kind === 'boolean' ? 'No' : '';
  switch (kind) {
    case 'boolean':
      return value === true ? 'Yes' : 'No';
    case 'date':
      return formatDmy(String(value));
    case 'dateTime': {
      const withTime = formatDmy(String(value), true);
      return withTime.endsWith(' 00:00') ? withTime.slice(0, -6) : withTime;
    }
    case 'number':
      return typeof value === 'number'
        ? value.toLocaleString('en-US', { maximumFractionDigits: 0 })
        : String(value);
    default:
      return String(value);
  }
}
