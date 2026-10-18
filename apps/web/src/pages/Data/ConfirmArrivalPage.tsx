import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  Box,
  Button,
  ConfirmDialog,
  DmyDatePicker,
  EmptyState,
  ErrorState,
  FieldGrid,
  formatDmy,
  formatNumber,
  FormSection,
  InlineHint,
  InventoryGrid,
  ListSkeleton,
  OperationalPage,
  ScanInput,
  SegmentedControl,
  SelectField,
  ShortcutsLegend,
  Stack,
  StatGroup,
  StatusChip,
  TextInput,
  Typography,
  useKeyboardShortcuts,
  useScanFeedback,
  type InlineHintTone,
  type InventoryGridColumn,
  type KeyboardShortcut,
  type StatItem,
} from '@cims/ui';
import {
  useConfirmArrivalsMutation,
  useGetConfirmArrivalCountriesQuery,
  useGetConfirmArrivalDcsQuery,
  useLazyGetPendingArrivalsQuery,
  type PendingArrivalsArgs,
} from '../../services/arrivalsApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import {
  addRow,
  buildConfirmRequest,
  duplicateRcvNos,
  editContainerNo,
  emptyLists,
  findPickTarget,
  firstTickedContainer,
  lineCounts,
  listsFromLoad,
  removeRow,
  roundTo,
  selectAll,
  toggleContainer,
  toggleSupplier,
  totals,
  type ContainerLine,
  type ListRow,
  type ListsState,
  type Totals,
} from './confirmArrivalLists';
import { MESSAGES } from './confirmArrivalMessages';
import { PickLine } from './PickLine';

const SHIPMENTS = ['Local', 'Import'] as const;
const ALL = 'All';

interface FilterForm {
  cargoFrom: string;
  dc: string;
  country: string;
  /** Local yyyy-MM-ddTHH:mm:ss or null. */
  arrivalDate: string | null;
}

type SaveResult =
  | { kind: 'saved'; count: number; when: string }
  | { kind: 'failed'; noServer: boolean; details: string };

type PendingConfirm = 'startOver' | 'close' | null;

const num = (precision: number) => (value: number) =>
  formatNumber(roundTo(value, precision), precision);

/** Column order by task priority: identify the contract, then quantities (visible without scrolling), then the rest. */
function contractColumns(action: (row: ListRow) => ReactNode): InventoryGridColumn<ListRow>[] {
  return [
    {
      field: 'action',
      headerName: '',
      width: 96,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: ({ row }) => action(row),
    },
    { field: 'rcvNo', headerName: 'Rcv no', width: 110 },
    { field: 'contractNo', headerName: 'Contract no', width: 140 },
    { field: 'ctns', headerName: 'Ctns', type: 'number', width: 80, valueFormatter: num(0) },
    { field: 'pcs', headerName: 'PCS', type: 'number', width: 90, valueFormatter: num(0) },
    {
      field: 'grossWgt',
      headerName: 'Gross weight',
      type: 'number',
      width: 120,
      valueFormatter: num(2),
    },
    { field: 'cbm', headerName: 'CBM', type: 'number', width: 90, valueFormatter: num(3) },
    { field: 'itemNo', headerName: 'Item no', width: 100 },
    {
      field: 'shipperCode',
      headerName: 'Supplier',
      minWidth: 200,
      valueGetter: (_v, row) =>
        [row.shipperCode, row.shipperName].filter(Boolean).join(' · ') || '(no supplier code)',
    },
    { field: 'cargoType', headerName: 'Cargo type', width: 100 },
    { field: 'warehouse', headerName: 'DC', minWidth: 160 },
    { field: 'country', headerName: 'Country', width: 90 },
    {
      field: 'arrivalDate',
      headerName: 'Arrival time',
      width: 140,
      valueFormatter: (v: string | null) => formatDmy(v, true),
    },
  ];
}

function totalItems(value: Totals): StatItem[] {
  return [
    { label: 'Contracts', value: formatNumber(value.contracts) },
    { label: 'Ctns', value: formatNumber(value.ctns) },
    { label: 'PCS', value: formatNumber(value.pcs) },
    { label: 'Gross weight', value: formatNumber(value.grossWgt, 2) },
    { label: 'CBM', value: formatNumber(value.cbm, 3) },
  ];
}

function containerName(line: ContainerLine): string {
  return line.containerNo || line.loadReference || line.vesselName || 'Not on an import container';
}

