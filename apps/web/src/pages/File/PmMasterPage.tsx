import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button,
  CheckboxField,
  FieldGrid,
  FieldGridItem,
  formatNumber,
  FormSection,
  InlineHint,
  MasterDataPage,
  SelectField,
  Stack,
  StatusChip,
  TextInput,
  type ValidationIssue,
} from '@cims/ui';
import {
  useGetPmCategoriesQuery,
  useLazyGetPmMasterQuery,
  useLazyGetPmMastersQuery,
  useSavePmMasterMutation,
  type PmMaster,
} from '../../services/packingMaterialApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { MASTER_DATA_CONTEXT, sameKey, SHARED_MESSAGES } from './masterDataPage';
import { useMasterList, useMasterRecord } from './useMasterRecord';
import { PM_MASTER_MESSAGES as MESSAGES } from './pmMasterMessages';
import { MasterDetailNotice } from './MasterDetailNotice';
import { NumericField } from './NumericField';

/** What is saved (the quantity in hand is only shown). */
interface PmForm {
  pmCode: string;
  description: string;
  category: string;
  reorderLevel: number;
  weight: number;
  cbm: number;
  getJokersCount: boolean;
  getPartsCount: boolean;
  isActive: boolean;
}

/** Weight and CBM go through the save procedures as decimal(18,2): a loaded value is shown rounded to two decimals. */
const toHundredths = (value: number) => Math.round(value * 100) / 100;

const toForm = (pm: PmMaster): PmForm => ({
  pmCode: pm.pmCode,
  description: pm.pmDescription,
  category: pm.pmCategory,
  reorderLevel: pm.qtyReOrderLevel,
  weight: toHundredths(pm.pmWgt),
  cbm: toHundredths(pm.pmCbm),
  getJokersCount: pm.getJokerCount,
  getPartsCount: pm.getPartCount,
  isActive: pm.isActive,
});

/** The one default object a new packing material starts from: legacy first load (first category, zeros, active). */
const emptyForm = (category: string): PmForm => ({
  pmCode: '',
  description: '',
  category,
  reorderLevel: 0,
  weight: 0,
  cbm: 0,
  getJokersCount: false,
  getPartsCount: false,
  isActive: true,
});

type Field = keyof PmForm;

/**
 * Packing materials (legacy /File/PMMaster "Packing Material Master Details", CloudMenu 100.10) on the MasterDataPage
 * template. The legacy page had New and Change only (no View): selecting a material shows it read-only and Edit is
 * always offered. Kept from legacy (docs/17 B): the same calls and bodies (categories on open, list, material by code
 * on selection and as the existence check before every save, POST new / PUT change with the nine values), the checks
 * in the legacy order (description, code, the three numbers, exists / not exists, then the two counts), weight and CBM
 * kept to two decimals (M1), both counts refused (M2).
 */
