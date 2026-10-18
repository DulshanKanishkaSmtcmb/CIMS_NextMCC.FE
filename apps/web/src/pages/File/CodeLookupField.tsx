import { useRef, useState, type Ref } from 'react';
import { LookupDialog, LookupField, type LookupColumn } from '@cims/ui';
import type { ApiQueryError } from '../../services/axiosBaseQuery';

type Read<T> = PromiseLike<{ data?: T; error?: unknown }>;

export interface CodeLookupTexts {
  /** Accessible name of the search button: "Search countries". */
  searchLabel: string;
  /** Title of the list dialog: "Countries". */
  dialogTitle: string;
  /** A typed or picked code that does not exist (legacy left the previous name on screen). */
  notFound: (code: string) => string;
  /** The name could not be read (legacy alerts "Error Loading … Details"). */
  loadFailed: string;
  /** The list could not be read (legacy alert "Unable to process Ajax Request"). */
  listFailed: string;
  /** The list is empty (legacy alert "No data found to list out"). */
  listEmpty: string;
  /** 503 from the API: the other system is not reachable (Air/Sea freight). */
  unavailable?: string;
}

export interface CodeLookupFieldProps<R extends object> {
  label: string;
  /** The code in the form. */
  code: string;
  /** The looked-up name shown under the field (not saved). */
  displayName: string;
  /** A new code (typed and left, or picked) and, once looked up, its name ('' while unknown). */
  onChange: (code: string, name: string) => void;
  loadList: () => Read<R[]>;
  loadName: (code: string) => Read<{ name: string }>;
  columns: readonly LookupColumn[];
  getCode: (row: R) => string;
  texts: CodeLookupTexts;
  readOnly?: boolean;
  /** Shown under an empty field, e.g. "Optional." */
  emptyHelp?: string;
  maxLength?: number;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A code of another entity inside a master-data form (the country of a port, a supplier's sea and air shipper): code
 * field + search button + list dialog, the name of the code under the field. The one lookup pattern the redesigned
 * master pages keep (docs/19 section 14.1 step 4). Same calls as legacy: the list when the search button is pressed,
 * the record by code after a code is typed (blur or Enter) or picked.
 */
export function CodeLookupField<R extends object>({
  label,
  code,
  displayName,
  onChange,
  loadList,
  loadName,
  columns,
  getCode,
  texts,
  readOnly = false,
  emptyHelp,
  maxLength,
  inputRef,
}: CodeLookupFieldProps<R>) {
  const [rows, setRows] = useState<R[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const latest = useRef(0);

  const failure = (error: unknown, otherwise: string) =>
    (error as ApiQueryError | undefined)?.status === 503 && texts.unavailable
      ? texts.unavailable
      : otherwise;

  /** Legacy `…Code.subscribe`: a non-empty code loads its name; an empty one clears it. */
  const commit = (next: string) => {
    const request = ++latest.current;
    setProblem(null);
    onChange(next, '');
    if (next.length === 0) return;
    void Promise.resolve(loadName(next)).then((result) => {
      if (request !== latest.current) return;
      if (result.data && !result.error) onChange(next, result.data.name);
      else if ((result.error as ApiQueryError | undefined)?.status === 404)
        setProblem(texts.notFound(next));
      else setProblem(failure(result.error, texts.loadFailed));
    });
  };

  const openList = async () => {
    setProblem(null);
    const result = await loadList();
    if (!result.data) setProblem(failure(result.error, texts.listFailed));
    else if (result.data.length === 0) setProblem(texts.listEmpty);
    else setRows(result.data);
  };

  return (
    <>
      <LookupField
        label={label}
        value={code}
        inputRef={inputRef}
        readOnly={readOnly}
        hideSearch={readOnly}
        searchLabel={texts.searchLabel}
        maxLength={maxLength}
        onCommit={commit}
        onSearch={() => void openList()}
        error={!!problem}
        helperText={problem ?? (displayName || (code ? undefined : emptyHelp))}
      />
      {rows ? (
        <LookupDialog<R>
          open
          title={texts.dialogTitle}
          columns={columns}
          rows={rows}
          getRowId={getCode}
          onSelect={(row) => {
            setRows(null);
            commit(getCode(row));
          }}
          onClose={() => setRows(null)}
        />
      ) : null}
    </>
  );
}
