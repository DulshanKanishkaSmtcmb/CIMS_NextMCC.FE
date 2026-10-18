import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Checkbox,
  LookupDialog,
  LookupField,
  TextInput,
  Typography,
  useScanFeedback,
  type InventoryGridColumn,
} from '@cims/ui';
import {
  useLazyGetCountriesQuery,
  useLazyGetCountryQuery,
  useLazyGetPortQuery,
  useLazyGetPortsQuery,
  useLazySearchPortsQuery,
  useSavePortMutation,
  type PortNameHit,
} from '../../services/masterDataApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { COUNTRY_COLUMNS, PORT_COLUMNS } from './masterColumns';
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

/** Legacy texts of AppJs/Ports.js, word for word. */
const ENTER_NAME = 'Enter Port Name';
const ENTER_CODE = 'Enter Port Code';
const MESSAGES: EntryMessages = {
  alreadyExists: 'Port Code Already Exist',
  doesNotExist: 'Port Code not Exist',
  checkFailed: 'Error Loading Port Data',
};

const PRE_ENTERED_COLUMNS: InventoryGridColumn<PortNameHit>[] = [
  { field: 'portCode', headerName: 'PortCode', width: 160 },
  { field: 'portName', headerName: 'PortName', width: 300 },
  { field: 'countryCode', headerName: 'CountryCode', width: 160 },
];

interface ListDialogState {
  title: string;
  columns: typeof PORT_COLUMNS;
  rows: readonly object[];
  onPick: (row: object) => void;
}

/**
 * Ports Master Details (legacy /File/Ports, CloudMenu 100.06). Same field order, labels, element ids (PortCode,
 * btnPortCode, PortName, IsDivertable, CountryCode, btnCountryCode, CountryName), messages and flow as
 * Views/File/Ports.cshtml + AppJs/Ports.js; write-up in the legacy repo docs/15-wave1-masterdata-a.md.
 */
export function PortsPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();
  const flags = useEntryFlags();
  const { option, optionRef, allowChange, setAllowChange, saveEnabled, setSaveEnabled } = flags;

  const [portCode, setPortCode] = useState('');
  const [portName, setPortName] = useState('');
  const [isDivertable, setIsDivertable] = useState(false);
  const [countryCode, setCountryCode] = useState('');
  const [countryName, setCountryName] = useState('');
  const [hits, setHits] = useState<PortNameHit[] | null>(null);
  const [hitFilter, setHitFilter] = useState('');
  const [dialog, setDialog] = useState<ListDialogState | null>(null);
  const [busy, setBusy] = useState(false);

  const [loadPorts] = useLazyGetPortsQuery();
  const [loadPort] = useLazyGetPortQuery();
  const [searchNames] = useLazySearchPortsQuery();
  const [loadCountries] = useLazyGetCountriesQuery();
  const [loadCountry] = useLazyGetCountryQuery();
  const [savePort] = useSavePortMutation();

  const visibleHits = useMemo(
    () => (hits ?? []).filter((h) => smartMatches(h.portName, hitFilter)),
    [hits, hitFilter],
  );

  const hidePreEntered = () => {
    setHits(null);
    setHitFilter('');
  };

  /** Legacy `btnNewClick`. AllowChange is reset too and so is Is Divertable (the legacy page forgot both). */
  const clearForm = () => {
    setPortCode('');
    setPortName('');
    setIsDivertable(false);
    setCountryCode('');
    setCountryName('');
    hidePreEntered();
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

  /** Legacy `LoadPortData`: fills name, divertable and country; View locks the fields. */
  const loadRecord = async (code: string, notFoundMessage?: string) => {
    setBusy(true);
    try {
      const result = await loadPort(code);
      if (result.data) {
        const port = result.data;
        setPortName(port.portName);
        setIsDivertable(port.isDivertable);
        setCountryCode(port.countryCode);
        if (port.countryCode.length !== 0) {
          setAllowChange(true);
          void loadCountryName(port.countryCode);
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

  /** Legacy `PortCode.subscribe`: outside New, a code unlocks the form and loads its record. */
  const commitPortCode = (next: string) => {
    setPortCode(next);
    if (optionRef.current !== 'New' && next.length > 0) {
      setAllowChange(true);
      void loadRecord(next);
    }
  };

  /** Legacy `PortName.subscribe` -> `LoadPreviousData`: the pre-entered box, New only. */
  const changeName = (next: string) => {
    setPortName(next);
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

  const openDialog = async (
    title: string,
    columns: typeof PORT_COLUMNS,
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

  /** Legacy `btnPortList`: "Ports Listing"; Select fills the form outside New. */
  const openPortList = () =>
    openDialog(
      'Ports Listing',
      PORT_COLUMNS,
      async () => (await loadPorts()).data,
      (row) => {
        if (optionRef.current === 'New') return;
        const picked = (row as { portCode: string }).portCode;
        setPortCode(picked);
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

  /** Legacy `findPortCode` (Enter in the Port Code field). */
  const findPortCode = () => {
    if (optionRef.current === 'New') return;
    if (portCode === '') {
      void openPortList();
    } else {
      void loadRecord(portCode, COMMON_MESSAGES.invalidCode);
    }
  };

  /** Legacy `beforeSaveCheking` + `chkPortCode` + `btnSaveData`. */
  const save = async () => {
    setSaveEnabled(false);
    if (portName.length <= 0) {
      feedback.notifyError(ENTER_NAME);
      setSaveEnabled(true);
      return;
    }
    if (portCode.length <= 0) {
      feedback.notifyError(ENTER_CODE);
      setSaveEnabled(true);
      return;
    }

    setBusy(true);
    try {
      const check = await loadPort(portCode);
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

      const result = await savePort({
        mode: option === 'New' ? 'New' : 'Change',
        portCode,
        portName,
        countryCode,
        isDivertable,
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
        title="Ports Master Details"
        option={option}
        onOptionChange={changeOption}
        saveEnabled={saveEnabled}
        onSave={() => void save()}
        onNew={clearForm}
        onClose={() => void navigate(PATHS.home)}
        busy={busy}
      >
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box sx={{ width: 240 }}>
            <LookupField
              id="PortCode"
              searchId="btnPortCode"
              label="Port Code"
              value={portCode}
              readOnly={!allowChange || option !== 'New'}
              searchDisabled={!allowChange}
              onCommit={commitPortCode}
              onEnter={findPortCode}
              onSearch={() => void openPortList()}
            />
          </Box>
          <Box sx={{ flex: 1, minWidth: 280 }}>
            <TextInput
              id="PortName"
              label="Port Name"
              value={portName}
              readOnly={!allowChange}
              onChange={changeName}
              onBlur={hidePreEntered}
            />
          </Box>
          <Box sx={{ width: 160 }}>
            <Typography component="label" htmlFor="IsDivertable" variant="body2">
              Is Divertable
            </Typography>
            <Box>
              <Checkbox
                id="IsDivertable"
                checked={isDivertable}
                disabled={!allowChange || option === 'View'}
                onChange={(_, checked) => setIsDivertable(checked)}
              />
            </Box>
          </Box>
        </Box>
        {hits ? (
          <PreEnteredBox<PortNameHit>
            heading="Pre-Entered Ports Listing"
            columns={PRE_ENTERED_COLUMNS}
            rows={visibleHits}
            getRowId={(h) => h.portCode}
          />
        ) : null}
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
              onBlur={hidePreEntered}
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
