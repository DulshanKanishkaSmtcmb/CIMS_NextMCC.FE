import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FieldGrid, FieldGridItem, FormSection, MasterDataPage, Stack, TextInput } from '@cims/ui';
import { useLazyGetCountryQuery } from '../../services/masterDataApi';
import {
  useLazyGetPmSupplierQuery,
  useLazyGetPmSuppliersQuery,
  useSavePmSupplierMutation,
  type PmSupplier,
  type SavePmSupplierResult,
} from '../../services/supplierApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { MASTER_DATA_CONTEXT, SHARED_MESSAGES } from './masterDataPage';
import { useMasterList, useMasterRecord } from './useMasterRecord';
import { PM_SUPPLIER_MESSAGES as MESSAGES } from './supplierMessages';
import { CountryLookupField } from './CountryLookupField';
import { MasterDetailNotice } from './MasterDetailNotice';

/** Everything the save sends (the country's name is only shown). */
interface PmSupplierForm {
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
}

/** The one default object a new PM supplier starts from (legacy `btnNewClick`, plus the country: fix P2). */
const EMPTY: PmSupplierForm = {
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
};

const toForm = (s: PmSupplier): PmSupplierForm => ({
  code: s.pmSupplierCode,
  name: s.pmSupplierName,
  address1: s.pmSupplierAddress1,
  address2: s.pmSupplierAddress2,
  address3: s.pmSupplierAddress3,
  address4: s.pmSupplierAddress4,
  countryCode: s.countryCode ?? '',
  tel: s.pmSupplierTel,
  fax: s.pmSupplierFax,
  email: s.pmSupplierEmail,
  contact1: s.pmSupplierContact1,
  contact2: s.pmSupplierContact2,
  contact3: s.pmSupplierContact3,
});

type TextKey = Exclude<keyof PmSupplierForm, 'code' | 'name' | 'countryCode'>;

/**
 * PM suppliers (legacy /File/PmSupplier "PM Suppliers Master Details", CloudMenu 100.16) on the MasterDataPage
 * template, following the Suppliers page without its freight codes, LIMA, REX, similar-names hint and starting-letter
 * rule (the legacy page had none of them). Kept from legacy (docs/16 C): the same calls and bodies (list, PM supplier
 * by code on selection and as the existence check before a change only, the country list and the country by code,
 * POST without a code for a new PM supplier, which returns the generated code, PUT with every field for a change),
 * only the name is required.
 */
