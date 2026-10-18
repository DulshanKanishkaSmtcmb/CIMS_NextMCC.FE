import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  LookupDialog,
  LookupField,
  SelectField,
  TextInput,
  useScanFeedback,
  type InventoryGridColumn,
} from '@cims/ui';
import {
  useLazyGetCountriesQuery,
  useLazyGetCountryQuery,
  useLazySearchCountriesQuery,
  useSaveCountryMutation,
  type CountryNameHit,
} from '../../services/masterDataApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { COUNTRY_COLUMNS } from './masterColumns';
import {
  COMMON_MESSAGES,
  saveFailureText,
  smartMatches,
  useEntryFlags,
  type EntryMessages,
  type EntryOption,
} from './masterEntry';
import { MasterEntryShell } from './MasterEntryShell';
import { PreEnteredBox } from './PreEnteredBox';

/** Cargo Movement select, in the legacy order (AppJs/Country.js `CargoMovements`). */
const CARGO_MOVEMENTS = ['Imports', 'Export', 'Both'] as const;

/** Legacy texts of AppJs/Country.js, word for word. */
const ENTER_NAME = 'Enter Country Name';
const ENTER_CODE = 'Enter Country Code';
const MESSAGES: EntryMessages = {
  alreadyExists: 'Country Code Already Exist',
  doesNotExist: 'Country Code not Exist',
  checkFailed: 'Error Loading Country Data',
};

const PRE_ENTERED_HEADING = 'Pre-Entered Supplier Listing'; // sic: the legacy heading on the Country page

const PRE_ENTERED_COLUMNS: InventoryGridColumn<CountryNameHit>[] = [
  { field: 'countryCode', headerName: 'CountryCode', width: 160 },
  { field: 'countryName', headerName: 'CountryName', width: 260 },
  { field: 'cargoMovement', headerName: 'CargoMovement', width: 160 },
];

interface ListDialogState {
  rows: readonly object[];
  onPick: (row: object) => void;
}

/**
 * Country Master Details (legacy /File/Country, CloudMenu 100.02). Same field order, labels, element ids
 * (CountryCode, btnCountryCode, CountryName), messages and flow as Views/File/Country.cshtml + AppJs/Country.js;
 * write-up in the legacy repo docs/15-wave1-masterdata-a.md.
 */
