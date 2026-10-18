import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BlockingOverlay,
  Box,
  Button,
  LookupDialog,
  LookupField,
  PageHeader,
  Paper,
  SelectField,
  Stack,
  TextInput,
  useScanFeedback,
  type LookupColumn,
} from '@cims/ui';
import {
  useCreatePalletRackMutation,
  useLazyGetPalletRackQuery,
  useLazyGetPalletRacksQuery,
  type PalletRack,
} from '../../services/palletRackApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { COMMON_MESSAGES } from './masterEntry';
import { NumericField } from './NumericField';
import { PalletPositionTile } from './PalletPositionTile';
import { SectionBox } from './SectionBox';

/** The "Entry Type" select of the legacy pages, in its order. Only New saves; Delete and View only load a layout. */
const ENTRY_TYPES = ['New', 'Delete', 'View'] as const;
type EntryType = (typeof ENTRY_TYPES)[number];

/** Legacy texts of AppJs/PalletRackBuildArr.js and PalletRackBuild.js, word for word. */
const MESSAGES = {
  rackRequired: 'Enter Rack No',
  rowsRequired: 'Enter Nof of Rows in side Rack',
  rowsTooMany: 'Nof of Rows must be less than 99',
  layersTooMany: 'Nof of Layers must be less than 12',
  nothingToSave: 'Nothing to save any Pallet Positions',
  alreadyExists: 'Pallet Rack Already Exist',
  notExist: 'Pallet Rack not Exist',
  loadFailed: 'Error Loading Pallet Rack Data',
} as const;

/** Columns of the "Pallets Area Listing" dialog: every PalletRacks column, titled with the SQL column name. */
const RACK_COLUMNS: readonly LookupColumn[] = [
  { field: 'rackNo', headerName: 'RackNo', width: 140 },
  { field: 'nofRows', headerName: 'NofRows', kind: 'number', width: 130 },
  { field: 'nofLayers', headerName: 'NofLayers', kind: 'number', width: 130 },
  { field: 'nofPositions', headerName: 'NofPositions', kind: 'number', width: 150 },
];

/** A pallet position of the layout: its number and whether it is in use. */
interface Cell {
  position: string;
  on: boolean;
}

/** Legacy position numbers: `rack-RR-LL`, row and layer left-padded with zeros to two digits. */
const two = (n: number) => String(n + 100).substring(1, 3);

/**
 * Pallets Rack Build (legacy /Data/PalletRackBuildArr, CloudMenu 100.14, and its older copy /File/PalletRackBuild): defines a
 * pallet rack (rows x layers) and which of its positions are in use. "Create Pallet Position Layout" draws one tile per
 * position, a tile switches a position off and on, Save stores the rack and the positions that are on. Same fields, labels,
 * element ids, messages and flow as Views/Data/PalletRackBuildArr.cshtml + AppJs/PalletRackBuildArr.js; write-up in the
 * legacy repo docs/18-wave1-masterdata-d.md.
 */
