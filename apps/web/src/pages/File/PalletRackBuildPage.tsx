import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  Box,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FieldGrid,
  FormSection,
  InlineHint,
  LookupDialog,
  LookupField,
  PageShell,
  SegmentedControl,
  ShortcutsLegend,
  Stack,
  StatGroup,
  StatusChip,
  TableSkeleton,
  TextInput,
  Typography,
  useKeyboardShortcuts,
  type KeyboardShortcut,
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
import { classifySaveFailure, SHARED_MESSAGES } from './masterDataPage';
import { NumericField } from './NumericField';
import { PalletPositionTile } from './PalletPositionTile';
import { PALLET_RACK_MESSAGES as MESSAGES } from './palletRackMessages';

/** New builds and saves a rack; View loads a stored layout (legacy Entry Type New / Delete / View: Delete only loaded). */
type Mode = 'new' | 'view';
const MODES = [
  { value: 'new', label: 'New rack' },
  { value: 'view', label: 'View stored rack' },
];

const RACK_COLUMNS: readonly LookupColumn[] = [
  { field: 'rackNo', headerName: 'Rack', width: 140 },
  { field: 'nofRows', headerName: 'Rows', kind: 'number', width: 110 },
  { field: 'nofLayers', headerName: 'Layers', kind: 'number', width: 110 },
  { field: 'nofPositions', headerName: 'Positions', kind: 'number', width: 130 },
];

/** A pallet position of the layout: its number and whether it is in use. */
interface Cell {
  position: string;
  on: boolean;
}

interface Layout {
  rackNo: string;
  rows: number;
  layers: number;
  grid: Cell[][];
  /** Read from the stored rack (View): shown, not saved. */
  stored: boolean;
}

/** Legacy position numbers: `rack-RR-LL`, row and layer left-padded with zeros to two digits. */
const two = (n: number) => String(n + 100).substring(1, 3);

type Notice =
  | { kind: 'problem'; text: string }
  | { kind: 'saved'; text: string }
  | { kind: 'failed'; title: string; message: string; details?: string; retry?: boolean };

/**
 * Pallet rack build (legacy /Data/PalletRackBuildArr, CloudMenu 100.14, and its older copy /File/PalletRackBuild, the
 * same component on both routes) as a builder on PageShell (docs/19 section 3.4): 1 the rack, 2 its pallet positions,
 * Save in the action bar. Kept from legacy (docs/18 E): position numbers rack-RR-LL built row by row and layer by
 * layer, every position in use when a layout is created, a stored layout loaded with only its stored positions in use
 * (P3), the checks in the legacy order and their limits, the existence check before the save and the same calls and
 * body (`GET pallet-racks/{rack}?positions=false` then `POST pallet-racks {rackNo, nofRows, nofLayers, nofPositions,
 * positions}` with the positions in use in layout order; `GET pallet-racks` for the rack list, `GET
 * pallet-racks/{rack}?positions=true` for a stored layout).
 */
