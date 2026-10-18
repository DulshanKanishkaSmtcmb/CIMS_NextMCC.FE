import { memo, useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BlockingOverlay,
  Box,
  Button,
  Checkbox,
  LookupDialog,
  LookupField,
  PageHeader,
  SelectField,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextInput,
  useScanFeedback,
} from '@cims/ui';
import { useLazyGetPmMastersQuery, type PmMaster } from '../../services/packingMaterialApi';
import { useLazyGetRateCardQuery, type RateCard } from '../../services/rateCardApi';
import { PATHS } from '../../routes/paths';
import { COMMON_MESSAGES } from './masterEntry';
import { NumericField } from './NumericField';
import { PM_MASTER_COLUMNS } from './pmMasterColumns';
import { FILE_CAPTIONS, UNIT_CAL_TYPES, UNIT_TYPES } from './rateCardOptions';
import { SectionBox } from './SectionBox';

/** Legacy alert of `LoadRateInformation` when the call fails. */
const LOAD_FAILED = 'Error Loading.... Rate Card Data';

interface ClearanceRow {
  cntrType: string;
  rate: number;
}
interface FreightRow {
  portCode: string;
  portName: string;
  cntrType: string;
  rate: number;
}
interface CfsRow {
  chgCode: string;
  chgName: string;
  unitType: string;
  unitCal: string;
  range1: number;
  range2: number;
  fileCaption: string;
  materialCode: string;
  materialName: string;
  isActive: boolean;
  rate: number;
}

/**
 * A select whose value is not among its options shows the first option and the model takes it (Knockout's `value` binding
 * with `options`, no `valueAllowUnset`): a stored NULL or unknown unit calculation type ends up as the first choice.
 */
const coerce = (value: string | null, options: readonly string[]): string =>
  value !== null && options.includes(value) ? value : options[0];

const emptyCfsRow = (): CfsRow => ({
  chgCode: '',
  chgName: '',
  unitType: coerce(null, UNIT_TYPES),
  unitCal: coerce(null, UNIT_CAL_TYPES),
  range1: 0,
  range2: 0,
  fileCaption: coerce(null, FILE_CAPTIONS),
  materialCode: '',
  materialName: '',
  isActive: false,
  rate: 0,
});

const numberCell = { textAlign: 'right' } as const;

/** One row of the freight table. Memoised: the table has a row per port and container type (170 or more). */
const FreightRateRow = memo(function FreightRateRow({
  row,
  index,
  onRate,
}: {
  row: FreightRow;
  index: number;
  onRate: (index: number, rate: number) => void;
}) {
  return (
    <TableRow>
      <TableCell>{row.portCode}</TableCell>
      <TableCell>{row.portName}</TableCell>
      <TableCell>{row.cntrType}</TableCell>
      <TableCell>
        <NumericField
          ariaLabel="Rate[USD]"
          value={row.rate}
          decimals={2}
          onCommit={(rate) => onRate(index, rate)}
        />
      </TableCell>
    </TableRow>
  );
});

/**
 * Rate Card Entry (legacy /File/RateCardEntry, CloudMenu 100.12): the export clearance, freight and CFS rate tables.
 * Same sections, column order, labels and footer (Load Rates, New, Close) as Views/File/RateCardEntry.cshtml +
 * AppJs/RateCardEntry.js; write-up in the legacy repo docs/18-wave1-masterdata-d.md. The legacy page has no save: the
 * rates can be edited on screen and are not stored anywhere.
 */
