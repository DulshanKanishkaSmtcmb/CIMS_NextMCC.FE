import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, LookupDialog, LookupField, TextInput, useScanFeedback } from '@cims/ui';
import {
  useLazyGetCountriesQuery,
  useLazyGetCountryQuery,
  useLazyGetDcQuery,
  useLazyGetDcsQuery,
  useSaveDcMutation,
} from '../../services/masterDataApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { COUNTRY_COLUMNS, DC_COLUMNS } from './masterColumns';
import {
  COMMON_MESSAGES,
  saveFailureText,
  useEntryFlags,
  type EntryMessages,
  type EntryOption,
} from './masterEntry';
import { MasterEntryShell } from './MasterEntryShell';

/** Legacy texts of AppJs/DC.js, word for word (the existence-check alert said "Port Data" on the legacy page). */
const ENTER_NAME = 'Enter DC Name';
const MESSAGES: EntryMessages = {
  alreadyExists: 'DC Already Exist',
  doesNotExist: 'DC not Exist',
  checkFailed: 'Error Loading DC Data',
};

interface ListDialogState {
  title: string;
  columns: typeof DC_COLUMNS;
  rows: readonly object[];
  onPick: (row: object) => void;
}

/**
 * DC Master Details (legacy /File/DC, CloudMenu 100.08). Same field order, labels, element ids (WhDes, btnDc,
 * CountryCode, btnCountryCode, CountryName), messages and flow as Views/File/DC.cshtml + AppJs/DC.js; write-up in the
 * legacy repo docs/15-wave1-masterdata-a.md. The legacy page has no "pre-entered" box.
 */
