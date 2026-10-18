import { useCallback, useEffect, useRef, useState } from 'react';
import type { MasterDataMode, ValidationIssue } from '@cims/ui';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import {
  classifySaveFailure,
  formDiffers,
  SHARED_MESSAGES,
  withoutIssue,
  type DetailNotice,
} from './masterDataPage';

type ListResult<T> = { data?: T[] };

/**
 * The list of a master-data page: read once when the page opens (and again on `refresh`, e.g. after a save).
 * `reload` shows the skeleton again (Try again after a failure); `refresh` keeps the current list on screen.
 */
export function useMasterList<T>(load: () => PromiseLike<ListResult<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');

  const refresh = useCallback(
    () =>
      Promise.resolve(load()).then((result) => {
        if (result.data) {
          setItems(result.data);
          setState('ready');
        } else {
          setState('failed');
        }
      }),
    [load],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const reload = () => {
    setState('loading');
    void refresh();
  };

  return { items, state, refresh, reload };
}

/** Texts a keyed save needs (legacy "… Already Exist", "… not Exist", "Error Loading … Data"). */
export interface KeyedSaveMessages {
  checkFailedTitle: string;
  doesNotExist: (key: string) => string;
}

type QueryResult = { data?: unknown; error?: unknown };
type MutationResult = { data: unknown; error?: undefined } | { data?: undefined; error: unknown };

export interface KeyedSaveOptions {
  isNew: boolean;
  key: string;
  /**
   * The existence check before the save (legacy `chk…Code`): the record-by-key lookup. Omit it where the legacy page
   * had none (a New supplier: the server generates the code).
   */
  check?: () => PromiseLike<QueryResult>;
  /** The POST (new) or PUT (change). */
  send: () => PromiseLike<MutationResult>;
  messages: KeyedSaveMessages;
  /** New and the key exists (check or server 409): show it on the key field. */
  refuseExisting: () => void;
  /**
   * A check the legacy page ran after the existence check and before sending (PM Master's both-counts rule): return
   * false to stop; it shows its own message.
   */
  beforeSend?: () => boolean;
  /** The save's answer (e.g. the generated code). */
  onSaved: (data: unknown) => void;
  /** Run again after "Try again". */
  retry: () => void;
}

/**
 * State of the detail side of a MasterDataPage: mode, the open record, the form and the record it started from
 * (`baseline`, for the dirty-state guard), field errors, the message row, and a request counter so a late answer
 * for a record the user already left is ignored. `onReset` clears the page's own feedback (similar names, …).
 */
export function useMasterRecord<F extends object>(empty: F, onReset?: () => void) {
  type Field = Extract<keyof F, string>;
  const [mode, setMode] = useState<MasterDataMode>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [baseline, setBaseline] = useState<F>(empty);
  const [form, setForm] = useState<F>(empty);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState<DetailNotice | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [saving, setSaving] = useState(false);
  const requestRef = useRef(0);
  const retryRef = useRef<(() => void) | null>(null);
  const onResetRef = useRef(onReset);
  useEffect(() => {
    onResetRef.current = onReset;
  });

  const editing = mode === 'new' || mode === 'edit';

  const clearFeedback = () => {
    setNotice(null);
    setErrors({});
    onResetRef.current?.();
  };

  /** Starts a request for the current record; `isCurrent(id)` is false once the user moved on. */
  const nextRequest = () => ++requestRef.current;
  const isCurrent = (id: number) => id === requestRef.current;

  /** Selecting a record from the list: view mode with a skeleton until `showRecord`. Returns the request id. */
  const beginView = (id: string) => {
    const request = nextRequest();
    clearFeedback();
    setMode('view');
    setSelected(id);
    setLoaded(false);
    setDetailLoading(true);
    return request;
  };

  const showRecord = (values: F) => {
    setDetailLoading(false);
    setBaseline(values);
    setForm(values);
    setLoaded(true);
  };

  /** The record could not be read: no form, the notice says why (with Try again when `retry` is given). */
  const failView = (failure: DetailNotice, retry?: () => void) => {
    setDetailLoading(false);
    retryRef.current = retry ?? null;
    setNotice(failure);
  };

  /** Legacy Option "New" / `btnNewClick`: a form from the one default object. */
  const startNew = (values: F = empty) => {
    nextRequest();
    clearFeedback();
    setSelected(null);
    setLoaded(true);
    setDetailLoading(false);
    setBaseline(values);
    setForm(values);
    setMode('new');
  };

  /** Legacy Option "Change". */
  const startEdit = () => {
    clearFeedback();
    setMode('edit');
  };

  /** Esc / Cancel / Close of the drawer: edit goes back to view of the record, new and view go back to idle. */
  const cancel = () => {
    nextRequest();
    clearFeedback();
    setDetailLoading(false);
    if (mode === 'edit') {
      setForm(baseline);
      setMode('view');
    } else {
      setForm(empty);
      setSelected(null);
      setMode('idle');
    }
  };

  const update = <K extends keyof F>(field: K, value: F[K]) =>
    setForm((current) => ({ ...current, [field]: value }));

  /** A field became valid: its message goes, on the field and in the summary. */
  const clearError = (field: Field) => {
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setNotice((current) => withoutIssue(current, field));
  };

  /** The checks that stopped a save: on the fields and in the summary, in the legacy order. */
  const showProblems = (issues: ValidationIssue[]) => {
    setErrors(Object.fromEntries(issues.map((i) => [i.field, i.message])) as typeof errors);
    setNotice({ kind: 'problems', issues });
  };

  /** A successful save: the record is shown read-only (legacy: Save disabled until New). */
  const showSaved = (values: F, id: string, text: string) => {
    nextRequest();
    clearFeedback();
    setBaseline(values);
    setForm(values);
    setSelected(id);
    setLoaded(true);
    setDetailLoading(false);
    setMode('view');
    setNotice({ kind: 'saved', text });
  };

  /**
   * Legacy `btnSaveData` after the field checks: existence check by key (a failed check sends nothing; New + exists
   * and Change + missing are refused), then POST/PUT; 409 / 404 / no response / other failures as the legacy
   * `saveFailureText`, with the server's message verbatim.
   */
  const runKeyedSave = async (o: KeyedSaveOptions) => {
    setSaving(true);
    setNotice(null);
    retryRef.current = o.retry;
    const missing = (): DetailNotice => ({
      kind: 'error',
      title: SHARED_MESSAGES.notSavedTitle,
      message: o.messages.doesNotExist(o.key),
    });
    try {
      const check = o.check ? await o.check() : null;
      // A failed refetch keeps the previous answer's data in RTK Query: the error decides first.
      const exists = !check?.error && Boolean(check?.data);
      if (check && !exists && (check.error as ApiQueryError | undefined)?.status !== 404) {
        setNotice({
          kind: 'error',
          title: o.messages.checkFailedTitle,
          message: SHARED_MESSAGES.noServer,
          retry: true,
        });
        return;
      }
      if (check && o.isNew && exists) {
        o.refuseExisting();
        return;
      }
      if (check && !o.isNew && !exists) {
        setNotice(missing());
        return;
      }
      if (o.beforeSend && !o.beforeSend()) return;
      const result = await o.send();
      if (result.data) {
        o.onSaved(result.data);
        return;
      }
      if (!result.error) return;
      const failure = classifySaveFailure(result.error as ApiQueryError);
      if (failure.kind === 'exists') o.refuseExisting();
      else if (failure.kind === 'missing') setNotice(missing());
      else if (failure.kind === 'noServer') {
        setNotice({
          kind: 'error',
          title: SHARED_MESSAGES.noServerTitle,
          message: SHARED_MESSAGES.noServer,
          retry: true,
        });
      } else {
        setNotice({
          kind: 'error',
          title: SHARED_MESSAGES.notSavedTitle,
          message: SHARED_MESSAGES.notSaved,
          details: failure.details,
        });
      }
    } finally {
      setSaving(false);
    }
  };

  return {
    mode,
    selected,
    loaded,
    baseline,
    form,
    detailLoading,
    notice,
    errors,
    saving,
    editing,
    dirty: editing && formDiffers(form, baseline),
    setErrors,
    setNotice,
    setSaving,
    nextRequest,
    isCurrent,
    beginView,
    showRecord,
    failView,
    startNew,
    startEdit,
    cancel,
    update,
    clearError,
    showProblems,
    showSaved,
    runKeyedSave,
    retry: () => retryRef.current?.(),
    dismissNotice: () => setNotice(null),
  };
}