export function PmMasterPage() {
  const navigate = useNavigate();
  const categories = useGetPmCategoriesQuery();
  const [loadList] = useLazyGetPmMastersQuery();
  const [loadPm] = useLazyGetPmMasterQuery();
  const [savePm] = useSavePmMasterMutation();

  const categoryNames = useMemo(
    () => (categories.data ?? []).map((c) => c.pmCategory),
    [categories.data],
  );
  const empty = useMemo(() => emptyForm(categoryNames[0] ?? ''), [categoryNames]);

  const [existingCode, setExistingCode] = useState<string | null>(null);
  const [loadedPm, setLoadedPm] = useState<PmMaster | null>(null);

  const list = useMasterList(loadList);
  const record = useMasterRecord<PmForm>(empty, () => setExistingCode(null));
  const { mode, form, errors, editing } = record;

  const codeRef = useRef<HTMLInputElement>(null);
  const descriptionRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const target = mode === 'new' ? codeRef : mode === 'edit' ? descriptionRef : null;
    if (!target) return;
    const frame = requestAnimationFrame(() => target.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [mode]);

  /** Selecting a material: legacy "Select" in the list dialog, then `LoadPMData`. */
  const openRecord = async (code: string) => {
    const request = record.beginView(code);
    setLoadedPm(null);
    const result = await loadPm(code);
    if (!record.isCurrent(request)) return;
    if (result.data && !result.error) {
      setLoadedPm(result.data);
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

  const startNew = () => {
    setLoadedPm(null);
    record.startNew(empty);
  };

  const set = <K extends Field>(field: K, value: PmForm[K]) => {
    record.update(field, value);
    record.clearError(field);
  };

  const changeCode = (next: string) => {
    record.update('pmCode', next);
    setExistingCode(null);
    if (next.length > 0) record.clearError('pmCode');
  };

  /** New, not legacy: warn as soon as the code is left if the loaded list already has it (the save still checks). */
  const checkCodeInList = () => {
    if (mode !== 'new' || form.pmCode.length === 0) return;
    const match = list.items.find((p) => sameKey(p.pmCode, form.pmCode));
    if (match) {
      record.setErrors((e) => ({ ...e, pmCode: MESSAGES.codeInUse(match.pmDescription) }));
      setExistingCode(match.pmCode);
    }
  };

  const refs: Partial<Record<Field, RefObject<HTMLInputElement | null>>> = {
    pmCode: codeRef,
    description: descriptionRef,
  };
  const issue = (field: Field, message: string): ValidationIssue => ({
    field,
    message,
    onSelect: () => refs[field]?.current?.focus(),
  });

  /** Legacy `beforeSaveCheking`: description, code (new only), then the three numbers; the first one stops. */
  const firstProblem = (values: PmForm, isNew: boolean): ValidationIssue | null => {
    if (values.description.length <= 0) return issue('description', MESSAGES.enterDescription);
    if (isNew && values.pmCode.length <= 0) return issue('pmCode', MESSAGES.enterCode);
    if (values.reorderLevel < 0) return issue('reorderLevel', MESSAGES.reorderNegative);
    if (values.weight < 0) return issue('weight', MESSAGES.weightNegative);
    if (values.cbm < 0) return issue('cbm', MESSAGES.cbmNegative);
    return null;
  };

  /** Legacy `beforeSaveCheking` + `chkPMCode` + `btnSaveData`. */
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
      key: values.pmCode,
      check: () => loadPm(values.pmCode),
      beforeSend: () => {
        // Legacy showed this after the existence check and saved anyway (M2); it is refused (the API refuses too).
        if (!(values.getJokersCount && values.getPartsCount)) return true;
        record.showProblems([issue('getPartsCount', MESSAGES.bothCounts)]);
        return false;
      },
      send: () =>
        savePm({
          mode: isNew ? 'New' : 'Change',
          pmCode: values.pmCode,
          pmDescription: values.description,
          pmCategory: values.category,
          reorderLevel: values.reorderLevel,
          pmWeight: values.weight,
          cbm: values.cbm,
          getJokersCount: values.getJokersCount,
          getPartsCount: values.getPartsCount,
          isActive: values.isActive,
        }),
      messages: MESSAGES,
      refuseExisting: () => {
        record.showProblems([issue('pmCode', MESSAGES.alreadyExists(values.pmCode))]);
        setExistingCode(values.pmCode);
      },
      onSaved: () => {
        record.showSaved(values, values.pmCode, MESSAGES.saved(values.pmCode, isNew));
        void list.refresh();
      },
      retry: () => void save(),
    });
  };

  const listRow = list.items.find((p) => p.pmCode === record.selected);
  const shown = loadedPm && loadedPm.pmCode === record.selected ? loadedPm : listRow;
  /** M1 / Q1 made visible: a stored value with more than two decimals is shown and saved with two. */
  const roundedHint = (stored: number | undefined, value: number) =>
    stored !== undefined && toHundredths(stored) !== stored && value === toHundredths(stored)
      ? MESSAGES.twoDecimals(stored)
      : undefined;

  const title =
    mode === 'new'
      ? 'New packing material'
      : record.loaded && record.baseline.description
        ? `${record.baseline.description} (${record.selected})`
        : (record.selected ?? 'Packing material details');

  return (
    <MasterDataPage<PmMaster>
      data-testid="pm-master-page"
      title="Packing materials"
      context={MASTER_DATA_CONTEXT}
      entityName="packing material"
      items={list.items}
      getItemId={(p) => p.pmCode}
      getSearchText={(p) => `${p.pmCode} ${p.pmDescription} ${p.pmCategory}`}
      renderItem={(p) => ({
        primary: p.pmDescription,
        secondary: `${p.pmCode} · ${p.pmCategory}`,
        meta: p.isActive ? undefined : <StatusChip tone="neutral" label="Inactive" />,
      })}
      listLoading={list.state === 'loading'}
      listError={list.state === 'failed' ? SHARED_MESSAGES.listFailed : null}
      onRetryList={list.reload}
      selectedId={record.selected}
      onSelect={(p) => void openRecord(p.pmCode)}
      mode={mode}
      onNew={startNew}
      onEdit={record.loaded ? record.startEdit : undefined}
      onCancel={record.cancel}
      onSave={() => void save()}
      saving={record.saving}
      dirty={record.dirty}
      detailTitle={title}
      detailLoading={record.detailLoading}
      detailMessage={
        <Stack spacing={1}>
          {categories.isError ? (
            <InlineHint tone="error">{MESSAGES.categoriesFailed}</InlineHint>
          ) : null}
          <MasterDetailNotice
            notice={record.notice}
            onRetry={record.retry}
            onDismiss={record.notice?.kind === 'error' ? record.dismissNotice : undefined}
          />
        </Stack>
      }
      onClose={() => void navigate(PATHS.home)}
    >
      {record.loaded ? (
        <Stack spacing={2.5}>
          <FieldGrid columns={{ xs: 1, sm: 3 }}>
            <TextInput
              label="Packing material code"
              inputRef={codeRef}
              value={form.pmCode}
              onChange={mode === 'new' ? changeCode : undefined}
              onBlur={checkCodeInList}
              readOnly={mode !== 'new'}
              required={mode === 'new'}
              maxLength={10}
              error={!!errors.pmCode}
              helperText={errors.pmCode ?? (mode === 'new' ? MESSAGES.codeHelp : undefined)}
            />
            <FieldGridItem span={2}>
              <TextInput
                label="Description"
                inputRef={descriptionRef}
                value={form.description}
                onChange={editing ? (v) => set('description', v) : undefined}
                readOnly={!editing}
                required={editing}
                maxLength={50}
                error={!!errors.description}
                helperText={errors.description}
              />
            </FieldGridItem>
            {mode === 'new' && existingCode ? (
              <FieldGridItem span="full">
                <Button variant="outlined" onClick={() => void openRecord(existingCode)}>
                  {`Discard and open ${existingCode}`}
                </Button>
              </FieldGridItem>
            ) : null}
            {editing ? (
              <SelectField
                label="PM category"
                value={categoryNames.includes(form.category) ? form.category : ''}
                options={categoryNames}
                onChange={(v) => set('category', v)}
              />
            ) : (
              <TextInput label="PM category" value={form.category} />
            )}
            {mode !== 'new' && shown ? (
              <TextInput label="Qty in hand" value={formatNumber(shown.qtyInHand)} />
            ) : null}
          </FieldGrid>

          <FormSection variant="plain" headingLevel={3} title="Stock and size">
            <FieldGrid columns={{ xs: 1, sm: 3 }}>
              <NumericField
                label="Reorder level"
                value={form.reorderLevel}
                decimals={0}
                readOnly={!editing}
                onCommit={(v) => set('reorderLevel', v)}
                error={!!errors.reorderLevel}
                helperText={errors.reorderLevel}
              />
              <NumericField
                label="Weight (g)"
                value={form.weight}
                decimals={2}
                readOnly={!editing}
                onCommit={(v) => set('weight', v)}
                error={!!errors.weight}
                helperText={errors.weight ?? roundedHint(shown?.pmWgt, form.weight)}
              />
              <NumericField
                label="CBM"
                value={form.cbm}
                decimals={2}
                readOnly={!editing}
                onCommit={(v) => set('cbm', v)}
                error={!!errors.cbm}
                helperText={errors.cbm ?? roundedHint(shown?.pmCbm, form.cbm)}
              />
            </FieldGrid>
          </FormSection>

          <FormSection
            variant="plain"
            headingLevel={3}
            title="Counting and status"
            description={editing ? MESSAGES.bothCounts : undefined}
          >
            {editing ? (
              <FieldGrid columns={{ xs: 1, sm: 3 }}>
                <CheckboxField
                  label="Get jokers count"
                  checked={form.getJokersCount}
                  onChange={(v) => {
                    set('getJokersCount', v);
                    record.clearError('getPartsCount');
                  }}
                />
                <CheckboxField
                  label="Get parts count"
                  checked={form.getPartsCount}
                  onChange={(v) => set('getPartsCount', v)}
                  helperText={errors.getPartsCount}
                  error={!!errors.getPartsCount}
                />
                <CheckboxField
                  label="Active"
                  checked={form.isActive}
                  onChange={(v) => set('isActive', v)}
                />
              </FieldGrid>
            ) : (
              <FieldGrid columns={{ xs: 1, sm: 3 }}>
                <TextInput label="Get jokers count" value={form.getJokersCount ? 'Yes' : 'No'} />
                <TextInput label="Get parts count" value={form.getPartsCount ? 'Yes' : 'No'} />
                <TextInput label="Active" value={form.isActive ? 'Yes' : 'No'} />
              </FieldGrid>
            )}
          </FormSection>
        </Stack>
      ) : null}
    </MasterDataPage>
  );
}