export function PmSupplierPage() {
  const navigate = useNavigate();
  const [loadList] = useLazyGetPmSuppliersQuery();
  const [loadPmSupplier] = useLazyGetPmSupplierQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  const [savePmSupplier] = useSavePmSupplierMutation();

  const [countryName, setCountryName] = useState('');
  const [savedCountryName, setSavedCountryName] = useState('');

  const list = useMasterList(loadList);
  const record = useMasterRecord<PmSupplierForm>(EMPTY);
  const { mode, form, errors, editing } = record;

  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (mode !== 'new' && mode !== 'edit') return;
    const frame = requestAnimationFrame(() => nameRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  /** Selecting a PM supplier: legacy `LoadSupplierData` (getPMSupplierData), then the country's name. */
  const openRecord = async (code: string) => {
    const request = record.beginView(code);
    setCountryName('');
    const result = await loadPmSupplier(code);
    if (!record.isCurrent(request)) return;
    if (result.data && !result.error) {
      const values = toForm(result.data);
      record.showRecord(values);
      const country =
        values.countryCode.length === 0 ? null : await loadCountry(values.countryCode);
      if (!record.isCurrent(request)) return;
      const name = country?.data && !country.error ? country.data.countryName : '';
      setCountryName(name);
      setSavedCountryName(name);
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

  const changeName = (next: string) => {
    record.update('name', next);
    if (next.length > 0) record.clearError('name');
  };

  /** Legacy `beforeSaveCheking` (the name only) + the existence check of a change + `btnSaveData`. */
  const save = async () => {
    if (record.saving || !editing) return;
    const isNew = mode === 'new';
    const values = form;
    if (values.name.length <= 0) {
      record.showProblems([
        { field: 'name', message: MESSAGES.enterName, onSelect: () => nameRef.current?.focus() },
      ]);
      return;
    }
    await record.runKeyedSave({
      isNew,
      key: values.code,
      check: isNew ? undefined : () => loadPmSupplier(values.code),
      send: () =>
        savePmSupplier({
          mode: isNew ? 'New' : 'Change',
          pmSupplierCode: values.code,
          pmSupplierName: values.name,
          pmSupplierAddress1: values.address1,
          pmSupplierAddress2: values.address2,
          pmSupplierAddress3: values.address3,
          pmSupplierAddress4: values.address4,
          pmSupplierContact1: values.contact1,
          pmSupplierContact2: values.contact2,
          pmSupplierContact3: values.contact3,
          pmSupplierTel: values.tel,
          pmSupplierEmail: values.email,
          pmSupplierFax: values.fax,
          countryCode: values.countryCode,
        }),
      messages: MESSAGES,
      refuseExisting: () =>
        record.setNotice({
          kind: 'error',
          title: SHARED_MESSAGES.notSavedTitle,
          message: MESSAGES.sequenceFull(values.name[0] ?? ''),
        }),
      onSaved: (data) => {
        const code = isNew ? (data as SavePmSupplierResult).pmSupplierCode : values.code;
        setSavedCountryName(countryName);
        record.showSaved({ ...values, code }, code, MESSAGES.saved(code, isNew));
        void list.refresh();
      },
      retry: () => void save(),
    });
  };

  const text = (label: string, key: TextKey) => (
    <TextInput
      key={key}
      label={label}
      value={form[key]}
      onChange={editing ? (value) => record.update(key, value) : undefined}
      readOnly={!editing}
      maxLength={50}
    />
  );

  const title =
    mode === 'new'
      ? 'New PM supplier'
      : record.loaded && record.baseline.name
        ? `${record.baseline.name} (${record.selected})`
        : (record.selected ?? 'PM supplier details');

  return (
    <MasterDataPage<PmSupplier>
      data-testid="pm-supplier-page"
      title="PM suppliers"
      context={MASTER_DATA_CONTEXT}
      entityName="PM supplier"
      pluralName="PM suppliers"
      items={list.items}
      getItemId={(s) => s.pmSupplierCode}
      getSearchText={(s) =>
        `${s.pmSupplierCode} ${s.pmSupplierName} ${s.countryCode ?? ''} ${s.pmSupplierAddress1}`
      }
      renderItem={(s) => ({
        primary: s.pmSupplierName,
        secondary: [s.pmSupplierCode, s.countryCode, s.pmSupplierAddress1]
          .filter(Boolean)
          .join(' · '),
      })}
      listLoading={list.state === 'loading'}
      listError={list.state === 'failed' ? SHARED_MESSAGES.listFailed : null}
      onRetryList={list.reload}
      selectedId={record.selected}
      onSelect={(s) => void openRecord(s.pmSupplierCode)}
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
              label="PM supplier code"
              value={mode === 'new' ? '' : form.code}
              readOnly
              helperText={mode === 'new' ? MESSAGES.codeAssigned : undefined}
            />
            <FieldGridItem span={2}>
              <TextInput
                label="PM supplier name"
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
          </FieldGrid>

          <FormSection variant="plain" headingLevel={3} title="Address">
            <FieldGrid columns={{ xs: 1, sm: 2 }}>
              <CountryLookupField
                code={form.countryCode}
                countryName={countryName}
                readOnly={!editing}
                emptyHelp={editing ? MESSAGES.countryOptional : undefined}
                onChange={(code, name) => {
                  record.update('countryCode', code);
                  setCountryName(name);
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
        </Stack>
      ) : null}
    </MasterDataPage>
  );
}
