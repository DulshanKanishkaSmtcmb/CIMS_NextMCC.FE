import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Checkbox,
  LookupDialog,
  LookupField,
  SelectField,
  TextInput,
  Typography,
  useScanFeedback,
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
import { COMMON_MESSAGES, saveFailureText, useEntryFlags, type EntryMessages } from './masterEntry';
import { MasterEntryShell } from './MasterEntryShell';
import { NumericField } from './NumericField';
import { PM_MASTER_COLUMNS } from './pmMasterColumns';

/** Legacy texts of AppJs/PMMaster.js, word for word (including "Meterial" and "Acive"). */
const ENTER_DESCRIPTION = 'Enter Description';
const ENTER_CODE = 'Enter PM Code';
const REORDER_NEGATIVE = 'Reorder Level must be positive number';
const WEIGHT_NEGATIVE = 'PM Weight must be positive number';
const CBM_NEGATIVE = 'CBM must be positive number';
const BOTH_COUNTS = 'can not be select Get Jokers Count and Get Parts Count both check box';
const MESSAGES: EntryMessages = {
  alreadyExists: 'Meterial Code Already Exist',
  doesNotExist: 'Meterial Code not Exist',
  checkFailed: 'Error Loading PM Data',
};
const CATEGORY_LOAD_FAILED = 'Error Loading PM Category Data';

/** Weight and CBM go through the save procedures as decimal(18,2), so a loaded value is shown rounded to two decimals. */
const toHundredths = (value: number) => Math.round(value * 100) / 100;

/** The Option select of this page offers New and Change only. */
const PM_OPTIONS = ['New', 'Change'] as const;

/** `self.PMCategory("Hanger")`: what the legacy page selects when the Option goes back to New. */
const NEW_CATEGORY = 'Hanger';

/**
 * Packing Material Master Details (legacy /File/PMMaster, CloudMenu 100.10). Same field order, labels, element ids
 * (PMCode, btnPMCode, PMDescription), messages and flow as Views/File/PMMaster.cshtml + AppJs/PMMaster.js; write-up in the
 * legacy repo docs/17-wave1-masterdata-c.md.
 */