const isOffContainer = (line: ContainerLine) => line.inboundContainerOrderNo === 0;

function filterSummary({ cargoFrom, dc, country }: PendingArrivalsArgs): string {
  const dcText = dc === ALL ? 'all DCs' : dc;
  const countryText = country === ALL ? 'all countries' : country;
  return `${cargoFrom}, ${dcText}, ${countryText}`;
}

/**
 * Confirm arrivals (legacy /Data/ConfirmArrival, CloudMenu 200.05.04), redesigned on the OperationalPage template
 * (docs/19 "Showcase"). Kept from legacy (docs/13): the four API calls and their payloads, the list rules of
 * confirmArrivalLists.ts (supplier/container picking, duplicates, unticking removes from both lists, Add/Remove to
 * the end), the save checks in order (arrival date first, then a selection), only the FIRST ticked container sent,
 * no confirmation dialog before saving, lists kept after a save, New keeps the filters.
 */
export function ConfirmArrivalPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();
  const { control, getValues, setValue } = useForm<FilterForm>({
    defaultValues: { cargoFrom: 'Local', dc: ALL, country: ALL, arrivalDate: null },
  });

  const dcs = useGetConfirmArrivalDcsQuery();
  const countries = useGetConfirmArrivalCountriesQuery();
  const [loadPending, pendingState] = useLazyGetPendingArrivalsQuery();
  const [confirmArrivals, confirmState] = useConfirmArrivalsMutation();

  const [lists, setLists] = useState<ListsState>(emptyLists);
  const [loadedFilters, setLoadedFilters] = useState<PendingArrivalsArgs | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [pickResult, setPickResult] = useState<{ tone: InlineHintTone; text: string } | null>(null);
  const [dateMissing, setDateMissing] = useState(false);
  const [selectionMissing, setSelectionMissing] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirm>(null);

  const scanRef = useRef<HTMLInputElement>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLDivElement>(null);

  const [cargoFrom, dc, country, arrivalDate] = useWatch({
    control,
    name: ['cargoFrom', 'dc', 'country', 'arrivalDate'],
  });

  const dcOptions = useMemo(() => [ALL, ...(dcs.data ?? []).map((d) => d.whDes)], [dcs.data]);
  const countryOptions = useMemo(
    () => [ALL, ...(countries.data ?? []).map((c) => c.countryCode)],
    [countries.data],
  );
  const countryName =
    country === ALL
      ? 'All countries'
      : (countries.data?.find((c) => c.countryCode === country)?.countryName ?? '');

  const loading = pendingState.isFetching;
  const saving = confirmState.isLoading;
  const loaded = loadedFilters !== null;
  const filtersChanged =
    loaded &&
    (loadedFilters.cargoFrom !== cargoFrom ||
      loadedFilters.dc !== dc ||
      loadedFilters.country !== country);
  const counts = useMemo(() => lineCounts(lists), [lists]);
  const firstContainer = firstTickedContainer(lists);
  const tickedContainers = lists.containers.filter((c) => c.checked).length;
  const pendingTotals = totals(lists.pending);
  const selectedTotals = totals(lists.selected);
  const duplicates = duplicateRcvNos(lists.selected);
  const hasWork = lists.suppliers.length > 0 || lists.containers.length > 0 || arrivalDate !== null;

  const changeLists = (update: (s: ListsState) => ListsState) => {
    setLists(update);
    setSaveResult((r) => (r?.kind === 'saved' ? r : null));
  };

  const loadContracts = async () => {
    setLists(emptyLists);
    setLoadFailed(false);
    setPickResult(null);
    setSaveResult(null);
    setSelectionMissing(false);
    const { cargoFrom: c, dc: d, country: k } = getValues();
    const filters = { cargoFrom: c, dc: d, country: k };
    const result = await loadPending(filters);
    if (result.data) {
      const next = listsFromLoad(result.data);
      setLists(next);
      setLoadedFilters(filters);
      // Keyboard-first: the next step is picking, so the cursor goes to the scan field.
      if (next.containers.length + next.suppliers.length > 0) scanRef.current?.focus();
    } else {
      setLoadedFilters(null);
      setLoadFailed(true);
    }
  };

  const quickPick = (text: string) => {
    if (!loaded) {
      feedback.playError();
      setPickResult({ tone: 'error', text: MESSAGES.pickNothingLoaded });
      return;
    }
    const target = findPickTarget(lists, text);
    if (!target) {
      feedback.playError();
      setPickResult({ tone: 'error', text: MESSAGES.pickNotFound(text) });
      return;
    }
    feedback.playSuccess();
    const { line } = target;
    const name = target.kind === 'container' ? containerName(target.line) : target.line.shipperCode;
    if (line.checked) {
      setPickResult({ tone: 'info', text: MESSAGES.pickedAlready(name) });
      return;
    }
    if (target.kind === 'container') {
      changeLists((s) => toggleContainer(s, line.id, true));
      setPickResult({
        tone: 'success',
        text: MESSAGES.pickedContainer(name, counts.containers.get(line.id) ?? 0),
      });
    } else {
      changeLists((s) => toggleSupplier(s, line.id, true));
      setPickResult({
        tone: 'success',
        text: MESSAGES.pickedSupplier(name, counts.suppliers.get(line.id) ?? 0),
      });
    }
  };

  const save = async () => {
    setSaveResult(null);
    const date = getValues('arrivalDate');
    if (!date) {
      setDateMissing(true);
      dateRef.current?.querySelector<HTMLElement>('[role="spinbutton"], input')?.focus();
      return;
    }
    const request = buildConfirmRequest(lists, date);
    if (request.rcvNos.length === 0) {
      setSelectionMissing(true);
      selectedRef.current?.scrollIntoView?.({ block: 'center' });
      return;
    }
    const result = await confirmArrivals(request);
    if ('data' in result && result.data) {
      // Like the legacy page, the lists stay as they are after a save.
      setSaveResult({
        kind: 'saved',
        count: result.data.contractsConfirmed,
        when: formatDmy(date, true),
      });
    } else if ('error' in result) {
      const error = result.error as ApiQueryError;
      setSaveResult({
        kind: 'failed',
        noServer: error.status === undefined,
        details: error.details?.join(' ') ?? error.message,
      });
    }
  };

  const startNew = () => {
    setValue('arrivalDate', null);
    setLists(emptyLists);
    setLoadedFilters(null);
    setLoadFailed(false);
    setPickResult(null);
    setSaveResult(null);
    setDateMissing(false);
    setSelectionMissing(false);
  };

  const close = () => void navigate(PATHS.home);

  const shortcuts: KeyboardShortcut[] = [
    {
      keys: 'alt+l',
      description: 'Load contracts',
      handler: () => void loadContracts(),
      enabled: !loading && !saving,
    },
    { keys: '/', description: 'Scan field', handler: () => scanRef.current?.focus() },
    {
      keys: 'alt+a',
      description: 'Add all',
      handler: () => changeLists(selectAll),
      enabled: lists.pending.length > 0 && !saving,
    },
    {
      keys: 'ctrl+enter',
      description: 'Confirm arrival',
      handler: () => void save(),
      enabled: !saving,
    },
  ];
  useKeyboardShortcuts(shortcuts);

  const pendingColumns = contractColumns((row) => (
    <Button
      variant="outlined"
      color="primary"
      aria-label={`Add ${row.rcvNo}`}
      onClick={() => changeLists((s) => addRow(s, row.uid))}
      disabled={saving}
    >
      Add
    </Button>
  ));
  const selectedColumns = contractColumns((row) => (
    <Button
      variant="outlined"
      color="error"
      aria-label={`Remove ${row.rcvNo}`}
      onClick={() => changeLists((s) => removeRow(s, row.uid))}
      disabled={saving}
    >
      Remove
    </Button>
  ));

  const filters = (
    <FormSection
      step={1}
      title="Find pending contracts"
      description="Choose the shipment and, if needed, one DC or country. Then load the contracts waiting for arrival confirmation."
    >
      <FieldGrid columns={{ xs: 1, sm: 2, lg: 4 }} alignItems="start">
        <Controller
          control={control}
          name="cargoFrom"
          render={({ field }) => (
            <SegmentedControl
              label="Shipment"
              value={field.value}
              options={SHIPMENTS}
              onChange={field.onChange}
              fullWidth
            />
          )}
        />
        <Box sx={{ pt: { sm: 2.5 } }}>
          <Controller
            control={control}
            name="dc"
            render={({ field }) => (
              <SelectField
                label="DC"
                value={field.value}
                options={dcOptions}
                onChange={field.onChange}
              />
            )}
          />
        </Box>
        <Box sx={{ pt: { sm: 2.5 } }}>
          <Controller
            control={control}
            name="country"
            render={({ field }) => (
              <SelectField
                label="Country"
                value={field.value}
                options={countryOptions}
                onChange={field.onChange}
                helperText={countryName || ' '}
              />
            )}
          />
        </Box>
        <Box sx={{ pt: { sm: 2.5 } }}>
          <Button
            data-testid="load-contracts"
            variant="contained"
            size="large"
            fullWidth
            onClick={() => void loadContracts()}
            disabled={loading || saving}
            sx={(t) => ({ minHeight: t.cims.density.touchTarget })}
          >
            {loading ? 'Loading contracts…' : 'Load contracts'}
          </Button>
        </Box>
      </FieldGrid>
      {loadFailed ? (
        <ErrorState
          data-testid="load-error"
          title={MESSAGES.loadFailedTitle}
          message={MESSAGES.loadFailed}
          onRetry={() => void loadContracts()}
        />
      ) : null}
      {loaded && filtersChanged ? (
        <InlineHint tone="warning" data-testid="filters-changed" boxed>
          The filters changed since the last load. The lists still show{' '}
          {filterSummary(loadedFilters)}. Select Load contracts to refresh them.
        </InlineHint>
      ) : null}
      {loaded && !filtersChanged ? (
        <InlineHint tone="success" live data-testid="load-summary">
          {MESSAGES.loaded(lists.loaded.length, lists.suppliers.length, lists.containers.length)}{' '}
          for {filterSummary(loadedFilters)}.
        </InlineHint>
      ) : null}
    </FormSection>
  );

  const pickPanel = (
    <FormSection
      step={2}
      title="Pick containers or suppliers"
      description="Ticking a line lists its contracts under Pending."
    >
      <Box>
        <ScanInput
          label="Scan a container or supplier"
          helperText="Container no, load reference or supplier code, then Enter"
          inputRef={scanRef}
          forceUppercase
          onScan={quickPick}
        />
        {pickResult ? (
          <Box sx={{ mt: 1 }}>
            <InlineHint tone={pickResult.tone} live data-testid="pick-result">
              {pickResult.text}
            </InlineHint>
          </Box>
        ) : null}
      </Box>
      {loading ? (
        <ListSkeleton rows={4} label="Loading containers and suppliers" />
      ) : !loaded ? (
        <EmptyState
          size="compact"
          title="Nothing loaded yet"
          description="Choose the shipment in step 1 and select Load contracts."
        />
      ) : lists.containers.length + lists.suppliers.length === 0 ? (
        <EmptyState
          size="compact"
          title="No contracts are waiting"
          description="Nothing is pending arrival confirmation for these filters. Try another shipment, DC or country."
        />
      ) : (
        <Stack spacing={2}>
          {tickedContainers > 1 && firstContainer ? (
            <InlineHint tone="warning" boxed data-testid="first-container-hint">
              Only the first ticked container ({containerName(firstContainer)}) is updated with this
              arrival. The contracts of every ticked line are confirmed.
            </InlineHint>
          ) : null}
          {lists.containers.length > 0 ? (
            <Box>
              <Typography variant="h3" component="h3" sx={{ mb: 1 }}>
                Containers ({lists.containers.length})
              </Typography>
              <Stack component="ul" spacing={1} sx={{ m: 0, p: 0 }} data-testid="container-list">
                {lists.containers.map((line) => {
                  const off = isOffContainer(line);
                  const isFirst = firstContainer?.id === line.id;
                  return (
                    <PickLine
                      key={line.id}
                      checked={line.checked}
                      onChange={(checked) =>
                        changeLists((s) => toggleContainer(s, line.id, checked))
                      }
                      checkboxLabel={`Container ${line.containerNo || line.loadReference || line.id + 1}`}
                      primary={off ? 'Not on an import container' : containerName(line)}
                      secondary={
                        off
                          ? 'Contracts without container details'
                          : [line.vesselName, line.loadReference, line.containerType]
                              .filter((v) => v && v !== containerName(line))
                              .join(' · ')
                      }
                      count={counts.containers.get(line.id) ?? 0}
                      badge={
                        isFirst && !off ? (
                          <StatusChip tone="info" label="Updated on confirm" />
                        ) : null
                      }
                      disabled={saving}
                    >
                      {line.checked && !off ? (
                        <TextInput
                          label="Container no"
                          value={line.containerNo}
                          onChange={(value) =>
                            changeLists((s) => editContainerNo(s, line.id, value))
                          }
                          helperText={
                            isFirst
                              ? 'Saved with the arrival.'
                              : 'Not saved: only the first ticked container is updated.'
                          }
                        />
                      ) : null}
                    </PickLine>
                  );
                })}
              </Stack>
            </Box>
          ) : null}
          {lists.suppliers.length > 0 ? (
            <Box>
              <Typography variant="h3" component="h3" sx={{ mb: 1 }}>
                Suppliers ({lists.suppliers.length})
              </Typography>
              <Stack component="ul" spacing={1} sx={{ m: 0, p: 0 }} data-testid="supplier-list">
                {lists.suppliers.map((line) => (
                  <PickLine
                    key={line.id}
                    checked={line.checked}
                    onChange={(checked) => changeLists((s) => toggleSupplier(s, line.id, checked))}
                    checkboxLabel={`Supplier ${line.shipperCode || '(blank)'}`}
                    primary={line.shipperCode || '(no supplier code)'}
                    secondary={line.shipperName ?? undefined}
                    count={counts.suppliers.get(line.id) ?? 0}
                    disabled={saving}
                  />
                ))}
              </Stack>
            </Box>
          ) : null}
        </Stack>
      )}
    </FormSection>
  );

  const contracts =
    !loaded && !loading ? (
      <FormSection step={3} title="Choose the contracts for this arrival">
        <EmptyState
          data-testid="start-empty"
          title="Load pending contracts to start"
          description="Pick the shipment in step 1 and select Load contracts. Then tick containers or suppliers and add their contracts to the selection."
          action={
            <Button variant="contained" onClick={() => void loadContracts()} disabled={saving}>
              Load contracts
            </Button>
          }
        />
      </FormSection>
    ) : (
      <FormSection
        step={3}
        title="Choose the contracts for this arrival"
        description="Only the contracts under “Selected for this arrival” are confirmed."
      >
        <Stack spacing={3}>
          <Box data-testid="pending-list">
            <Stack
              direction="row"
              alignItems="center"
              justifyContent="space-between"
              flexWrap="wrap"
              useFlexGap
              spacing={1}
              sx={{ mb: 1 }}
            >
              <Typography variant="h3" component="h3">
                Pending ({lists.pending.length})
              </Typography>
              <Button
                variant="contained"
                onClick={() => changeLists(selectAll)}
                disabled={lists.pending.length === 0 || saving}
              >
                Add all to selection
              </Button>
            </Stack>
            <StatGroup
              label="Pending totals"
              data-testid="pending-totals"
              items={totalItems(pendingTotals)}
            />
            <Box sx={{ mt: 1 }}>
              <InventoryGrid<ListRow>
                columns={pendingColumns}
                rows={lists.pending}
                getRowId={(r) => r.uid}
                loading={loading}
                emptyMessage="Tick a container or supplier to list its contracts here"
                hideFooter={lists.pending.length <= 100}
                initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
                height={lists.pending.length > 12 ? 460 : undefined}
                disableVirtualization
              />
            </Box>
          </Box>

          <Box data-testid="selected-list" ref={selectedRef}>
            <Typography variant="h3" component="h3" sx={{ mb: 1 }}>
              Selected for this arrival ({lists.selected.length})
            </Typography>
            {selectionMissing && lists.selected.length === 0 ? (
              <Box sx={{ mb: 1 }}>
                <InlineHint tone="error" data-testid="selection-error">
                  {MESSAGES.noneSelected}
                </InlineHint>
              </Box>
            ) : null}
            {duplicates.length > 0 ? (
              <Box sx={{ mb: 1 }}>
                <InlineHint tone="info" data-testid="duplicates-hint">
                  {duplicates.join(', ')} {duplicates.length === 1 ? 'is' : 'are'} listed twice
                  (picked by supplier and by container). Confirming twice does no harm.
                </InlineHint>
              </Box>
            ) : null}
            <StatGroup
              label="Selected totals"
              data-testid="selected-totals"
              items={totalItems(selectedTotals)}
            />
            <Box sx={{ mt: 1 }}>
              <InventoryGrid<ListRow>
                columns={selectedColumns}
                rows={lists.selected}
                getRowId={(r) => r.uid}
                emptyMessage="Nothing selected yet. Use Add, or Add all to selection."
                hideFooter={lists.selected.length <= 100}
                initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
                height={lists.selected.length > 12 ? 460 : undefined}
                disableVirtualization
              />
            </Box>
          </Box>
        </Stack>
      </FormSection>
    );

  const saveMessage =
    saveResult?.kind === 'saved' ? (
      <InlineHint tone="success" live boxed data-testid="save-result">
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1}
          alignItems={{ sm: 'center' }}
          justifyContent="space-between"
        >
          <span>
            <strong>{MESSAGES.saved(saveResult.count, saveResult.when)}</strong>{' '}
            {MESSAGES.savedNext}
          </span>
          <Button variant="outlined" color="success" onClick={() => void loadContracts()}>
            Load again
          </Button>
        </Stack>
      </InlineHint>
    ) : saveResult?.kind === 'failed' ? (
      <ErrorState
        data-testid="save-result"
        title={MESSAGES.notSavedTitle}
        message={saveResult.noServer ? MESSAGES.noServer : MESSAGES.notSaved}
        details={saveResult.noServer ? undefined : saveResult.details}
        onRetry={saveResult.noServer ? () => void save() : undefined}
        onClose={() => setSaveResult(null)}
      />
    ) : null;

  return (
    <>
      <OperationalPage
        title="Confirm arrivals"
        context="Booking · Contracts waiting for arrival confirmation"
        secondaryActions={
          <Button
            variant="text"
            onClick={() =>
              lists.selected.length > 0 && saveResult?.kind !== 'saved'
                ? setPendingConfirm('close')
                : close()
            }
          >
            Close
          </Button>
        }
        toolbar={<ShortcutsLegend shortcuts={shortcuts} />}
        scanArea={filters}
        aside={pickPanel}
        asideLabel="Pick containers or suppliers"
        asidePosition="start"
        asideWidth="narrow"
        actionBar={
          <ActionBar
            label="Confirm the arrival"
            message={saveMessage}
            start={
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={{ xs: 1.5, sm: 3 }}
                alignItems={{ xs: 'stretch', sm: 'center' }}
              >
                <Box
                  ref={dateRef}
                  data-testid="arrival-date"
                  sx={{ width: { sm: 300 }, flex: 'none' }}
                >
                  <Controller
                    control={control}
                    name="arrivalDate"
                    render={({ field }) => (
                      <DmyDatePicker
                        withTime
                        required
                        label="Arrival date and time"
                        value={field.value}
                        onChange={(value) => {
                          field.onChange(value);
                          if (value) setDateMissing(false);
                        }}
                        error={dateMissing && !field.value}
                        helperText={
                          dateMissing && !field.value ? MESSAGES.noArrivalDate : 'dd/mm/yyyy hh:mm'
                        }
                        fullWidth
                      />
                    )}
                  />
                </Box>
                <StatGroup
                  size="large"
                  label="Selected for confirmation"
                  data-testid="selected-summary"
                  items={totalItems(selectedTotals)}
                />
              </Stack>
            }
          >
            <Button
              data-testid="start-over"
              variant="outlined"
              onClick={() => (hasWork ? setPendingConfirm('startOver') : startNew())}
              disabled={saving}
            >
              Start over
            </Button>
            <Button
              data-testid="confirm-arrival"
              variant="contained"
              size="large"
              onClick={() => void save()}
              disabled={saving}
              sx={{ px: 3 }}
            >
              {saving ? 'Confirming…' : 'Confirm arrival'}
            </Button>
          </ActionBar>
        }
      >
        {contracts}
      </OperationalPage>
      <ConfirmDialog
        open={pendingConfirm === 'startOver'}
        destructive
        title="Start over?"
        message="This clears the loaded lines, the selection and the arrival date. The filters stay as they are."
        confirmLabel="Start over"
        cancelLabel="Keep working"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          setPendingConfirm(null);
          startNew();
        }}
      />
      <ConfirmDialog
        open={pendingConfirm === 'close'}
        destructive
        title="Leave without confirming?"
        message={`${lists.selected.length} selected ${lists.selected.length === 1 ? 'contract has' : 'contracts have'} not been confirmed. Leaving clears the selection.`}
        confirmLabel="Leave"
        cancelLabel="Stay"
        onCancel={() => setPendingConfirm(null)}
        onConfirm={() => {
          setPendingConfirm(null);
          close();
        }}
      />
    </>
  );
}
