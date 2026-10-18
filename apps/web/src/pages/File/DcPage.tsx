import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  FieldGrid,
  FieldGridItem,
  FormSection,
  MasterDataPage,
  Stack,
  PropertyList,
  TextInput,
  type PropertyItem,
} from '@cims/ui';
import {
  useLazyGetCountryQuery,
  useLazyGetDcQuery,
  useLazyGetDcsQuery,
  useSaveDcMutation,
  type Dc,
} from '../../services/masterDataApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { MASTER_DATA_CONTEXT, sameKey, SHARED_MESSAGES } from './masterDataPage';
import { useMasterList, useMasterRecord } from './useMasterRecord';
import { DC_MESSAGES as MESSAGES } from './dcMessages';
import { CountryLookupField } from './CountryLookupField';
import { MasterDetailNotice } from './MasterDetailNotice';

/** What is saved: the name (the key) and the country. */
interface DcForm {
  whDes: string;
  countryCode: string;
}

const EMPTY: DcForm = { whDes: '', countryCode: '' };

const yesNo = (value: boolean) => (value ? 'Yes' : 'No');
const text = (value: string | null | undefined | number) =>
  value === null || value === undefined || String(value).trim() === '' ? '—' : String(value);

/** The 36 DestWarehouse columns this page never edits (the legacy "DC Listing" dialog showed them all). */
function settings(dc: Dc): PropertyItem[] {
  return [
    { label: 'DC code', value: text(dc.whCode) },
    { label: 'Main group', value: text(dc.whDesMain) },
    { label: 'Loading order', value: text(dc.loadingOrder) },
    { label: 'Address', value: text(dc.address) },
    { label: 'Outer label', value: yesNo(dc.outerLabel) },
    { label: 'EAN label scan', value: yesNo(dc.eanLabelScan) },
    { label: 'Rework', value: yesNo(dc.reworkApply) },
    { label: 'RFID price tag', value: yesNo(dc.rfidPriceTag) },
    { label: 'RFID price tag validation', value: text(dc.rfidPriceTagValidate) },
    { label: 'Remove original tag', value: yesNo(dc.removeOriginalTag) },
    { label: 'Joker tags for sets', value: yesNo(dc.jokerTagsForSets) },
    { label: 'Care warning label', value: yesNo(dc.careWarningLabel) },
    { label: 'Pre-validation', value: yesNo(dc.preValidationRun) },
    { label: 'EAN label outer box', value: yesNo(dc.eanLabelOuterBox) },
    { label: 'EAN description column', value: text(dc.eanDesCol) },
    { label: 'Pack additional box', value: yesNo(dc.packAdditionalBox) },
    { label: 'Box PM code', value: text(dc.boxPmCode) },
    { label: 'Hanger use', value: yesNo(dc.hangerUse) },
    { label: 'EAN label piece', value: yesNo(dc.eanLabelPiece) },
    { label: 'Post-validation', value: yesNo(dc.postValidation) },
    { label: 'Stock update', value: yesNo(dc.stockUpdate) },
    { label: 'Authorized to PO plan', value: yesNo(dc.authorizedToPoPlan) },
    { label: 'Item option fixed length', value: yesNo(dc.itemOptionFixedLength) },
    { label: 'Item option manual', value: yesNo(dc.itemOptionManual) },
    { label: 'Price symbol', value: text(dc.priceSymble) },
    { label: 'Print price tag', value: yesNo(dc.printPriceTag) },
    { label: 'Box pack separate', value: yesNo(dc.boxPackSeperate) },
    { label: 'Store pick', value: yesNo(dc.storePick) },
    { label: 'RFID order', value: yesNo(dc.isRfidOrder) },
    { label: 'Brand text', value: text(dc.brandText) },
    { label: 'Barcode type', value: text(dc.barcodeType) },
    { label: 'Product category', value: yesNo(dc.productCategory) },
    { label: 'VAS check', value: yesNo(dc.vasCheck) },
    { label: 'ENA verification', value: yesNo(dc.enaVerification) },
    { label: 'EAN label type', value: text(dc.eanLblType) },
    { label: 'LPN label type', value: text(dc.lpnLblType) },
  ];
}

