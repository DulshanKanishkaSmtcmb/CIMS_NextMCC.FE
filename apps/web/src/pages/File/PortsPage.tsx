import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  CheckboxField,
  FieldGrid,
  FieldGridItem,
  formatDmy,
  MasterDataPage,
  Stack,
  StatGroup,
  StatusChip,
  TextInput,
  type ValidationIssue,
} from '@cims/ui';
import {
  useLazyGetCountryQuery,
  useLazyGetPortQuery,
  useLazyGetPortsQuery,
  useLazySearchPortsQuery,
  useSavePortMutation,
  type Port,
  type PortNameHit,
} from '../../services/masterDataApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { smartMatches } from './masterEntry';
import { auditText, MASTER_DATA_CONTEXT, sameKey, SHARED_MESSAGES } from './masterDataPage';
import { useMasterList, useMasterRecord } from './useMasterRecord';
import { PORT_MESSAGES as MESSAGES } from './portMessages';
import { CountryLookupField } from './CountryLookupField';
import { MasterDetailNotice } from './MasterDetailNotice';
import { SimilarNamesHint } from './SimilarNamesHint';

/** What is saved (the country's name is only shown). */
interface PortForm {
  portCode: string;
  portName: string;
  countryCode: string;
  isDivertable: boolean;
}

/** The one default object a new port starts from (legacy `btnNewClick`, plus Is Divertable off: fix P1). */
const EMPTY: PortForm = { portCode: '', portName: '', countryCode: '', isDivertable: false };

const toForm = (p: Port): PortForm => ({
  portCode: p.portCode,
  portName: p.portName,
  countryCode: p.countryCode,
  isDivertable: p.isDivertable,
});

const fmt = (date: string) => formatDmy(date, true);

/**
 * Ports (legacy /File/Ports "Ports Master Details", CloudMenu 100.06) on the MasterDataPage template (docs/19 3.1),
 * following the Countries pattern. Kept from legacy (docs/15 C): the same calls and bodies (list, port by code on
 * selection and as the existence check before every save, first-letter name search for the similar-names hint,
 * the country list and the country by code for its name, POST new / PUT change with portCode, portName,
 * countryCode, isDivertable), the checks in the legacy order (name, code, exists / not exists), the country is
 * optional, the code cannot change after it is saved.
 */