export function DcPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();
  const flags = useEntryFlags();
  const { option, optionRef, allowChange, setAllowChange, saveEnabled, setSaveEnabled } = flags;

  const [whDes, setWhDes] = useState('');
  const [countryCode, setCountryCode] = useState('');
  const [countryName, setCountryName] = useState('');
  const [dialog, setDialog] = useState<ListDialogState | null>(null);
  const [busy, setBusy] = useState(false);

  const [loadDcs] = useLazyGetDcsQuery();
  const [loadDc] = useLazyGetDcQuery();
  const [loadCountries] = useLazyGetCountriesQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  const [saveDc] = useSaveDcMutation();

  /** Legacy `btnNewClick`. AllowChange is reset too, which the legacy page forgot (a viewed record locked New). */
  const clearForm = () => {
    setWhDes('');
    setCountryCode('');
    setCountryName('');
    setAllowChange(true);
    setSaveEnabled(true);
  };

  const changeOption = (next: EntryOption) => {
    flags.setOption(next);
    clearForm();
    if (next === 'View') setSaveEnabled(false);
  };

  /** Legacy `LoadCountryData`: fills the country name; View locks the fields. */
  const loadCountryName = async (code: string) => {
    const result = await loadCountry(code);
    if (result.data) {
      setCountryName(result.data.countryName);
      if (optionRef.current === 'View') setAllowChange(false);
    }
  };

  /** Legacy `CountryCode.subscribe` (any option): a code unlocks the form and loads the country name. */
  const commitCountryCode = (next: string) => {
    setCountryCode(next);
    if (next.length !== 0) {
      setAllowChange(true);
      void loadCountryName(next);
    }
  };

  /** Legacy `LoadDCData`: fills the country; View locks the fields. */
  const loadRecord = async (name: string, notFoundMessage?: string) => {
    setBusy(true);
    try {
      const result = await loadDc(name);
      if (result.data) {
        const code = result.data.countryCode;
        setCountryCode(code);
        if (code.length !== 0) {
          setAllowChange(true);
          void loadCountryName(code);
        } else {
          // The legacy page kept the previous record's country name here.
          setCountryName('');
        }
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

  /** Legacy `WhDes.subscribe`: outside New, a name unlocks the form and loads its record. */
  const commitWhDes = (next: string) => {
    setWhDes(next);
    if (optionRef.current !== 'New' && next.length > 0) {
      setAllowChange(true);
      void loadRecord(next);
    }
  };

  const openDialog = async (
    title: string,
    columns: typeof DC_COLUMNS,
    fetchRows: () => Promise<readonly object[] | undefined>,
    onPick: (row: object) => void,
  ) => {
    setBusy(true);
    try {
      const rows = await fetchRows();
      if (!rows) {
        feedback.notifyError(COMMON_MESSAGES.noServer);
      } else if (rows.length === 0) {
        feedback.notifyError(COMMON_MESSAGES.nothingToList);
      } else {
        setDialog({
          title,
          columns,
          rows,
          onPick: (row) => {
            setDialog(null);
            onPick(row);
          },
        });
      }
    } finally {
      setBusy(false);
    }
  };

  /** Legacy `btnDCList`: "DC Listing"; Select fills the form outside New. */
  const openDcList = () =>
    openDialog(
      'DC Listing',
      DC_COLUMNS,
      async () => (await loadDcs()).data,
      (row) => {
        if (optionRef.current === 'New') return;
        const picked = (row as { whDes: string }).whDes;
        setWhDes(picked);
        setAllowChange(true);
        void loadRecord(picked);
      },
    );

  /** Legacy `btnCountryList`: "Countries Listing"; Select fills the country in every option. */
  const openCountryList = () =>
    openDialog(
      'Countries Listing',
      COUNTRY_COLUMNS,
      async () => (await loadCountries()).data,
      (row) => {
        const picked = (row as { countryCode: string }).countryCode;
        setCountryCode(picked);
        setAllowChange(true);
        void loadCountryName(picked);
      },
    );

  /** Legacy `findDcCode` (Enter in the DC field; it referenced undefined names and did nothing). */
  const findDc = () => {
    if (optionRef.current === 'New') return;
    if (whDes === '') {
      void openDcList();
    } else {
      void loadRecord(whDes, COMMON_MESSAGES.invalidCode);
    }
  };

  /** Legacy `beforeSaveCheking` + `chkDCCode` + `btnSaveData`. */
  const save = async () => {
    setSaveEnabled(false);
    if (whDes.length <= 0) {
      feedback.notifyError(ENTER_NAME);
      setSaveEnabled(true);
      return;
    }

    setBusy(true);
    try {
      const check = await loadDc(whDes);
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

      const result = await saveDc({
        mode: option === 'New' ? 'New' : 'Change',
        whDes,
        countryCode,
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
        title="DC Master Details"
        option={option}
        onOptionChange={changeOption}
        saveEnabled={saveEnabled}
        onSave={() => void save()}
        onNew={clearForm}
        onClose={() => void navigate(PATHS.home)}
        busy={busy}
      >
        <Box sx={{ width: 240 }}>
          <LookupField
            id="WhDes"
            searchId="btnDc"
            label="DC"
            value={whDes}
            readOnly={!allowChange || option !== 'New'}
            searchDisabled={!allowChange}
            onCommit={commitWhDes}
            onEnter={findDc}
            onSearch={() => void openDcList()}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ width: 240 }}>
            <LookupField
              id="CountryCode"
              searchId="btnCountryCode"
              label="Country Code"
              value={countryCode}
              readOnly={!allowChange || option !== 'New'}
              searchDisabled={!allowChange}
              onCommit={commitCountryCode}
              onEnter={() => undefined}
              onSearch={() => void openCountryList()}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 280 }}>
            <TextInput
              id="CountryName"
              label="Country Name"
              value={countryName}
              readOnly={!allowChange}
              onChange={setCountryName}
            />
          </Box>
        </Box>
      </MasterEntryShell>
      {dialog ? (
        <LookupDialog
          open
          title={dialog.title}
          columns={dialog.columns}
          rows={dialog.rows}
          onSelect={dialog.onPick}
          onClose={() => setDialog(null)}
        />
      ) : null}
    </>
  );
}
