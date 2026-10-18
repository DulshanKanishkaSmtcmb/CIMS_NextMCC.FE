import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FieldGrid,
  FieldGridItem,
  formatDmy,
  FormSection,
  MasterDataPage,
  Stack,
  StatGroup,
  TextInput,
  type LookupColumn,
  type ValidationIssue,
} from '@cims/ui';
import { useLazyGetCountryQuery } from '../../services/masterDataApi';
import {
  useLazyGetAirShipperQuery,
  useLazyGetAirShippersQuery,
  useLazyGetSeaShipperQuery,
  useLazyGetSeaShippersQuery,
  useLazyGetSupplierQuery,
  useLazyGetSuppliersQuery,
  useLazySearchSuppliersQuery,
  useSaveSupplierMutation,
  type FreightShipper,
  type SaveSupplierResult,
  type Supplier,
  type SupplierNameHit,
} from '../../services/supplierApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { smartMatches } from './masterEntry';
import { auditText, MASTER_DATA_CONTEXT, SHARED_MESSAGES } from './masterDataPage';
import { useMasterList, useMasterRecord } from './useMasterRecord';
import { FREIGHT_TEXTS, SUPPLIER_MESSAGES as MESSAGES } from './supplierMessages';
import { CodeLookupField } from './CodeLookupField';
import { CountryLookupField } from './CountryLookupField';
import { MasterDetailNotice } from './MasterDetailNotice';
import { SimilarNamesHint } from './SimilarNamesHint';

/** Everything the save sends (the looked-up names are only shown). */
interface SupplierForm {
  code: string;
  name: string;
  address1: string;
  address2: string;
  address3: string;
  address4: string;
  countryCode: string;
  tel: string;
  fax: string;
  email: string;
  contact1: string;
  contact2: string;
  contact3: string;
  sfosCode: string;
  afosCode: string;
  lima: string;
  rex: string;
}

/** The one default object a new supplier starts from (legacy `btnNewClick`, plus the country: fix U4). */
const EMPTY: SupplierForm = {
  code: '',
  name: '',
  address1: '',
  address2: '',
  address3: '',
  address4: '',
  countryCode: '',
  tel: '',
  fax: '',
  email: '',
  contact1: '',
  contact2: '',
  contact3: '',
  sfosCode: '',
  afosCode: '',
  lima: '',
  rex: '',
};

/** Legacy `LoadSupplierData`, with the country and the Lima code it forgot (U1). */
const toForm = (s: Supplier): SupplierForm => ({
  code: s.shipperCode,
  name: s.shipperName,
  address1: s.shipperAddress1,
  address2: s.shipperAddress2,
  address3: s.shipperAddress3,
  address4: s.shipperAddress4,
  countryCode: s.countryCode ?? '',
  tel: s.shipperTel,
  fax: s.shipperFax,
  email: s.shipperEmail,
  contact1: s.shipperContact1,
  contact2: s.shipperContact2,
  contact3: s.shipperContact3,
  sfosCode: s.shipperCodeSea,
  afosCode: s.shipperCodeAir,
  lima: s.limaSupplierCode,
  rex: s.rexNo,
});

interface Names {
  country: string;
  sea: string;
  air: string;
}
const NO_NAMES: Names = { country: '', sea: '', air: '' };

const FREIGHT_COLUMNS: readonly LookupColumn[] = [
  { field: 'shCode', headerName: 'Shipper code', width: 130 },
  { field: 'shName', headerName: 'Shipper name', width: 280 },
  { field: 'shAdd1', headerName: 'Address', width: 240 },
];

/** Plain text fields with their API limit (the stored-procedure parameter sizes, docs/16 A.4). */
type TextKey = Exclude<keyof SupplierForm, 'code' | 'countryCode' | 'sfosCode' | 'afosCode'>;

const fmt = (date: string) => formatDmy(date, true);