/**
 * DCs (legacy /File/DC "DC Master Details", CloudMenu 100.08) on the MasterDataPage template (docs/19 3.1), following
 * the Countries pattern. Kept from legacy (docs/15 D): the same calls and bodies (list, DC by name on selection and as
 * the existence check before every save, the country list and the country by code for its name, POST {whDes,
 * countryCode} for a new DC, PUT {countryCode} for a change: the stored procedure changes only the country), only
 * the name is required, the name (the key) cannot change after saving.
 */
export function DcPage() {
  const navigate = useNavigate();
  const [loadList] = useLazyGetDcsQuery();
  const [loadDc] = useLazyGetDcQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  const [saveDc] = useSaveDcMutation();

  const [countryName, setCountryName] = useState('');
  const [savedCountryName, setSavedCountryName] = useState('');
  const [detail, setDetail] = useState<Dc | null>(null);
  const [existingName, setExistingName] = useState<string | null>(null);

  const list = useMasterList(loadList);
  const record = useMasterRecord<DcForm>(EMPTY, () => setExistingName(null));
  const { mode, form, errors, editing } = record;

  const nameRef = useRef<HTMLInputElement>(null);
  const countryRef = useRef<HTMLInputElement>(null);

  // A new DC starts at its name; a change can only be the country.
  useEffect(() => {
    const target = mode === 'new' ? nameRef : mode === 'edit' ? countryRef : null;
    if (!target) return;
    const frame = requestAnimationFrame(() => target.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  /** Selecting a DC: legacy `LoadDCData` (the country), then the country's name. */
  const openRecord = async (name: string) => {
    const request = record.beginView(name);
    setCountryName('');
    setDetail(null);
    const result = await loadDc(name);
    if (!record.isCurrent(request)) return;
    if (result.data) {
      const dc = result.data;
      setDetail(dc);
      record.showRecord({ whDes: dc.whDes, countryCode: dc.countryCode });
      if (dc.countryCode.length !== 0) {
        const country = await loadCountry(dc.countryCode);
        if (!record.isCurrent(request)) return;
        const countryText = country.data?.countryName ?? '';
        setCountryName(countryText);
        setSavedCountryName(countryText);
      } else {
        setSavedCountryName('');
      }
    } else if ((result.error as ApiQueryError | undefined)?.status === 404) {
      record.failView({
        kind: 'error',
        title: MESSAGES.loadFailedTitle,
        message: MESSAGES.notFound(name),
      });
    } else {
      record.failView(
        {
          kind: 'error',
          title: MESSAGES.loadFailedTitle,
          message: SHARED_MESSAGES.loadFailed,
          retry: true,
        },
        () => void openRecord(name),
      );
    }
  };

  const startNew = () => {
    setCountryName('');
    setDetail(null);
    record.startNew();
  };

  const cancel = () => {
    setCountryName(mode === 'edit' ? savedCountryName : '');
    record.cancel();
  };

  const changeName = (next: string) => {
    record.update('whDes', next);
    setExistingName(null);
    if (next.length > 0) record.clearError('whDes');
  };

  /** New, not legacy: warn as soon as the name is left if the loaded list already has it (the save still checks). */
  const checkNameInList = () => {
    if (mode !== 'new' || form.whDes.length === 0) return;
    const match = list.items.find((d) => sameKey(d.whDes, form.whDes));
    if (match) {
      record.setErrors((e) => ({ ...e, whDes: MESSAGES.nameInUse }));
      setExistingName(match.whDes);
    }
  };

  const refuseName = (name: string) => {
    record.showProblems([
      {
        field: 'whDes',
        message: MESSAGES.alreadyExists(name),
        onSelect: () => nameRef.current?.focus(),
      },
    ]);
    setExistingName(name);
  };

  /** Legacy `beforeSaveCheking` (the name only) + `chkDC` + `btnSaveData`. */
  const save = async () => {
    if (record.saving || !editing) return;
    const isNew = mode === 'new';
    const values = form;
    if (values.whDes.length <= 0) {
      record.showProblems([
        { field: 'whDes', message: MESSAGES.enterName, onSelect: () => nameRef.current?.focus() },
      ]);
      return;
    }
    await record.runKeyedSave({
      isNew,
      key: values.whDes,
      check: () => loadDc(values.whDes),
      send: () =>
        saveDc({
          mode: isNew ? 'New' : 'Change',
          whDes: values.whDes,
          countryCode: values.countryCode,
        }),
      messages: MESSAGES,
      refuseExisting: () => refuseName(values.whDes),
      onSaved: () => {
        setSavedCountryName(countryName);
        record.showSaved(values, values.whDes, MESSAGES.saved(values.whDes, isNew));
        void list.refresh();
      },
      retry: () => void save(),
    });
  };

  // After a save the settings come from the refreshed list (a new DC has the table's defaults).
  const listRow = list.items.find((d) => d.whDes === record.selected);
  const shown = detail && detail.whDes === record.selected ? detail : (listRow ?? null);
  const title =
    mode === 'new' ? 'New DC' : record.loaded ? (record.selected ?? 'DC details') : 'DC details';

  return (
    <MasterDataPage<Dc>
      data-testid="dc-page"
      title="DCs"
      context={MASTER_DATA_CONTEXT}
      entityName="DC"
      pluralName="DCs"
      items={list.items}
      getItemId={(d) => d.whDes}
      getSearchText={(d) => `${d.whDes} ${d.whCode} ${d.whDesMain} ${d.countryCode}`}
      renderItem={(d) => ({
        primary: d.whDes,
        secondary: [d.whCode.trim(), d.whDesMain.trim(), d.countryCode || MESSAGES.noCountry]
          .filter(Boolean)
          .join(' · '),
      })}
      listLoading={list.state === 'loading'}
      listError={list.state === 'failed' ? SHARED_MESSAGES.listFailed : null}
      onRetryList={list.reload}
      selectedId={record.selected}
      onSelect={(d) => void openRecord(d.whDes)}
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
              label="DC name"
              inputRef={nameRef}
              value={form.whDes}
              onChange={mode === 'new' ? changeName : undefined}
              onBlur={checkNameInList}
              readOnly={mode !== 'new'}
              required={mode === 'new'}
              maxLength={50}
              error={!!errors.whDes}
              helperText={errors.whDes ?? (mode === 'new' ? MESSAGES.nameHelp : undefined)}
            />
            <CountryLookupField
              code={form.countryCode}
              countryName={countryName}
              inputRef={countryRef}
              readOnly={!editing}
              emptyHelp={editing ? MESSAGES.countryOptional : MESSAGES.noCountry}
              onChange={(code, name) => {
                record.update('countryCode', code);
                setCountryName(name);
              }}
            />
            {mode === 'new' && existingName ? (
              <FieldGridItem span="full">
                <Button variant="outlined" onClick={() => void openRecord(existingName)}>
                  {`Discard and open ${existingName}`}
                </Button>
              </FieldGridItem>
            ) : null}
          </FieldGrid>
          {mode !== 'new' && shown ? (
            <FormSection
              variant="plain"
              headingLevel={3}
              title={MESSAGES.settingsTitle}
              description={MESSAGES.settingsHelp}
              data-testid="dc-settings"
            >
              <PropertyList label={MESSAGES.settingsTitle} items={settings(shown)} />
            </FormSection>
          ) : null}
        </Stack>
      ) : null}
    </MasterDataPage>
  );
}
