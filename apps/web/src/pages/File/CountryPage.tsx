import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  FieldGrid,
  FieldGridItem,
  formatDmy,
  MasterDataPage,
  SegmentedControl,
  Stack,
  StatGroup,
  StatusChip,
  TextInput,
  type MasterDataMode,
  type ValidationIssue,
} from '@cims/ui';
import {
  useLazyGetCountriesQuery,
  useLazyGetCountryQuery,
  useLazySearchCountriesQuery,
  useSaveCountryMutation,
  type Country,
  type CountryNameHit,
} from '../../services/masterDataApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { smartMatches } from './masterEntry';
import {
  auditText,
  classifySaveFailure,
  formDiffers,
  MASTER_DATA_CONTEXT,
  SHARED_MESSAGES,
  withoutIssue,
  type DetailNotice,
} from './masterDataPage';
import { COUNTRY_MESSAGES as MESSAGES } from './countryMessages';
import { MasterDetailNotice } from './MasterDetailNotice';
import { SimilarNamesHint } from './SimilarNamesHint';

/** Cargo Movement choices, in the legacy order (AppJs/Country.js `CargoMovements`). */
const CARGO_MOVEMENTS = ['Imports', 'Export', 'Both'] as const;

interface CountryForm {
  countryCode: string;
  countryName: string;
  cargoMovement: string;
}

type Field = keyof CountryForm;

/** The one default object a new country starts from (legacy `btnNewClick`: empty, Cargo Movement "Both"). */
const EMPTY: CountryForm = { countryCode: '', countryName: '', cargoMovement: 'Both' };

const toForm = (c: Country): CountryForm => ({
  countryCode: c.countryCode,
  countryName: c.countryName,
  cargoMovement: c.cargoMovement,
});

const sameCode = (a: string, b: string) => a.trimEnd().toLowerCase() === b.trimEnd().toLowerCase();

/**
 * Countries (legacy /File/Country "Country Master Details", CloudMenu 100.02) on the MasterDataPage template:
 * searchable list + detail with view / edit / new (docs/19 section 3.1). The list replaces the Option select, the
 * code field's magnifier and the "Countries Listing" dialog. Kept from legacy (docs/15 B): the same API calls and
 * bodies (list, record by code on selection, first-letter name search for the similar-names hint, existence check
 * before every save, POST for a new country, PUT for a change), the checks in the legacy order (name, then code,
 * then exists / not exists), Cargo Movement default "Both", the code cannot change after it is saved.
 */
