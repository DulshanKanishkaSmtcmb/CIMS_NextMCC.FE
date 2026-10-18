import { useEffect, useMemo, useRef, useState } from 'react';
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
import { auditText, MASTER_DATA_CONTEXT, sameKey, SHARED_MESSAGES } from './masterDataPage';
import { useMasterList, useMasterRecord } from './useMasterRecord';
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

/** The one default object a new country starts from (legacy `btnNewClick`: empty, Cargo Movement "Both"). */
const EMPTY: CountryForm = { countryCode: '', countryName: '', cargoMovement: 'Both' };

const toForm = (c: Country): CountryForm => ({
  countryCode: c.countryCode,
  countryName: c.countryName,
  cargoMovement: c.cargoMovement,
});

const fmt = (date: string) => formatDmy(date, true);

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

  const [existingCode, setExistingCode] = useState<string | null>(null);
  const [hits, setHits] = useState<CountryNameHit[] | null>(null);
  const [hitFilter, setHitFilter] = useState('');

  const list = useMasterList(loadList);
  const record = useMasterRecord<CountryForm>(EMPTY, () => {
    setExistingCode(null);
    setHits(null);
    setHitFilter('');
  });
  const { mode, form, errors, editing } = record;

  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

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

  /** Selecting a record: legacy "Select" in the list dialog / Enter on a code, then `getCountryData`. */
  const openRecord = async (code: string) => {
    const request = record.beginView(code);
    const result = await loadCountry(code);
    if (!record.isCurrent(request)) return;
    if (result.data) {
      record.showRecord(toForm(result.data));
    } else if ((result.error as ApiQueryError | undefined)?.status === 404) {
      record.failView({
        kind: 'error',
        title: MESSAGES.loadFailedTitle,
        message: MESSAGES.notFound(code),
      });
    } else {
      record.failView(
        {
          kind: 'error',
          title: MESSAGES.loadFailedTitle,
          message: SHARED_MESSAGES.loadFailed,
          retry: true,
        },
        () => void openRecord(code),
      );
    }
  };

  const changeCode = (next: string) => {
    record.update('countryCode', next);
    setExistingCode(null);
    if (next.length > 0) record.clearError('countryCode');
  };

  /** New, not legacy: warn as soon as the code is left if the loaded list already has it (the save still checks). */
  const checkCodeInList = () => {
    if (mode !== 'new' || form.countryCode.length === 0) return;
    const match = list.items.find((c) => sameKey(c.countryCode, form.countryCode));
    if (match) {
      record.setErrors((e) => ({ ...e, countryCode: MESSAGES.codeInUse(match.countryName) }));
      setExistingCode(match.countryCode);
    }
  };

  /** Legacy `CountryName.subscribe` -> `LoadPreviousData`: New only; the first letter asks the server, more narrows. */
  const changeName = (next: string) => {
    record.update('countryName', next);
    if (next.length > 0) record.clearError('countryName');
    if (mode !== 'new') return;
    if (next.length === 0) {
      setHits(null);
      setHitFilter('');
    } else if (next.length === 1) {
      const request = record.nextRequest();
      void searchNames(next).then((result) => {
        if (!record.isCurrent(request)) return;
        setHits(result.data && result.data.length > 0 ? result.data : null);
        setHitFilter('');
      });
    } else {
      setHitFilter(next);
    }
  };

  const issue = (field: keyof CountryForm, message: string): ValidationIssue => ({
    field,
    message,
    onSelect: () => (field === 'countryCode' ? codeRef : nameRef).current?.focus(),
  });

  const refuseCode = (code: string) => {
    const message = MESSAGES.alreadyExists(code);
    record.showProblems([issue('countryCode', message)]);
    setExistingCode(code);
  };

  /** Legacy `beforeSaveCheking` (name, then code) + `chkCountryCode` + `btnSaveData`. */
  const save = async () => {
    if (record.saving || !editing) return;
    const isNew = mode === 'new';
    const values = form;
    const problems: ValidationIssue[] = [];
    if (values.countryName.length <= 0) problems.push(issue('countryName', MESSAGES.enterName));
    if (values.countryCode.length <= 0) problems.push(issue('countryCode', MESSAGES.enterCode));
    if (problems.length > 0) {
      record.showProblems(problems);
      return;
    }
    await record.runKeyedSave({
      isNew,
      key: values.countryCode,
      check: () => loadCountry(values.countryCode),
      send: () =>
        saveCountry({
          mode: isNew ? 'New' : 'Change',
          countryCode: values.countryCode,
          countryName: values.countryName,
          cargoMovement: values.cargoMovement,
        }),
      messages: MESSAGES,
      refuseExisting: () => refuseCode(values.countryCode),
      onSaved: () => {
        record.showSaved(values, values.countryCode, MESSAGES.saved(values.countryCode, isNew));
        void list.refresh();
      },
      retry: () => void save(),
    });
  };

  const listRow = list.items.find((c) => c.countryCode === record.selected);
  const title =
    mode === 'new'
      ? 'New country'
      : record.loaded && record.baseline.countryName
        ? `${record.baseline.countryName} (${record.selected})`
        : (record.selected ?? 'Country details');

  return (
    <MasterDataPage<Country>
      data-testid="country-page"
      title="Countries"
      context={MASTER_DATA_CONTEXT}
      entityName="country"
      items={list.items}
      getItemId={(c) => c.countryCode}
      getSearchText={(c) => `${c.countryCode} ${c.countryName} ${c.cargoMovement}`}
      renderItem={(c) => ({
        primary: c.countryName,
        secondary: `${c.countryCode} · ${c.cargoMovement}`,
        meta: c.contractBlock ? <StatusChip tone="warning" label="Contract block" /> : undefined,
      })}
      listLoading={list.state === 'loading'}
      listError={list.state === 'failed' ? SHARED_MESSAGES.listFailed : null}
      onRetryList={list.reload}
      selectedId={record.selected}
      onSelect={(c) => void openRecord(c.countryCode)}
      mode={mode}
      onNew={() => record.startNew()}
      onEdit={record.loaded ? record.startEdit : undefined}
      onCancel={record.cancel}
      onSave={() => void save()}
      saving={record.saving}
      dirty={record.dirty}
      detailTitle={title}
      detailLoading={record.detailLoading}
      detailMessage={
        <MasterDetailNotice
          notice={record.notice}
          onRetry={record.retry}
          onDismiss={record.notice?.kind === 'error' ? record.dismissNotice : undefined}
        />
      }
      onClose={() => void navigate(PATHS.home)}
    >
      {record.loaded ? (
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
                onChange={(next) => record.update('cargoMovement', next)}
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