export function PalletRackBuildPage() {
  const navigate = useNavigate();
  const [loadRacks] = useLazyGetPalletRacksQuery();
  const [loadRack] = useLazyGetPalletRackQuery();
  const [createRack, createState] = useCreatePalletRackMutation();

  const [mode, setMode] = useState<Mode>('new');
  // No developer defaults (legacy A35 / 39 / 8, P7): the fields start empty.
  const [rackNo, setRackNo] = useState('');
  const [rows, setRows] = useState<number | null>(null);
  const [layers, setLayers] = useState<number | null>(null);
  const [pickedTotal, setPickedTotal] = useState<number | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [loadingLayout, setLoadingLayout] = useState(false);
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [rackRows, setRackRows] = useState<PalletRack[] | null>(null);
  const [listProblem, setListProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<'startOver' | 'close' | 'mode' | null>(null);
  const [touched, setTouched] = useState(false);
  const layoutButtonRef = useRef<HTMLButtonElement>(null);
  /** What "Try again" repeats: the layout load or the save that failed. */
  const retryRef = useRef<() => void>(() => undefined);

  const saving = createState.isLoading || checking;
  const cells = layout ? layout.grid.flat() : [];
  const inUse = cells.filter((c) => c.on).length;
  const stale =
    layout !== null &&
    (layout.rackNo !== rackNo || layout.rows !== rows || layout.layers !== layers);
  /** Work that would be lost: a new layout not saved yet with positions switched. */
  const unsaved = layout !== null && !layout.stored && touched;

  /** The legacy checks of `btnCreatePositions` / `btnSaveDataPost`, in order; the message of the first one that fails. */
  const problem = (): string | null => {
    if (rackNo === '') return MESSAGES.rackRequired;
    if (rows === null || rows === 0) return MESSAGES.rowsRequired;
    if (rows > 99 || rows < 0) return MESSAGES.rowsRange;
    if (layers !== null && layers > 12) return MESSAGES.layersRange;
    if (layers === null || layers <= 0) return MESSAGES.layersRequired;
    return null;
  };

  /** Legacy `btnCreatePositions`: draws rows x layers positions; for a stored rack its positions decide which are in use. */
  const createLayout = async () => {
    setLayout(null);
    setTouched(false);
    setNotice(null);
    const message = problem();
    if (message || rows === null || layers === null) {
      setNotice({ kind: 'problem', text: message ?? MESSAGES.rowsRequired });
      return;
    }
    const grid: Cell[][] = [];
    for (let i = 1; i <= rows; i += 1) {
      const line: Cell[] = [];
      for (let j = 1; j <= layers; j += 1)
        line.push({ position: `${rackNo}-${two(i)}-${two(j)}`, on: true });
      grid.push(line);
    }
    if (mode === 'view') {
      setLoadingLayout(true);
      const result = await loadRack({ rackNo, positions: true });
      setLoadingLayout(false);
      if (!result.data || result.error) {
        retryRef.current = () => void createLayout();
        setNotice({
          kind: 'failed',
          title: MESSAGES.loadFailedTitle,
          message: SHARED_MESSAGES.loadFailed,
          retry: true,
        });
        return;
      }
      // A position is in use when it is stored for the rack; with nothing stored every position is off.
      const stored = new Set(result.data.positions.map((p) => p.positionNo));
      for (const line of grid) for (const cell of line) cell.on = stored.has(cell.position);
    }
    setLayout({ rackNo, rows, layers, grid, stored: mode === 'view' });
  };

  const toggle = (row: number, layer: number) => {
    setTouched(true);
    setNotice(null);
    setLayout((current) =>
      current
        ? {
            ...current,
            grid: current.grid.map((line, i) =>
              i === row
                ? line.map((cell, j) => (j === layer ? { ...cell, on: !cell.on } : cell))
                : line,
            ),
          }
        : current,
    );
  };

  const setAll = (on: boolean) => {
    setTouched(true);
    setLayout((current) =>
      current
        ? { ...current, grid: current.grid.map((line) => line.map((c) => ({ ...c, on }))) }
        : current,
    );
  };

  /** Legacy `btnPalletRackList`: the rack list; Select fills the rack, rows, layers and stored total. */
  const openList = async () => {
    setListProblem(null);
    const result = await loadRacks();
    if (!result.data || result.error) setListProblem(MESSAGES.listFailed);
    else if (result.data.length === 0) setListProblem(MESSAGES.listEmpty);
    else setRackRows(result.data);
  };

  const pickRack = (rack: PalletRack) => {
    setRackNo(rack.rackNo);
    setRows(rack.nofRows);
    setLayers(rack.nofLayers);
    setPickedTotal(rack.nofPositions);
    setRackRows(null);
    setLayout(null);
    requestAnimationFrame(() => layoutButtonRef.current?.focus());
  };

  const switchMode = (next: Mode) => {
    setMode(next);
    setLayout(null);
    setTouched(false);
    setNotice(null);
    setPickedTotal(null);
    setListProblem(null);
    if (next === 'view') {
      setRackNo('');
      setRows(null);
      setLayers(null);
    }
  };

  const startOver = () => {
    setLayout(null);
    setTouched(false);
    setNotice(null);
  };

  /**
   * Legacy `btnSaveDataPost` (and the existence check `chkPalletRackCode` it never called): the field checks, a layout
   * with at least one position in use, then the rack must not exist yet; the rack and its positions in one request.
   */
  const save = async () => {
    if (saving || mode !== 'new') return;
    setNotice(null);
    const message = problem();
    if (message) return setNotice({ kind: 'problem', text: message });
    if (!layout) return setNotice({ kind: 'problem', text: MESSAGES.noLayout });
    if (stale) return setNotice({ kind: 'problem', text: MESSAGES.layoutStale });
    const positions = layout.grid
      .flat()
      .filter((c) => c.on)
      .map((c) => c.position);
    if (positions.length === 0) return setNotice({ kind: 'problem', text: MESSAGES.nothingOn });

    setChecking(true);
    const check = await loadRack({ rackNo, positions: false });
    setChecking(false);
    if (!check.data || check.error) {
      retryRef.current = () => void save();
      return setNotice({
        kind: 'failed',
        title: SHARED_MESSAGES.noServerTitle,
        message: SHARED_MESSAGES.noServer,
        retry: true,
      });
    }
    if (check.data.rack !== null)
      return setNotice({ kind: 'problem', text: MESSAGES.alreadyExists(rackNo) });

    const result = await createRack({
      rackNo,
      nofRows: layout.rows,
      nofLayers: layout.layers,
      nofPositions: positions.length,
      positions,
    });
    if ('data' in result && result.data) {
      setTouched(false);
      setNotice({ kind: 'saved', text: MESSAGES.saved(rackNo, positions.length) });
      return;
    }
    if (!('error' in result)) return;
    const failure = classifySaveFailure(result.error as ApiQueryError);
    if (failure.kind === 'exists')
      setNotice({ kind: 'problem', text: MESSAGES.alreadyExists(rackNo) });
    else if (failure.kind === 'noServer') {
      retryRef.current = () => void save();
      setNotice({
        kind: 'failed',
        title: SHARED_MESSAGES.noServerTitle,
        message: SHARED_MESSAGES.noServer,
        retry: true,
      });
    } else
      setNotice({
        kind: 'failed',
        title: SHARED_MESSAGES.notSavedTitle,
        message: SHARED_MESSAGES.notSaved,
        details: failure.kind === 'failed' ? failure.details : undefined,
      });
  };

  const guarded = (action: 'startOver' | 'close' | 'mode', run: () => void) => {
    if (unsaved && notice?.kind !== 'saved') setPending(action);
    else run();
  };
  const [pendingMode, setPendingMode] = useState<Mode | null>(null);

  const shortcuts: KeyboardShortcut[] = [
    {
      keys: 'alt+l',
      description: mode === 'new' ? 'Create layout' : 'Load layout',
      handler: () => void createLayout(),
      enabled: !loadingLayout,
    },
    {
      keys: 'ctrl+s',
      description: 'Save rack',
      handler: () => void save(),
      enabled: mode === 'new' && !saving,
    },
  ];
  useKeyboardShortcuts(shortcuts);

  const layoutLabel = mode === 'new' ? 'Create layout' : 'Load layout';
  const totalText = layout
    ? `${inUse} of ${cells.length}`
    : pickedTotal !== null
      ? String(pickedTotal)
      : '—';

  const positionsBody = loadingLayout ? (
    <TableSkeleton rows={4} columns={6} label="Loading the layout" />
  ) : !layout ? (
    <EmptyState
      size="compact"
      title={MESSAGES.emptyLayoutTitle}
      description={mode === 'new' ? MESSAGES.emptyLayoutNew : MESSAGES.emptyLayoutView}
    />
  ) : (
    <Stack spacing={1.5}>
      {stale ? (
        <InlineHint tone="warning" boxed data-testid="layout-stale">
          {MESSAGES.layoutStale}
        </InlineHint>
      ) : null}
      {layout.stored ? <InlineHint tone="info">{MESSAGES.viewOnly}</InlineHint> : null}
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <StatusChip tone="success" label="In use" />
        <StatusChip tone="neutral" label="Off" />
        <Typography variant="body2" color="text.secondary">
          {layout.stored
            ? 'Stored positions are in use.'
            : 'Select a position to switch it on or off.'}
        </Typography>
      </Stack>
      <Box data-testid="position-grid" sx={{ display: 'grid', gap: 1 }}>
        {layout.grid.map((line, row) => (
          <Box
            key={row}
            role="group"
            aria-label={`Row ${two(row + 1)}`}
            sx={{
              display: 'grid',
              gap: 1,
              alignItems: 'center',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                sm: `64px repeat(${Math.min(layout.layers, 4)}, minmax(0, 1fr))`,
                lg: `64px repeat(${layout.layers}, minmax(0, 1fr))`,
              },
            }}
          >
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ gridColumn: { xs: '1 / -1', sm: 'auto' }, fontWeight: 600 }}
            >
              {`Row ${two(row + 1)}`}
            </Typography>
            {line.map((cell, layer) => (
              <PalletPositionTile
                key={cell.position}
                position={cell.position}
                enabled={cell.on}
                readOnly={layout.stored}
                onToggle={() => toggle(row, layer)}
              />
            ))}
          </Box>
        ))}
      </Box>
    </Stack>
  );

  return (
    <PageShell
      data-testid="pallet-rack-page"
      title="Pallet rack build"
      context="File · Define a rack and the pallet positions in use"
      secondaryActions={
        <Button variant="text" onClick={() => guarded('close', () => void navigate(PATHS.home))}>
          Close
        </Button>
      }
      toolbar={<ShortcutsLegend shortcuts={shortcuts} />}
      footer={
        <ActionBar
          label="Rack summary"
          message={
            notice?.kind === 'failed' ? (
              <ErrorState
                data-testid="save-error"
                title={notice.title}
                message={notice.message}
                details={notice.details}
                onRetry={notice.retry ? () => retryRef.current() : undefined}
                onClose={() => setNotice(null)}
              />
            ) : null
          }
          start={
            <Stack spacing={1}>
              <StatGroup
                size="small"
                label="Rack summary"
                items={[
                  { label: 'Rack', value: (layout?.rackNo ?? rackNo) || '—' },
                  {
                    label: 'Rows × layers',
                    value: layout ? `${layout.rows} × ${layout.layers}` : '—',
                  },
                  { label: 'Positions in use', value: totalText },
                ]}
                data-testid="rack-summary"
              />
              {notice?.kind === 'problem' ? (
                <InlineHint tone="error" data-testid="save-problem">
                  {notice.text}
                </InlineHint>
              ) : notice?.kind === 'saved' ? (
                <InlineHint tone="success" live data-testid="save-result">
                  {notice.text}
                </InlineHint>
              ) : null}
            </Stack>
          }
        >
          <Button
            variant="outlined"
            onClick={() => guarded('startOver', startOver)}
            disabled={!layout}
          >
            Start over
          </Button>
          {mode === 'new' ? (
            <Button variant="contained" onClick={() => void save()} disabled={saving}>
              {saving ? 'Saving…' : 'Save rack'}
            </Button>
          ) : null}
        </ActionBar>
      }
    >
      <Stack spacing={2}>
        <FormSection title="Rack" step={1}>
          <SegmentedControl
            label="What do you want to do?"
            value={mode}
            options={MODES}
            onChange={(next) => {
              setPendingMode(next as Mode);
              guarded('mode', () => switchMode(next as Mode));
            }}
            data-testid="rack-mode"
          />
          <FieldGrid columns={{ xs: 1, sm: 2, md: 4 }} alignItems="start">
            <LookupField
              label="Rack number"
              value={rackNo}
              onCommit={(v) => {
                setRackNo(v);
                setNotice(null);
              }}
              onSearch={() => void openList()}
              readOnly={mode !== 'new'}
              hideSearch={mode === 'new'}
              searchLabel="Search racks"
              required={mode === 'new'}
              maxLength={10}
              error={!!listProblem}
              helperText={
                listProblem ?? (mode === 'new' ? MESSAGES.rackHelpNew : MESSAGES.rackHelpView)
              }
            />
            <NumericField
              label="Rows (1–99)"
              value={rows}
              decimals={0}
              readOnly={mode !== 'new'}
              onCommit={setRows}
            />
            <NumericField
              label="Layers (1–12)"
              value={layers}
              decimals={0}
              readOnly={mode !== 'new'}
              onCommit={setLayers}
            />
            <TextInput label="Positions in use" value={totalText} />
          </FieldGrid>
          <Box>
            <Button
              ref={layoutButtonRef}
              variant="contained"
              onClick={() => void createLayout()}
              disabled={loadingLayout}
              data-testid="layout-button"
            >
              {loadingLayout ? 'Loading layout…' : layoutLabel}
            </Button>
          </Box>
        </FormSection>
        <FormSection
          title="Pallet positions"
          step={2}
          status={
            layout ? (
              <StatusChip
                tone="neutral"
                label={`${inUse} of ${cells.length} in use`}
                data-testid="in-use-count"
              />
            ) : undefined
          }
          actions={
            layout && !layout.stored ? (
              <>
                <Button size="small" onClick={() => setAll(true)}>
                  All in use
                </Button>
                <Button size="small" onClick={() => setAll(false)}>
                  All off
                </Button>
              </>
            ) : undefined
          }
        >
          {positionsBody}
        </FormSection>
      </Stack>
      {rackRows ? (
        <LookupDialog<PalletRack>
          open
          title="Stored racks"
          columns={RACK_COLUMNS}
          rows={rackRows}
          getRowId={(row) => row.rackNo}
          onSelect={pickRack}
          onClose={() => setRackRows(null)}
        />
      ) : null}
      <ConfirmDialog
        open={pending !== null}
        destructive
        title="Discard this layout?"
        message="The positions you switched have not been saved and will be lost."
        confirmLabel="Discard layout"
        cancelLabel="Keep editing"
        onCancel={() => {
          setPending(null);
          setPendingMode(null);
        }}
        onConfirm={() => {
          const action = pending;
          setPending(null);
          if (action === 'startOver') startOver();
          else if (action === 'close') void navigate(PATHS.home);
          else if (action === 'mode' && pendingMode) switchMode(pendingMode);
          setPendingMode(null);
        }}
      />
    </PageShell>
  );
}