/**
 * Suppliers (legacy /File/Supplier "Suppliers Master Details", CloudMenu 100.04) on the MasterDataPage template
 * (docs/19 3.1), following the Countries pattern with a server-generated code. Kept from legacy (docs/16 B): the same
 * calls and bodies (list; supplier by code on selection and as the existence check before a change only; first-letter
 * name search for the similar-names hint; the country, sea-shipper and air-shipper lists and look-ups; POST without a
 * code for a new supplier, which returns the generated code; PUT with every field for a change), the checks in the
 * legacy order (name; for a change the code and the starting-letter rule), the code never typed for a new supplier.
 */
export function SupplierPage() {
  const navigate = useNavigate();
  const [loadList] = useLazyGetSuppliersQuery();
  const [loadSupplier] = useLazyGetSupplierQuery();
  const [searchNames] = useLazySearchSuppliersQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  const [loadSeaShippers] = useLazyGetSeaShippersQuery();
  const [loadSeaShipper] = useLazyGetSeaShipperQuery();
  const [loadAirShippers] = useLazyGetAirShippersQuery();
  const [loadAirShipper] = useLazyGetAirShipperQuery();
  const [saveSupplier] = useSaveSupplierMutation();

  const [names, setNames] = useState<Names>(NO_NAMES);
  const [savedNames, setSavedNames] = useState<Names>(NO_NAMES);
  const [hits, setHits] = useState<SupplierNameHit[] | null>(null);
  const [hitFilter, setHitFilter] = useState('');

  const list = useMasterList(loadList);
  const record = useMasterRecord<SupplierForm>(EMPTY, () => {
    setHits(null);
    setHitFilter('');
  });
  const { mode, form, errors, editing } = record;

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== 'new' && mode !== 'edit') return;
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  const visibleHits = useMemo(
    () =>
      hits
        ? hits
            .filter((h) => smartMatches(h.shipperName, hitFilter))
            .map((h) => ({
              key: h.shipperCode,
              name: h.shipperName,
              detail: [h.shipperCode, h.shipperAddress1].filter(Boolean).join(' · '),
            }))
        : null,
    [hits, hitFilter],
  );

  /** The names next to the country and shipper codes of a loaded supplier (legacy `….subscribe` look-ups). */
  const loadNames = async (values: SupplierForm, request: number) => {
    const name = async (code: string, read: (c: string) => PromiseLike<string | undefined>) =>
      code.length === 0 ? '' : ((await read(code)) ?? '');
    const [country, sea, air] = await Promise.all([
      name(values.countryCode, (c) => loadCountry(c).then((r) => r.data?.countryName)),
      name(values.sfosCode, (c) => loadSeaShipper(c).then((r) => r.data?.shName)),
      name(values.afosCode, (c) => loadAirShipper(c).then((r) => r.data?.shName)),
    ]);
    if (!record.isCurrent(request)) return;
    const loadedNames = { country, sea, air };
    setNames(loadedNames);
    setSavedNames(loadedNames);
  };

  /** Selecting a supplier: legacy "Select" / Enter on a code, then `getSupplierData`. */
  const openRecord = async (code: string) => {
    const request = record.beginView(code);
    setNames(NO_NAMES);
    const result = await loadSupplier(code);
    if (!record.isCurrent(request)) return;
    if (result.data && !result.error) {
      const values = toForm(result.data);
      record.showRecord(values);
      void loadNames(values, request);
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
    setNames(NO_NAMES);
    record.startNew();
  };

  const cancel = () => {
    setNames(mode === 'edit' ? savedNames : NO_NAMES);
    record.cancel();
  };

  const setText = (key: TextKey, value: string) => record.update(key, value);

  /** Legacy `SupplierName.subscribe` -> `LoadPreviousData`: New only; it stays when the field is left (U7). */
  const changeName = (next: string) => {
    record.update('name', next);
    if (next.length > 0) record.clearError('name');
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

  const nameIssue = (message: string): ValidationIssue => ({
    field: 'name',
    message,
    onSelect: () => nameRef.current?.focus(),
  });

  /** Legacy `beforeSaveCheking`: the first failing check stops, as legacy (name; code; starting letter). */
  const firstProblem = (values: SupplierForm, isNew: boolean): ValidationIssue | null => {
    if (values.name.length <= 0) return nameIssue(MESSAGES.enterName);
    if (isNew) return null;
    if (values.code.length <= 0) return { field: 'code', message: MESSAGES.enterCode };
    if (values.code[0] !== values.name[0])
      return nameIssue(MESSAGES.startWith(values.code[0], values.code));
    return null;
  };

  /** Legacy `btnSaveData` (+ `chkSupplierCode` for a change). */
  const save = async () => {
    if (record.saving || !editing) return;
    const isNew = mode === 'new';
    const values = form;
    const problem = firstProblem(values, isNew);
    if (problem) {
      record.showProblems([problem]);
      return;
    }
    await record.runKeyedSave({
      isNew,
      key: values.code,
      check: isNew ? undefined : () => loadSupplier(values.code),
      send: () =>
        saveSupplier({
          mode: isNew ? 'New' : 'Change',
          shipperCode: values.code,
          shipperName: values.name,
          shipperAddress1: values.address1,
          shipperAddress2: values.address2,
          shipperAddress3: values.address3,
          shipperAddress4: values.address4,
          shipperContact1: values.contact1,
          shipperContact2: values.contact2,
          shipperContact3: values.contact3,
          shipperTel: values.tel,
          shipperEmail: values.email,
          shipperFax: values.fax,
          countryCode: values.countryCode,
          shipperCodeAir: values.afosCode,
          shipperCodeSea: values.sfosCode,
          limaSupplierCode: values.lima,
          rexNo: values.rex,
        }),
      messages: MESSAGES,
      refuseExisting: () =>
        record.setNotice({
          kind: 'error',
          title: SHARED_MESSAGES.notSavedTitle,
          message: MESSAGES.sequenceFull(values.name[0] ?? ''),
        }),
      onSaved: (data) => {
        const code = isNew ? (data as SaveSupplierResult).supplierCode : values.code;
        setSavedNames(names);
        record.showSaved({ ...values, code }, code, MESSAGES.saved(code, isNew));
        void list.refresh();
      },
      retry: () => void save(),
    });
  };

  const text = (label: string, key: TextKey, maxLength = 50, span?: number | 'full') => {
    const input = (
      <TextInput
        label={label}
        value={form[key]}
        onChange={editing ? (value) => setText(key, value) : undefined}
        readOnly={!editing}
        maxLength={maxLength}
      />
    );
    return span ? (
      <FieldGridItem key={key} span={span}>
        {input}
      </FieldGridItem>
    ) : (
      <div key={key}>{input}</div>
    );
  };

  const listRow = list.items.find((s) => s.shipperCode === record.selected);
  const title =
    mode === 'new'
      ? 'New supplier'
      : record.loaded && record.baseline.name
        ? `${record.baseline.name} (${record.selected})`
        : (record.selected ?? 'Supplier details');

  return (
    <MasterDataPage<Supplier>
      data-testid="supplier-page"
      title="Suppliers"
      context={MASTER_DATA_CONTEXT}
      entityName="supplier"
      items={list.items}
      getItemId={(s) => s.shipperCode}
      getSearchText={(s) =>
        `${s.shipperCode} ${s.shipperName} ${s.countryCode ?? ''} ${s.shipperAddress1}`
      }
      renderItem={(s) => ({
        primary: s.shipperName,
        secondary: [s.shipperCode, s.countryCode, s.shipperAddress1].filter(Boolean).join(' · '),
      })}
      listLoading={list.state === 'loading'}
      listError={list.state === 'failed' ? SHARED_MESSAGES.listFailed : null}
      onRetryList={list.reload}
      selectedId={record.selected}
      onSelect={(s) => void openRecord(s.shipperCode)}
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
        <Stack spacing={2.5}>
          <FieldGrid columns={{ xs: 1, sm: 3 }}>
            <TextInput
              label="Supplier code"
              value={mode === 'new' ? '' : form.code}
              readOnly
              helperText={mode === 'new' ? MESSAGES.codeAssigned : undefined}
              error={!!errors.code}
            />
            <FieldGridItem span={2}>
              <TextInput
                label="Supplier name"
                inputRef={nameRef}
                value={form.name}
                onChange={editing ? changeName : undefined}
                readOnly={!editing}
                required={editing}
                maxLength={50}
                error={!!errors.name}
                helperText={errors.name}
              />
            </FieldGridItem>
            {mode === 'new' ? (
              <FieldGridItem span="full">
                <SimilarNamesHint names={visibleHits} plural={MESSAGES.similarPlural} />
              </FieldGridItem>
            ) : null}
          </FieldGrid>

          <FormSection variant="plain" headingLevel={3} title="Address">
            <FieldGrid columns={{ xs: 1, sm: 2 }}>
              <CountryLookupField
                code={form.countryCode}
                countryName={names.country}
                readOnly={!editing}
                emptyHelp={editing ? MESSAGES.countryOptional : undefined}
                onChange={(code, name) => {
                  record.update('countryCode', code);
                  setNames((n) => ({ ...n, country: name }));
                }}
              />
              <div />
              {text('Address line 1', 'address1')}
              {text('Address line 2', 'address2')}
              {text('Address line 3', 'address3')}
              {text('Address line 4', 'address4')}
            </FieldGrid>
          </FormSection>

          <FormSection variant="plain" headingLevel={3} title="Contact">
            <FieldGrid columns={{ xs: 1, sm: 3 }}>
              {text('Telephone no', 'tel')}
              {text('Fax no', 'fax')}
              {text('Email address', 'email')}
              {text('Contact person 1', 'contact1')}
              {text('Contact person 2', 'contact2')}
              {text('Contact person 3', 'contact3')}
            </FieldGrid>
          </FormSection>

          <FormSection variant="plain" headingLevel={3} title="Codes in other systems">
            <FieldGrid columns={{ xs: 1, sm: 2 }}>
              <CodeLookupField<FreightShipper>
                label="Sea shipper (SFOS)"
                code={form.sfosCode}
                displayName={names.sea}
                readOnly={!editing}
                maxLength={5}
                loadList={() => loadSeaShippers()}
                loadName={(c) =>
                  loadSeaShipper(c).then((r) => ({
                    data: r.data ? { name: r.data.shName } : undefined,
                    error: r.error,
                  }))
                }
                columns={FREIGHT_COLUMNS}
                getCode={(r) => r.shCode}
                texts={FREIGHT_TEXTS.sea}
                onChange={(code, name) => {
                  record.update('sfosCode', code);
                  setNames((n) => ({ ...n, sea: name }));
                }}
              />
              <CodeLookupField<FreightShipper>
                label="Air shipper (AFOS)"
                code={form.afosCode}
                displayName={names.air}
                readOnly={!editing}
                maxLength={5}
                loadList={() => loadAirShippers()}
                loadName={(c) =>
                  loadAirShipper(c).then((r) => ({
                    data: r.data ? { name: r.data.shName } : undefined,
                    error: r.error,
                  }))
                }
                columns={FREIGHT_COLUMNS}
                getCode={(r) => r.shCode}
                texts={FREIGHT_TEXTS.air}
                onChange={(code, name) => {
                  record.update('afosCode', code);
                  setNames((n) => ({ ...n, air: name }));
                }}
              />
              {text('LIMA supplier code', 'lima', 10)}
              {text('REX no', 'rex')}
            </FieldGrid>
          </FormSection>

          {mode === 'view' && listRow ? (
            <StatGroup
              label="Record history"
              items={[
                { label: 'Created', value: auditText(listRow.dateCreate, listRow.createBy, fmt) },
                {
                  label: 'Last changed',
                  value: auditText(listRow.dateUpdate, listRow.updateBy, fmt),
                },
              ]}
            />
          ) : null}
        </Stack>
      ) : null}
    </MasterDataPage>
  );
}