export function PalletRackBuildPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();
  const [loadRacks] = useLazyGetPalletRacksQuery();
  const [loadRack] = useLazyGetPalletRackQuery();
  const [createRack] = useCreatePalletRackMutation();

  const [entryType, setEntryType] = useState<EntryType>('New');
  // The defaults of the legacy view model (a rack of the Test database).
  const [rackNo, setRackNo] = useState('A35');
  const [rows, setRows] = useState(39);
  const [layers, setLayers] = useState(8);
  // The layout on screen: one array of cells per rack row. Switching a cell on or off changes only its `on` flag.
  const [grid, setGrid] = useState<Cell[][]>([]);
  // The total shown before a layout exists: the one of a rack picked from the listing.
  const [pickedTotal, setPickedTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [rackRows, setRackRows] = useState<PalletRack[] | null>(null);

  const total = grid.length > 0 ? grid.flat().filter((c) => c.on).length : pickedTotal;
  const layoutLabel =
    entryType === 'New' ? 'Create Pallet Position Layout' : 'Load Pallet Position Layout';

  /** The legacy checks of `btnCreatePositions` / `btnSaveDataPost`, in order; the message of the first one that fails. */
  const problem = (): string | null => {
    if (rackNo === '') return MESSAGES.rackRequired;
    if (rows === 0) return MESSAGES.rowsRequired;
    if (rows > 99) return MESSAGES.rowsTooMany;
    if (layers > 12) return MESSAGES.layersTooMany;
    return null;
  };

  /** Legacy `btnCreatePositions`: draws rows x layers positions; outside New the saved ones decide which are in use. */
  const createLayout = async () => {
    setGrid([]);
    setPickedTotal(0);
    const message = problem();
    if (message) {
      feedback.notifyError(message);
      return;
    }
    const cells: Cell[][] = [];
    for (let i = 1; i <= rows; i += 1) {
      const line: Cell[] = [];
      for (let j = 1; j <= layers; j += 1) {
        const position = `${rackNo}-${two(i)}-${two(j)}`;
        line.push({ position, on: true });
      }
      cells.push(line);
    }
    if (entryType !== 'New') {
      setBusy(true);
      try {
        const result = await loadRack({ rackNo, positions: true });
        if (!result.data) {
          feedback.notifyError(MESSAGES.loadFailed);
        } else {
          // A position is in use when it is stored for the rack; with nothing stored every position is off.
          const stored = new Set(result.data.positions.map((p) => p.positionNo));
          for (const line of cells) for (const cell of line) cell.on = stored.has(cell.position);
        }
      } finally {
        setBusy(false);
      }
    }
    setGrid(cells);
  };

  const toggle = (row: number, layer: number) =>
    setGrid((current) =>
      current.map((line, i) =>
        i === row ? line.map((cell, j) => (j === layer ? { ...cell, on: !cell.on } : cell)) : line,
      ),
    );

  /** Legacy `btnPalletRackList`: the "Pallets Area Listing"; Select fills the rack, rows, layers and total. */
  const openList = async () => {
    setBusy(true);
    try {
      const result = await loadRacks();
      if (!result.data) {
        feedback.notifyError(COMMON_MESSAGES.noServer);
      } else if (result.data.length === 0) {
        feedback.notifyError(COMMON_MESSAGES.nothingToList);
      } else {
        setRackRows(result.data);
      }
    } finally {
      setBusy(false);
    }
  };

  const pickRack = (rack: PalletRack) => {
    setRackNo(rack.rackNo);
    setRows(rack.nofRows);
    setLayers(rack.nofLayers);
    setPickedTotal(rack.nofPositions);
    setRackRows(null);
  };

  /**
   * Legacy `btnSaveDataPost` (and the existence check `chkPalletRackCode` it never called): the field checks, at least one
   * position in use, then the rack must not exist yet; the rack and its positions are saved in one request.
   */
  const save = async () => {
    const message = problem();
    if (message) {
      feedback.notifyError(message);
      return;
    }
    const positions = grid
      .flat()
      .filter((c) => c.on)
      .map((c) => c.position);
    if (positions.length === 0) {
      feedback.notifyError(MESSAGES.nothingToSave);
      return;
    }
    setBusy(true);
    try {
      const check = await loadRack({ rackNo, positions: false });
      if (!check.data) {
        feedback.notifyError(COMMON_MESSAGES.noServer);
        return;
      }
      if (check.data.rack !== null) {
        feedback.notifyError(MESSAGES.alreadyExists);
        return;
      }
      if (entryType !== 'New') {
        feedback.notifyError(MESSAGES.notExist);
        return;
      }
      const result = await createRack({
        rackNo,
        nofRows: rows,
        nofLayers: layers,
        nofPositions: positions.length,
        positions,
      });
      if ('data' in result && result.data) {
        feedback.notifySuccess(COMMON_MESSAGES.saved);
      } else if ('error' in result) {
        const error = result.error as ApiQueryError;
        if (error.status === undefined) feedback.notifyError(COMMON_MESSAGES.noServer);
        else if (error.status === 409) feedback.notifyError(MESSAGES.alreadyExists);
        else
          feedback.notifyError(COMMON_MESSAGES.notSaved(error.details?.join(' ') ?? error.message));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <PageHeader title="Pallets Rack Build" />
      <BlockingOverlay open={busy} contained message="Loading..." />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Box sx={{ maxWidth: 240 }}>
            <SelectField
              label="Entry Type"
              value={entryType}
              options={ENTRY_TYPES}
              onChange={(next) => setEntryType(next as EntryType)}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
            <Box sx={{ width: 220 }}>
              <LookupField
                id="RackNo"
                searchId="btnRackNo"
                label="Rack No"
                value={rackNo}
                onCommit={setRackNo}
                onSearch={() => void openList()}
                readOnly={entryType !== 'New'}
                searchDisabled={entryType === 'New'}
              />
            </Box>
            <Box sx={{ width: 220 }}>
              <NumericField
                id="NofRows"
                label="No of Rows"
                value={rows}
                decimals={0}
                onCommit={setRows}
              />
            </Box>
            <Box sx={{ width: 220 }}>
              <NumericField
                id="NofLayers"
                label="No of Layers"
                value={layers}
                decimals={0}
                onCommit={setLayers}
              />
            </Box>
            <Box sx={{ width: 220 }}>
              <TextInput
                id="TotPltPositions"
                label="Total Pallet Positions"
                value={String(total)}
                readOnly
              />
            </Box>
          </Box>
          <Box>
            <Button
              id="btnLoadData"
              variant="contained"
              color="info"
              onClick={() => void createLayout()}
            >
              {layoutLabel}
            </Button>
          </Box>
          <SectionBox title="Pallets Positions">
            {grid.map((line, row) => (
              <Box
                key={row}
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', md: 'repeat(4, 1fr)' },
                }}
              >
                {line.map((cell, layer) => (
                  <PalletPositionTile
                    key={cell.position}
                    position={cell.position}
                    enabled={cell.on}
                    onToggle={() => toggle(row, layer)}
                  />
                ))}
              </Box>
            ))}
          </SectionBox>
        </Stack>
      </Paper>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" color="info" onClick={() => void save()}>
          Save
        </Button>
        <Button
          variant="contained"
          color="info"
          onClick={() => {
            setGrid([]);
            setPickedTotal(0);
          }}
        >
          New
        </Button>
        <Button variant="contained" color="info" onClick={() => void navigate(PATHS.home)}>
          Close
        </Button>
      </Stack>
      {rackRows ? (
        <LookupDialog
          open
          title="Pallets Area Listing"
          columns={RACK_COLUMNS}
          rows={rackRows}
          getRowId={(row) => row.rackNo}
          onSelect={pickRack}
          onClose={() => setRackRows(null)}
        />
      ) : null}
    </Box>
  );
}