export function PortsPage() {
  const navigate = useNavigate();
  const [loadList] = useLazyGetPortsQuery();
  const [loadPort] = useLazyGetPortQuery();
  const [searchNames] = useLazySearchPortsQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  const [savePort] = useSavePortMutation();

  const [countryName, setCountryName] = useState('');
  const [savedCountryName, setSavedCountryName] = useState('');
  const [existingCode, setExistingCode] = useState<string | null>(null);
  const [hits, setHits] = useState<PortNameHit[] | null>(null);
  const [hitFilter, setHitFilter] = useState('');

  const list = useMasterList(loadList);
  const record = useMasterRecord<PortForm>(EMPTY, () => {
    setExistingCode(null);
    setHits(null);
    setHitFilter('');
  });
  const { mode, form, errors, editing } = record;

  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

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
            .filter((h) => smartMatches(h.portName, hitFilter))
            .map((h) => ({
              key: h.portCode,
              name: h.portName,
              detail: [h.portCode, h.countryCode].filter(Boolean).join(' · '),
            }))
        : null,
    [hits, hitFilter],
  );

  /** Selecting a port: legacy `LoadPortData` (name, divertable, country), then the country's name. */
  const openRecord = async (code: string) => {
    const request = record.beginView(code);
    setCountryName('');
    const result = await loadPort(code);
    if (!record.isCurrent(request)) return;
    if (result.data && !result.error) {
      const values = toForm(result.data);
      record.showRecord(values);
      if (values.countryCode.length !== 0) {
        const country = await loadCountry(values.countryCode);
        if (!record.isCurrent(request)) return;
        const name = country.data?.countryName ?? '';
        setCountryName(name);
        setSavedCountryName(name);
      } else {
        // The legacy page kept the previous port's country name here (P2).
        setSavedCountryName('');
      }
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

  const startNew = () => {
    setCountryName('');
    record.startNew();
  };

  const cancel = () => {
    setCountryName(mode === 'edit' ? savedCountryName : '');
    record.cancel();
  };

  const changeCode = (next: string) => {
    record.update('portCode', next);
    setExistingCode(null);
    if (next.length > 0) record.clearError('portCode');
  };

  /** New, not legacy: warn as soon as the code is left if the loaded list already has it (the save still checks). */
  const checkCodeInList = () => {
    if (mode !== 'new' || form.portCode.length === 0) return;
    const match = list.items.find((p) => sameKey(p.portCode, form.portCode));
    if (match) {
      record.setErrors((e) => ({ ...e, portCode: MESSAGES.codeInUse(match.portName) }));
      setExistingCode(match.portCode);
    }
  };

  /** Legacy `PortName.subscribe` -> `LoadPreviousData`: New only; the first letter asks the server, more narrows. */
  const changeName = (next: string) => {
    record.update('portName', next);
    if (next.length > 0) record.clearError('portName');
    if (mode !== 'new') return;
    if (next.length === 0) {
      setHits(null);
      setHitFilter('');
    } else if (next.length === 1) {
      // The letters typed while the answer is on its way narrow it when it arrives.
      setHitFilter('');
      const request = record.nextRequest();
      void searchNames(next).then((result) => {
        if (!record.isCurrent(request)) return;
        setHits(result.data && result.data.length > 0 ? result.data : null);
      });
    } else {
      setHitFilter(next);
    }
  };

  const issue = (field: keyof PortForm, message: string): ValidationIssue => ({
    field,
    message,
    onSelect: () => (field === 'portCode' ? codeRef : nameRef).current?.focus(),
  });

  const refuseCode = (code: string) => {
    record.showProblems([issue('portCode', MESSAGES.alreadyExists(code))]);
    setExistingCode(code);
  };

  /** Legacy `beforeSaveCheking` (name, then code) + `chkPortCode` + `btnSaveData`. */
  const save = async () => {
    if (record.saving || !editing) return;
    const isNew = mode === 'new';
    const values = form;
    const problems: ValidationIssue[] = [];
    if (values.portName.length <= 0) problems.push(issue('portName', MESSAGES.enterName));
    if (values.portCode.length <= 0) problems.push(issue('portCode', MESSAGES.enterCode));
    if (problems.length > 0) {
      record.showProblems(problems);
      return;
    }
    await record.runKeyedSave({
      isNew,
      key: values.portCode,
      check: () => loadPort(values.portCode),
      send: () =>
        savePort({
          mode: isNew ? 'New' : 'Change',
          portCode: values.portCode,
          portName: values.portName,
          countryCode: values.countryCode,
          isDivertable: values.isDivertable,
        }),
      messages: MESSAGES,
      refuseExisting: () => refuseCode(values.portCode),
      onSaved: () => {
        setSavedCountryName(countryName);
        record.showSaved(values, values.portCode, MESSAGES.saved(values.portCode, isNew));
        void list.refresh();
      },
      retry: () => void save(),
    });
  };

  const listRow = list.items.find((p) => p.portCode === record.selected);
  const title =
    mode === 'new'
      ? 'New port'
      : record.loaded && record.baseline.portName
        ? `${record.baseline.portName} (${record.selected})`
        : (record.selected ?? 'Port details');

  return (
    <MasterDataPage<Port>
      data-testid="ports-page"
      title="Ports"
      context={MASTER_DATA_CONTEXT}
      entityName="port"
      items={list.items}
      getItemId={(p) => p.portCode}
      getSearchText={(p) => `${p.portCode} ${p.portName} ${p.countryCode}`}
      renderItem={(p) => ({
        primary: p.portName,
        secondary: [p.portCode, p.countryCode || MESSAGES.noCountry].join(' · '),
        meta: p.isDivertable ? <StatusChip tone="info" label="Divertable" /> : undefined,
      })}
      listLoading={list.state === 'loading'}
      listError={list.state === 'failed' ? SHARED_MESSAGES.listFailed : null}
      onRetryList={list.reload}
      selectedId={record.selected}
      onSelect={(p) => void openRecord(p.portCode)}
      mode={mode}
      onNew={startNew}
      onEdit={record.loaded ? record.startEdit : undefined}
      onCancel={cancel}
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
              label="Port code"
              inputRef={codeRef}
              value={form.portCode}
              onChange={mode === 'new' ? changeCode : undefined}
              onBlur={checkCodeInList}
              readOnly={mode !== 'new'}
              required={mode === 'new'}
              maxLength={10}
              error={!!errors.portCode}
              helperText={errors.portCode ?? (mode === 'new' ? MESSAGES.codeHelp : undefined)}
            />
            <TextInput
              label="Port name"
              inputRef={nameRef}
              value={form.portName}
              onChange={editing ? changeName : undefined}
              readOnly={!editing}
              required={editing}
              maxLength={50}
              error={!!errors.portName}
              helperText={errors.portName}
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
            <CountryLookupField
              code={form.countryCode}
              countryName={countryName}
              readOnly={!editing}
              emptyHelp={editing ? MESSAGES.countryOptional : MESSAGES.noCountry}
              onChange={(code, name) => {
                record.update('countryCode', code);
                setCountryName(name);
              }}
            />
            {editing ? (
              <CheckboxField
                label="Divertable"
                checked={form.isDivertable}
                onChange={(checked) => record.update('isDivertable', checked)}
              />
            ) : (
              <TextInput label="Divertable" value={form.isDivertable ? 'Yes' : 'No'} />
            )}
          </FieldGrid>
          {mode === 'view' && listRow ? (
            <StatGroup
              label="Record history"
              items={[
                { label: 'Created', value: auditText(listRow.dateCreate, listRow.createBy, fmt) },
                {
                  label: 'Last changed',
                  value: auditText(listRow.dateUpdate, listRow.updateBy, fmt),
                },
                { label: 'Sea or air port', value: listRow.seaOrAirPort || '—' },
              ]}
            />
          ) : null}
        </Stack>
      ) : null}
    </MasterDataPage>
  );
}