export function PmMasterPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();
  const flags = useEntryFlags();
  const { option, optionRef, saveEnabled, setSaveEnabled } = flags;

  const [pmCode, setPmCode] = useState('');
  const [description, setDescription] = useState('');
  // The chosen category; until one is chosen the select shows the first PMCategories row (legacy LoadDefault).
  const [chosenCategory, setCategory] = useState<string | null>(null);
  const [qtyInHand, setQtyInHand] = useState<number | null>(null);
  const [reorderLevel, setReorderLevel] = useState<number | null>(null);
  const [weight, setWeight] = useState<number | null>(null);
  const [cbm, setCbm] = useState<number | null>(null);
  const [getJokersCount, setGetJokersCount] = useState(false);
  const [getPartsCount, setGetPartsCount] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [rows, setRows] = useState<readonly PmMaster[] | null>(null);
  const [busy, setBusy] = useState(false);

  const categories = useGetPmCategoriesQuery();
  const [loadList] = useLazyGetPmMastersQuery();
  const [loadPm] = useLazyGetPmMasterQuery();
  const [savePm] = useSavePmMasterMutation();

  const categoryNames = (categories.data ?? []).map((c) => c.pmCategory);
  const category = chosenCategory ?? categoryNames[0] ?? '';

  useEffect(() => {
    if (categories.isError) feedback.notifyError(CATEGORY_LOAD_FAILED);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the load fails
  }, [categories.isError]);

  /** Legacy `btnNewClick`: only the code and the description are cleared, and Save is enabled again. */
  const clearKey = () => {
    setPmCode('');
    setDescription('');
    setSaveEnabled(true);
  };

  /** Legacy `EntryOption.subscribe` x2: New resets every field, Change keeps the others; both run `btnNewClick`. */
  const changeOption = (next: 'New' | 'Change') => {
    flags.setOption(next);
    if (next === 'New') {
      setCategory(categoryNames.includes(NEW_CATEGORY) ? NEW_CATEGORY : (categoryNames[0] ?? ''));
      setQtyInHand(0);
      setReorderLevel(0);
      setWeight(0);
      setCbm(0);
      setGetJokersCount(false);
      setGetPartsCount(false);
      setIsActive(true);
    }
    clearKey();
  };

  /** Legacy `LoadPMData`: fills the form. An unknown code does nothing. */
  const loadRecord = async (code: string) => {
    setBusy(true);
    try {
      const result = await loadPm(code);
      if (result.data) {
        const pm = result.data;
        setPmCode(pm.pmCode);
        setDescription(pm.pmDescription);
        setQtyInHand(pm.qtyInHand);
        setReorderLevel(pm.qtyReOrderLevel);
        setWeight(toHundredths(pm.pmWgt));
        setCategory(pm.pmCategory);
        setCbm(toHundredths(pm.pmCbm));
        setGetJokersCount(pm.getJokerCount);
        setGetPartsCount(pm.getPartCount);
        setIsActive(pm.isActive);
      } else if (result.error && (result.error as ApiQueryError).status !== 404) {
        feedback.notifyError((result.error as ApiQueryError).message);
      }
    } finally {
      setBusy(false);
    }
  };

  /** Legacy `PMCode.subscribe`: outside New, a code loads its record. */
  const commitCode = (next: string) => {
    setPmCode(next);
    if (optionRef.current !== 'New' && next.length > 0) void loadRecord(next);
  };

  /** Legacy `btnPMList`: "Packing Material Master Listing"; Select fills the form in Change and only closes in New. */
  const openList = async () => {
    setBusy(true);
    try {
      const result = await loadList();
      if (!result.data) {
        feedback.notifyError(COMMON_MESSAGES.noServer);
      } else if (result.data.length === 0) {
        feedback.notifyError(COMMON_MESSAGES.nothingToList);
      } else {
        setRows(result.data);
      }
    } finally {
      setBusy(false);
    }
  };

  const pickRow = (row: PmMaster) => {
    setRows(null);
    if (optionRef.current === 'New') return;
    setPmCode(row.pmCode);
    void loadRecord(row.pmCode);
  };

  /** Legacy `beforeSaveCheking` + `chkPMCode` + `btnSaveData`. */
  const save = async () => {
    setSaveEnabled(false);
    const refuse = (message: string) => {
      feedback.notifyError(message);
      setSaveEnabled(true);
    };
    if (description.length <= 0) return refuse(ENTER_DESCRIPTION);
    if (pmCode.length <= 0 && option === 'New') return refuse(ENTER_CODE);
    if ((reorderLevel ?? 0) < 0) return refuse(REORDER_NEGATIVE);
    if ((weight ?? 0) < 0) return refuse(WEIGHT_NEGATIVE);
    if ((cbm ?? 0) < 0) return refuse(CBM_NEGATIVE);

    setBusy(true);
    try {
      let exists = false;
      if (pmCode.length > 0) {
        const check = await loadPm(pmCode);
        exists = Boolean(check.data);
        if (!exists && (check.error as ApiQueryError | undefined)?.status !== 404) {
          return refuse(MESSAGES.checkFailed);
        }
      }
      if (option === 'New' && exists) return refuse(MESSAGES.alreadyExists);
      if (option !== 'New' && !exists) return refuse(MESSAGES.doesNotExist);
      // The legacy page showed this and saved anyway; it is refused here (and by the API).
      if (getPartsCount && getJokersCount) return refuse(BOTH_COUNTS);

      const result = await savePm({
        mode: option === 'New' ? 'New' : 'Change',
        pmCode,
        pmDescription: description,
        pmCategory: category,
        reorderLevel: reorderLevel ?? 0,
        pmWeight: weight ?? 0,
        cbm: cbm ?? 0,
        getJokersCount,
        getPartsCount,
        isActive,
      });
      if ('data' in result && result.data) {
        // Like legacy, Save stays disabled until the Option is changed (the page has no New button).
        feedback.notifySuccess(COMMON_MESSAGES.saved);
      } else if ('error' in result) {
        refuse(saveFailureText(result.error as ApiQueryError, MESSAGES));
      }
    } finally {
      setBusy(false);
    }
  };

  const changeMode = option !== 'New';

  return (
    <>
      <MasterEntryShell
        title="Packing Material Master Details"
        option={option}
        options={PM_OPTIONS}
        onOptionChange={(next) => changeOption(next as 'New' | 'Change')}
        showNew={false}
        saveEnabled={saveEnabled}
        onSave={() => void save()}
        onNew={clearKey}
        onClose={() => void navigate(PATHS.home)}
        busy={busy}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box sx={{ width: 240 }}>
            <LookupField
              id="PMCode"
              searchId="btnPMCode"
              label="Packing Material Code"
              value={pmCode}
              readOnly={changeMode}
              hideSearch={!changeMode}
              onCommit={commitCode}
              onSearch={() => void openList()}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 280 }}>
            <TextInput
              id="PMDescription"
              label="PM Description"
              value={description}
              onChange={setDescription}
            />
          </Box>
          <Box sx={{ width: 200 }}>
            <SelectField
              label="PM Category"
              value={categoryNames.includes(category) ? category : ''}
              options={categoryNames}
              onChange={setCategory}
            />
          </Box>
          <Box sx={{ width: 160 }}>
            <TextInput label="QTY in hand" value={qtyInHand === null ? '' : String(qtyInHand)} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ width: 240 }}>
            <NumericField
              label="Reorder Level"
              value={reorderLevel}
              decimals={0}
              onCommit={setReorderLevel}
            />
          </Box>
          <Box sx={{ width: 240 }}>
            <NumericField label="Weight (g)" value={weight} decimals={2} onCommit={setWeight} />
          </Box>
          <Box sx={{ width: 240 }}>
            <NumericField label="CBM" value={cbm} decimals={2} onCommit={setCbm} />
          </Box>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <FlagBox
            id="GetJokersCount"
            label="Get Jokers Count"
            checked={getJokersCount}
            onChange={setGetJokersCount}
          />
          <FlagBox
            id="GetPartsCount"
            label="Get Parts Count"
            checked={getPartsCount}
            onChange={setGetPartsCount}
          />
          <FlagBox id="IsActive" label="Is Acive" checked={isActive} onChange={setIsActive} />
        </Box>
      </MasterEntryShell>
      {rows ? (
        <LookupDialog
          open
          title="Packing Material Master Listing"
          columns={PM_MASTER_COLUMNS}
          rows={rows}
          getRowId={(row) => row.pmCode}
          onSelect={pickRow}
          onClose={() => setRows(null)}
        />
      ) : null}
    </>
  );
}

interface FlagBoxProps {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** A legacy check box with its label above it. */
function FlagBox({ id, label, checked, onChange }: FlagBoxProps) {
  return (
    <Box sx={{ width: 200 }}>
      <Typography component="label" htmlFor={id} variant="body2">
        {label}
      </Typography>
      <Box>
        <Checkbox id={id} checked={checked} onChange={(_, value) => onChange(value)} />
      </Box>
    </Box>
  );
}
