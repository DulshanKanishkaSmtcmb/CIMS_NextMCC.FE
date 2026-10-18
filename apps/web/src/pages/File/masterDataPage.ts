import type { ValidationIssue } from '@cims/ui';
import type { ApiQueryError } from '../../services/axiosBaseQuery';

/**
 * Shared pieces of the keyed master-data pages redesigned on `MasterDataPage` (Country, Ports, DC, Supplier,
 * PM Supplier, PM Master; docs/19 sections 3.1 and 14). Wording follows docs/19 section 11; each text names the
 * legacy text it replaces (AppJs/Country.js, Ports.js, DC.js and the supplier modules use the same ones).
 */

/** Context line above the page title. */
export const MASTER_DATA_CONTEXT = 'File · Master data';

export const SHARED_MESSAGES = {
  /** Legacy toast "Data not Saved [<msg>]": same content, the server's message is shown verbatim as details. */
  notSavedTitle: 'Data not saved',
  notSaved: 'Nothing was changed. Correct the problem and save again.',
  /** Legacy toast "Unable to process Ajax Request". */
  noServerTitle: 'The server could not be reached',
  noServer: 'Nothing was changed. Check the connection and try again.',
  /** Legacy alert "Unable to process Ajax Request" when a list could not be loaded. */
  listFailed:
    'Check the network connection and try again. If it keeps failing, contact your administrator.',
  /** Legacy alerts "Error Loading … Data" (the record could not be read). */
  loadFailed: 'Check the network connection and try again.',
  /** The summary heading after a save that was stopped by the checks. */
  fixBeforeSaving: 'Fix these before saving',
} as const;

/**
 * What went wrong with a save or an existence check. Same mapping as the legacy `saveFailureText`: no response →
 * "Unable to process Ajax Request", 409 → "… Already Exist", 404 → "… not Exist", otherwise the server's message.
 */
export type SaveFailure =
  | { kind: 'noServer' }
  | { kind: 'exists' }
  | { kind: 'missing' }
  | { kind: 'failed'; details: string };

export function classifySaveFailure(error: ApiQueryError): SaveFailure {
  if (error.status === undefined) return { kind: 'noServer' };
  if (error.status === 409) return { kind: 'exists' };
  if (error.status === 404) return { kind: 'missing' };
  return { kind: 'failed', details: error.details?.join(' ') ?? error.message };
}

/** The message row above the form (MasterDataPage `detailMessage`). */
export type DetailNotice =
  | { kind: 'saved'; text: string }
  | { kind: 'problems'; issues: ValidationIssue[] }
  | {
      kind: 'error';
      title: string;
      message: string;
      /** The server's own text, verbatim. */
      details?: string;
      retry?: boolean;
    };

/** The form differs from the record it started from (shallow, by value). */
export function formDiffers<T extends object>(form: T, baseline: T): boolean {
  return (Object.keys(baseline) as (keyof T)[]).some((key) => form[key] !== baseline[key]);
}

/** "21/08/2026 09:38 by u1", "—" when nothing was recorded. */
export function auditText(date: string | null, user: string, format: (d: string) => string) {
  if (!date) return user ? `by ${user}` : '—';
  return user ? `${format(date)} by ${user}` : format(date);
}

/** The notice without the problem of one field (it became valid); null when no problem is left. */
export function withoutIssue(notice: DetailNotice | null, field: string): DetailNotice | null {
  if (notice?.kind !== 'problems') return notice;
  const issues = notice.issues.filter((i) => i.field !== field);
  if (issues.length === notice.issues.length) return notice;
  return issues.length > 0 ? { kind: 'problems', issues } : null;
}

/** SQL Server's comparison of a key: case-insensitive collation, trailing spaces ignored. */
export const sameKey = (a: string, b: string) =>
  a.trimEnd().toLowerCase() === b.trimEnd().toLowerCase();