export function CountryPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();
  const flags = useEntryFlags();
  const { option, optionRef, allowChange, setAllowChange, saveEnabled, setSaveEnabled } = flags;

  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [cargo, setCargo] = useState<string>('Both');
  const [hits, setHits] = useState<CountryNameHit[] | null>(null);
  const [hitFilter, setHitFilter] = useState('');
  const [dialog, setDialog] = useState<ListDialogState | null>(null);
  const [busy, setBusy] = useState(false);

  const [loadList] = useLazyGetCountriesQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  const [searchNames] = useLazySearchCountriesQuery();
  const [saveCountry] = useSaveCountryMutation();

  const visibleHits = useMemo(
    () => (hits ?? []).filter((h) => smartMatches(h.countryName, hitFilter)),
    [hits, hitFilter],
  );

  const hidePreEntered = () => {
    setHits(null);
    setHitFilter('');
  };

  /** Legacy `btnNewClick`. AllowChange is reset too, which the legacy page forgot (a viewed record locked New). */
  const clearForm = () => {
    setCode('');
    setName('');
    setCargo('Both');
    hidePreEntered();
    setAllowChange(true);
    setSaveEnabled(true);
  };

  const changeOption = (next: EntryOption) => {
    flags.setOption(next);
    clearForm();
    if (next === 'View') setSaveEnabled(false);
  };

  /** Legacy `LoadCountryData`: fills the name and cargo movement; View locks the fields. */
  const loadRecord = async (countryCode: string, notFoundMessage?: string) => {
    setBusy(true);
    try {
      const result = await loadCountry(countryCode);
      if (result.data) {
        setName(result.data.countryName);
        setCargo(result.data.cargoMovement);
        if (optionRef.current === 'View') setAllowChange(false);
      } else if (result.error && (result.error as ApiQueryError).status !== 404) {
        feedback.notifyError(MESSAGES.checkFailed);
      } else if (notFoundMessage) {
        feedback.notifyError(notFoundMessage);
      }
    } finally {
      setBusy(false);
    }
  };

  /** Legacy `CountryCode.subscribe`: outside New, a code unlocks the form and loads its record. */
  const commitCode = (next: string) => {
    setCode(next);
    if (optionRef.current !== 'New' && next.length > 0) {
      setAllowChange(true);
      void loadRecord(next);
    }
  };

  /** Legacy `CountryName.subscribe` -> `LoadPreviousData`: the pre-entered box, New only. */
  const changeName = (next: string) => {
    setName(next);
    if (optionRef.current !== 'New') return;
    if (next.length === 0) {
      hidePreEntered();
    } else if (next.length === 1) {
      void searchNames(next).then((result) => {
        if (result.data && result.data.length > 0) {
          setHits(result.data);
          setHitFilter('');
        } else {
          hidePreEntered();
        }
      });
    } else {
      setHitFilter(next);
    }
  };

  /** Legacy `btnCountryList`: the "Countries Listing" dialog; Select fills the form outside New. */
  const openList = async () => {
    setBusy(true);
    try {
      const result = await loadList();
      if (!result.data) {
        feedback.notifyError(COMMON_MESSAGES.noServer);
      } else if (result.data.length === 0) {
        feedback.notifyError(COMMON_MESSAGES.nothingToList);
      } else {
        setDialog({
          rows: result.data,
          onPick: (row) => {
            setDialog(null);
            if (optionRef.current !== 'New') {
              const picked = (row as { countryCode: string }).countryCode;
              setCode(picked);
              setAllowChange(true);
              void loadRecord(picked);
            }
          },
        });
      }
    } finally {
      setBusy(false);
    }
  };

  /** Legacy `findCountryCode` (Enter in the code field): outside New, an empty code lists, a code loads its record. */
  const findCode = () => {
    if (optionRef.current === 'New') return;
    if (code === '') {
      void openList();
    } else {
      void loadRecord(code, COMMON_MESSAGES.invalidCode);
    }
  };

  /** Legacy `beforeSaveCheking` + `chkCountryCode` + `btnSaveData`. */
  const save = async () => {
    setSaveEnabled(false);
    if (name.length <= 0) {
      feedback.notifyError(ENTER_NAME);
      setSaveEnabled(true);
      return;
    }
    if (code.length <= 0) {
      feedback.notifyError(ENTER_CODE);
      setSaveEnabled(true);
      return;
    }

    setBusy(true);
    try {
      const check = await loadCountry(code);
      const exists = Boolean(check.data);
      if (!exists && (check.error as ApiQueryError | undefined)?.status !== 404) {
        feedback.notifyError(MESSAGES.checkFailed);
        setSaveEnabled(true);
        return;
      }
      if (option === 'New' && exists) {
        feedback.notifyError(MESSAGES.alreadyExists);
        setSaveEnabled(true);
        return;
      }
      if (option !== 'New' && !exists) {
        feedback.notifyError(MESSAGES.doesNotExist);
        setSaveEnabled(true);
        return;
      }

      const result = await saveCountry({
        mode: option === 'New' ? 'New' : 'Change',
        countryCode: code,
        countryName: name,
        cargoMovement: cargo,
      });
      if ('data' in result && result.data) {
        // Like legacy, Save stays disabled until New (or another Option) is chosen.
        feedback.notifySuccess(COMMON_MESSAGES.saved);
      } else if ('error' in result) {
        feedback.notifyError(saveFailureText(result.error as ApiQueryError, MESSAGES));
        setSaveEnabled(true);
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <MasterEntryShell
        title="Country Master Details"
        option={option}
        onOptionChange={changeOption}
        saveEnabled={saveEnabled}
        onSave={() => void save()}
        onNew={clearForm}
        onClose={() => void navigate(PATHS.home)}
        busy={busy}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ width: 240 }}>
            <LookupField
              id="CountryCode"
              searchId="btnCountryCode"
              label="Country Code"
              value={code}
              readOnly={!allowChange || option !== 'New'}
              searchDisabled={!allowChange}
              onCommit={commitCode}
              onEnter={findCode}
              onSearch={() => void openList()}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 280 }}>
            <TextInput
              id="CountryName"
              label="Country Name"
              value={name}
              readOnly={!allowChange}
              onChange={changeName}
              onBlur={hidePreEntered}
            />
          </Box>
        </Box>
        {hits ? (
          <PreEnteredBox<CountryNameHit>
            heading={PRE_ENTERED_HEADING}
            columns={PRE_ENTERED_COLUMNS}
            rows={visibleHits}
            getRowId={(h) => h.countryCode}
          />
        ) : null}
        <Box sx={{ maxWidth: 240 }}>
          <SelectField
            label="Cargo Movement"
            value={cargo}
            options={CARGO_MOVEMENTS}
            onChange={setCargo}
          />
        </Box>
      </MasterEntryShell>
      {dialog ? (
        <LookupDialog
          open
          title="Countries Listing"
          columns={COUNTRY_COLUMNS}
          rows={dialog.rows}
          onSelect={dialog.onPick}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