export function RateCardEntryPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();
  const [loadRates] = useLazyGetRateCardQuery();
  const [loadPmList] = useLazyGetPmMastersQuery();

  const [clearance, setClearance] = useState<ClearanceRow[]>([]);
  const [freight, setFreight] = useState<FreightRow[]>([]);
  const [cfs, setCfs] = useState<CfsRow[]>([]);
  // The page loads the rates when it opens (legacy `ko.applyBindings` then `load()`).
  const [busy, setBusy] = useState(true);
  // The CFS row a Material Code search was started from, and the packing materials listed for it.
  const [pickRow, setPickRow] = useState<number | null>(null);
  const [pmRows, setPmRows] = useState<PmMaster[] | null>(null);

  /** Puts a loaded rate card on screen, replacing what was there. */
  const show = (data: RateCard | undefined) => {
    if (!data) {
      feedback.notifyError(LOAD_FAILED);
      return;
    }
    setClearance(data.clearance.map((r) => ({ cntrType: r.cntrType, rate: r.rateInUsd })));
    setFreight(
      data.freight.map((r) => ({
        portCode: r.portCode,
        portName: r.portName,
        cntrType: r.cntrType,
        rate: r.rateInUsd,
      })),
    );
    setCfs(
      data.cfs.map((r) => ({
        chgCode: r.chgCode,
        chgName: r.chgDescription,
        unitType: coerce(r.unitType, UNIT_TYPES),
        unitCal: coerce(r.unitCalType, UNIT_CAL_TYPES),
        range1: r.range1,
        range2: r.range2,
        fileCaption: coerce(r.fileCaption, FILE_CAPTIONS),
        materialCode: r.materialCode,
        materialName: r.pmDescription,
        isActive: r.isActive,
        rate: r.rateInUsd,
      })),
    );
  };

  useEffect(() => {
    let active = true;
    void loadRates().then((result) => {
      if (!active) return;
      show(result.data);
      setBusy(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the page opens
  }, [loadRates]);

  /** Legacy `load` (the Load Rates button): the rate tables replace what is on screen (the legacy button appended a second copy). */
  const load = async () => {
    setBusy(true);
    try {
      show((await loadRates()).data);
    } finally {
      setBusy(false);
    }
  };

  // Stable, so the 170-odd freight rows below only render again when their own row changes.
  const setFreightRate = useCallback(
    (index: number, rate: number) =>
      setFreight((rows) => rows.map((r, j) => (j === index ? { ...r, rate } : r))),
    [],
  );

  const patchCfs = (index: number, patch: Partial<CfsRow>) =>
    setCfs((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)));

  /** Legacy `MtCodeClick`: the "Packing Material Master Listing" for the row; Select fills Material Code and Name. */
  const openPmList = async (index: number) => {
    setPickRow(index);
    setBusy(true);
    try {
      const result = await loadPmList();
      if (!result.data) {
        feedback.notifyError(COMMON_MESSAGES.noServer);
      } else if (result.data.length === 0) {
        feedback.notifyError(COMMON_MESSAGES.nothingToList);
      } else {
        setPmRows(result.data);
      }
    } finally {
      setBusy(false);
    }
  };

  const selectPm = (pm: PmMaster) => {
    if (pickRow !== null) {
      patchCfs(pickRow, { materialCode: pm.pmCode, materialName: pm.pmDescription });
    }
    setPmRows(null);
  };

  // The legacy tables are all bound to the clearance rows: with none, none of the three tables shows.
  const showTables = clearance.length > 0;

  return (
    <Box sx={{ position: 'relative' }}>
      <PageHeader title="Rate Card Entry" />
      <BlockingOverlay open={busy} contained message="Loading..." />
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <Box sx={{ flex: '1 1 280px', minWidth: 0 }}>
            <SectionBox title="Rate Structure - Export Clearance Charges">
              {showTables ? (
                <TableContainer sx={{ overflow: 'auto' }}>
                  <Table aria-label="Export Clearance Charges">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={numberCell}>Cntr Type</TableCell>
                        <TableCell>Rate[USD]</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {clearance.map((row, i) => (
                        <TableRow key={`${row.cntrType}-${i}`}>
                          <TableCell>{row.cntrType}</TableCell>
                          <TableCell>
                            <NumericField
                              ariaLabel="Rate[USD]"
                              value={row.rate}
                              decimals={2}
                              onCommit={(rate) =>
                                setClearance((rows) =>
                                  rows.map((r, j) => (j === i ? { ...r, rate } : r)),
                                )
                              }
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : null}
            </SectionBox>
          </Box>
          <Box sx={{ flex: '2 1 480px', minWidth: 0 }}>
            <SectionBox title="Rate Structure - Export Freight Charges">
              {showTables ? (
                <TableContainer sx={{ overflow: 'auto' }}>
                  <Table aria-label="Export Freight Charges">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={numberCell}>Port Code</TableCell>
                        <TableCell>Port Name</TableCell>
                        <TableCell sx={numberCell}>Cntr Type</TableCell>
                        <TableCell>Rate[USD]</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {freight.map((row, i) => (
                        <FreightRateRow
                          key={`${row.portCode}-${row.cntrType}-${i}`}
                          index={i}
                          row={row}
                          onRate={setFreightRate}
                        />
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : null}
            </SectionBox>
          </Box>
        </Box>
        <SectionBox title="Rate Structure - CFS Charges">
          {showTables ? (
            <TableContainer sx={{ overflow: 'auto' }}>
              <Table aria-label="CFS Charges">
                <TableHead>
                  <TableRow>
                    <TableCell />
                    <TableCell>Chg Name</TableCell>
                    <TableCell>Unit Type</TableCell>
                    <TableCell>Unit Cal</TableCell>
                    <TableCell sx={numberCell}>Range1</TableCell>
                    <TableCell sx={numberCell}>Range2</TableCell>
                    <TableCell>Table Type</TableCell>
                    <TableCell>Material Code</TableCell>
                    <TableCell>Material Name</TableCell>
                    <TableCell>Active</TableCell>
                    <TableCell sx={numberCell}>Rate[USD]</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {cfs.map((row, i) => {
                    const rangeEnabled = row.unitCal === 'Range';
                    const materialEnabled =
                      row.fileCaption === 'Material Handling' || row.fileCaption === 'Material';
                    return (
                      <TableRow key={`${row.chgCode}-${i}`}>
                        <TableCell>
                          {i === cfs.length - 1 ? (
                            <Button
                              size="small"
                              variant="contained"
                              color="success"
                              aria-label="Add charge"
                              onClick={() => setCfs((rows) => [...rows, emptyCfsRow()])}
                            >
                              +
                            </Button>
                          ) : null}
                        </TableCell>
                        <TableCell sx={{ minWidth: 220 }}>
                          <TextInput
                            ariaLabel="Chg Name"
                            value={row.chgName}
                            onChange={(chgName) => patchCfs(i, { chgName })}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <SelectField
                            ariaLabel="Unit Type"
                            value={row.unitType}
                            options={UNIT_TYPES}
                            onChange={(unitType) => patchCfs(i, { unitType })}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 140 }}>
                          <SelectField
                            ariaLabel="Unit Cal"
                            value={row.unitCal}
                            options={UNIT_CAL_TYPES}
                            onChange={(unitCal) => patchCfs(i, { unitCal })}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 100 }}>
                          <NumericField
                            ariaLabel="Range1"
                            value={row.range1}
                            decimals={2}
                            readOnly={!rangeEnabled}
                            onCommit={(range1) => patchCfs(i, { range1 })}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 100 }}>
                          <NumericField
                            ariaLabel="Range2"
                            value={row.range2}
                            decimals={2}
                            readOnly={!rangeEnabled}
                            onCommit={(range2) => patchCfs(i, { range2 })}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 200 }}>
                          <SelectField
                            ariaLabel="Table Type"
                            value={row.fileCaption}
                            options={FILE_CAPTIONS}
                            onChange={(fileCaption) => patchCfs(i, { fileCaption })}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 180 }}>
                          <LookupField
                            ariaLabel="Material Code"
                            value={row.materialCode}
                            onCommit={(materialCode) => patchCfs(i, { materialCode })}
                            onSearch={() => void openPmList(i)}
                            searchDisabled={!materialEnabled}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 200 }}>
                          <TextInput value={row.materialName} ariaLabel="Material Name" readOnly />
                        </TableCell>
                        <TableCell>
                          <Checkbox
                            checked={row.isActive}
                            onChange={(event) => patchCfs(i, { isActive: event.target.checked })}
                            slotProps={{ input: { 'aria-label': 'Active' } }}
                          />
                        </TableCell>
                        <TableCell sx={{ minWidth: 120 }}>
                          <NumericField
                            ariaLabel="Rate[USD]"
                            value={row.rate}
                            decimals={2}
                            onCommit={(rate) => patchCfs(i, { rate })}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          ) : null}
        </SectionBox>
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" color="info" onClick={() => void load()}>
          Load Rates
        </Button>
        <Button
          variant="contained"
          color="info"
          onClick={() => {
            setCfs([]);
            setClearance([]);
            setFreight([]);
          }}
        >
          New
        </Button>
        <Button variant="contained" color="info" onClick={() => void navigate(PATHS.home)}>
          Close
        </Button>
      </Stack>
      {pmRows ? (
        <LookupDialog
          open
          title="Packing Material Master Listing"
          columns={PM_MASTER_COLUMNS}
          rows={pmRows}
          getRowId={(row) => row.pmCode}
          onSelect={selectPm}
          onClose={() => setPmRows(null)}
        />
      ) : null}
    </Box>
  );
}