export function CountryPage() {
  const navigate = useNavigate();
  const [loadList] = useLazyGetCountriesQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  const [searchNames] = useLazySearchCountriesQuery();
  const [saveCountry] = useSaveCountryMutation();

  const [countries, setCountries] = useState<Country[]>([]);
  const [listState, setListState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [mode, setMode] = useState<MasterDataMode>('idle');
  const [selected, setSelected] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [baseline, setBaseline] = useState<CountryForm>(EMPTY);
  const [form, setForm] = useState<CountryForm>(EMPTY);
  const [detailLoading, setDetailLoading] = useState(false);
  const [notice, setNotice] = useState<DetailNotice | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [existingCode, setExistingCode] = useState<string | null>(null);
  const [hits, setHits] = useState<CountryNameHit[] | null>(null);
  const [hitFilter, setHitFilter] = useState('');
  const [saving, setSaving] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const retryRef = useRef<(() => void) | null>(null);
  /** Increases with every record opened or form started, so a late answer for an older one is ignored. */
  const requestRef = useRef(0);

  const fetchList = useCallback(
    () =>
      loadList().then((result) => {
        if (result.data) {
          setCountries(result.data);
          setListState('ready');
        } else {
          setListState('failed');
        }
      }),
    [loadList],
  );

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  // Put the cursor where the mode expects input: the code of a new country, the name of one being changed.
  useEffect(() => {
    const target = mode === 'new' ? codeRef : mode === 'edit' ? nameRef : null;
    if (!target) return;
    const frame = requestAnimationFrame(() => target.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  const visibleHits = useMemo(
    () =>
      hits
        ? hits
            .filter((h) => smartMatches(h.countryName, hitFilter))
            .map((h) => ({
              key: h.countryCode,
              name: h.countryName,
              detail: `${h.countryCode} · ${h.cargoMovement}`,
            }))
        : null,
    [hits, hitFilter],
  );

  const clearFeedback = () => {
    setNotice(null);
    setErrors({});
    setExistingCode(null);
    setHits(null);
    setHitFilter('');
  };

  /** Selecting a record: legacy "Select" in the list dialog / Enter on a code, then `getCountryData`. */
  const openRecord = async (code: string) => {
    const request = ++requestRef.current;
    clearFeedback();
    setMode('view');
    setSelected(code);
    setLoaded(false);
    setDetailLoading(true);
    const result = await loadCountry(code);
    if (request !== requestRef.current) return;
    setDetailLoading(false);
    if (result.data) {
      const values = toForm(result.data);
      setBaseline(values);
      setForm(values);
      setLoaded(true);
    } else if ((result.error as ApiQueryError | undefined)?.status === 404) {
      setNotice({
        kind: 'error',
        title: MESSAGES.loadFailedTitle,
        message: MESSAGES.notFound(code),
      });
    } else {
      retryRef.current = () => void openRecord(code);
      setNotice({
        kind: 'error',
        title: MESSAGES.loadFailedTitle,
        message: SHARED_MESSAGES.loadFailed,
        retry: true,
      });
    }
  };

  /** Legacy Option "New" / `btnNewClick`: an empty form from the one default object. */
  const startNew = () => {
    requestRef.current++;
    clearFeedback();
    setSelected(null);
    setLoaded(true);
    setDetailLoading(false);
    setBaseline(EMPTY);
    setForm(EMPTY);
    setMode('new');
  };

  /** Legacy Option "Change": the same record, editable (the code stays fixed). */
  const startEdit = () => {
    clearFeedback();
    setMode('edit');
  };

  const cancel = () => {
    requestRef.current++;
    clearFeedback();
    setDetailLoading(false);
    if (mode === 'edit') {
      setForm(baseline);
      setMode('view');
    } else {
      setForm(EMPTY);
      setSelected(null);
      setMode('idle');
    }
  };

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

  const changeCode = (next: string) => {
    setForm((f) => ({ ...f, countryCode: next }));
    setExistingCode(null);
    if (next.length > 0) clearError('countryCode');
  };

  /** New, not legacy: warn as soon as the code is left if the loaded list already has it (the save still checks). */
  const checkCodeInList = () => {
    if (mode !== 'new' || form.countryCode.length === 0) return;
    const match = countries.find((c) => sameCode(c.countryCode, form.countryCode));
    if (match) {
      setErrors((e) => ({ ...e, countryCode: MESSAGES.codeInUse(match.countryName) }));
      setExistingCode(match.countryCode);
    }
  };

  /** Legacy `CountryName.subscribe` -> `LoadPreviousData`: New only; the first letter asks the server, more narrows. */
  const changeName = (next: string) => {
    setForm((f) => ({ ...f, countryName: next }));
    if (next.length > 0) clearError('countryName');
    if (mode !== 'new') return;
    if (next.length === 0) {
      setHits(null);
      setHitFilter('');
    } else if (next.length === 1) {
      const request = requestRef.current;
      void searchNames(next).then((result) => {
        if (request !== requestRef.current) return;
        setHits(result.data && result.data.length > 0 ? result.data : null);
        setHitFilter('');
      });
    } else {
      setHitFilter(next);
    }
  };

  const issue = (field: Field, message: string): ValidationIssue => ({
    field,
    message,
    onSelect: () => (field === 'countryCode' ? codeRef : nameRef).current?.focus(),
  });

  const refuseCode = (code: string) => {
    const message = MESSAGES.alreadyExists(code);
    setErrors({ countryCode: message });
    setExistingCode(code);
    setNotice({ kind: 'problems', issues: [issue('countryCode', message)] });
  };

  /** Legacy `beforeSaveCheking` + `chkCountryCode` + `btnSaveData`, in that order. */
  const save = async () => {
    if (saving || (mode !== 'new' && mode !== 'edit')) return;
    const isNew = mode === 'new';
    const values = form;
    const problems: ValidationIssue[] = [];
    if (values.countryName.length <= 0) problems.push(issue('countryName', MESSAGES.enterName));
    if (values.countryCode.length <= 0) problems.push(issue('countryCode', MESSAGES.enterCode));
    if (problems.length > 0) {
      setErrors(Object.fromEntries(problems.map((p) => [p.field, p.message])));
      setNotice({ kind: 'problems', issues: problems });
      return;
    }

    setSaving(true);
    setNotice(null);
    retryRef.current = () => void save();
    try {
      const check = await loadCountry(values.countryCode);
      const exists = Boolean(check.data);
      if (!exists && (check.error as ApiQueryError | undefined)?.status !== 404) {
        setNotice({
          kind: 'error',
          title: MESSAGES.checkFailedTitle,
          message: SHARED_MESSAGES.noServer,
          retry: true,
        });
        return;
      }
      if (isNew && exists) {
        refuseCode(values.countryCode);
        return;
      }
      if (!isNew && !exists) {
        setNotice({
          kind: 'error',
          title: SHARED_MESSAGES.notSavedTitle,
          message: MESSAGES.doesNotExist(values.countryCode),
        });
        return;
      }

      const result = await saveCountry({
        mode: isNew ? 'New' : 'Change',
        countryCode: values.countryCode,
        countryName: values.countryName,
        cargoMovement: values.cargoMovement,
      });
      if ('data' in result && result.data) {
        requestRef.current++;
        clearFeedback();
        setBaseline(values);
        setForm(values);
        setSelected(values.countryCode);
        setLoaded(true);
        setMode('view');
        setNotice({ kind: 'saved', text: MESSAGES.saved(values.countryCode, isNew) });
        void fetchList();
      } else if ('error' in result) {
        const failure = classifySaveFailure(result.error as ApiQueryError);
        if (failure.kind === 'exists') {
          refuseCode(values.countryCode);
        } else if (failure.kind === 'missing') {
          setNotice({
            kind: 'error',
            title: SHARED_MESSAGES.notSavedTitle,
            message: MESSAGES.doesNotExist(values.countryCode),
          });
        } else if (failure.kind === 'noServer') {
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
      }
    } finally {
      setSaving(false);
    }
  };

  const editing = mode === 'new' || mode === 'edit';
  const listRow = countries.find((c) => c.countryCode === selected);
  const title =
    mode === 'new'
      ? 'New country'
      : baseline.countryName && loaded
        ? `${baseline.countryName} (${selected})`
        : (selected ?? 'Country details');

  return (
    <MasterDataPage<Country>
      data-testid="country-page"
      title="Countries"
      context={MASTER_DATA_CONTEXT}
      entityName="country"
      items={countries}
      getItemId={(c) => c.countryCode}
      getSearchText={(c) => `${c.countryCode} ${c.countryName} ${c.cargoMovement}`}
      renderItem={(c) => ({
        primary: c.countryName,
        secondary: `${c.countryCode} · ${c.cargoMovement}`,
        meta: c.contractBlock ? <StatusChip tone="warning" label="Contract block" /> : undefined,
      })}
      listLoading={listState === 'loading'}
      listError={listState === 'failed' ? SHARED_MESSAGES.listFailed : null}
      onRetryList={() => {
        setListState('loading');
        void fetchList();
      }}
      selectedId={selected}
      onSelect={(c) => void openRecord(c.countryCode)}
      mode={mode}
      onNew={startNew}
      onEdit={loaded ? startEdit : undefined}
      onCancel={cancel}
      onSave={() => void save()}
      saving={saving}
      dirty={editing && formDiffers(form, baseline)}
      detailTitle={title}
      detailLoading={detailLoading}
      detailMessage={
        <MasterDetailNotice
          notice={notice}
          onRetry={() => retryRef.current?.()}
          onDismiss={notice?.kind === 'error' ? () => setNotice(null) : undefined}
        />
      }
      onClose={() => void navigate(PATHS.home)}
    >
      {loaded ? (
        <Stack spacing={2}>
          <FieldGrid columns={{ xs: 1, sm: 2 }}>
            <TextInput
              label="Country code"
              inputRef={codeRef}
              value={form.countryCode}
              onChange={mode === 'new' ? changeCode : undefined}
              onBlur={checkCodeInList}
              readOnly={mode !== 'new'}
              required={mode === 'new'}
              maxLength={10}
              error={!!errors.countryCode}
              helperText={errors.countryCode ?? (mode === 'new' ? MESSAGES.codeHelp : undefined)}
            />
            <TextInput
              label="Country name"
              inputRef={nameRef}
              value={form.countryName}
              onChange={editing ? changeName : undefined}
              readOnly={!editing}
              required={editing}
              maxLength={50}
              error={!!errors.countryName}
              helperText={errors.countryName}
            />
            {mode === 'new' && existingCode ? (
              <FieldGridItem span="full">
                <Button variant="outlined" onClick={() => void openRecord(existingCode)}>
                  {`Discard and open ${existingCode}`}
                </Button>
              </FieldGridItem>
            ) : null}
            {mode === 'new' ? (
              <FieldGridItem span="full">
                <SimilarNamesHint names={visibleHits} plural={MESSAGES.similarPlural} />
              </FieldGridItem>
            ) : null}
            {editing ? (
              <SegmentedControl
                label="Cargo movement"
                value={form.cargoMovement}
                options={CARGO_MOVEMENTS}
                onChange={(next) => setForm((f) => ({ ...f, cargoMovement: next }))}
                data-testid="cargo-movement"
              />
            ) : (
              <TextInput label="Cargo movement" value={form.cargoMovement} />
            )}
          </FieldGrid>
          {mode === 'view' && listRow ? (
            <StatGroup
              label="Record history"
              items={[
                { label: 'Created', value: auditText(listRow.dateEnter, listRow.enterBy, fmt) },
                {
                  label: 'Last changed',
                  value: auditText(listRow.dateUpdate, listRow.updateBy, fmt),
                },
                { label: 'Contract block', value: listRow.contractBlock ? 'Yes' : 'No' },
              ]}
            />
          ) : null}
        </Stack>
      ) : null}
    </MasterDataPage>
  );
}

const fmt = (date: string) => formatDmy(date, true);
