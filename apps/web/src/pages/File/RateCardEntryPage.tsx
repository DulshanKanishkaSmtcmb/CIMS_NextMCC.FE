import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  CheckboxField,
  EmptyState,
  ErrorState,
  formatDmy,
  formatNumber,
  FormSection,
  InlineHint,
  InventoryGrid,
  PageShell,
  ShortcutsLegend,
  Stack,
  StatusChip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSkeleton,
  TextInput,
  useKeyboardShortcuts,
  type InventoryGridColumn,
  type KeyboardShortcut,
} from '@cims/ui';
import {
  useLazyGetRateCardQuery,
  type CfsRate,
  type FreightRate,
  type RateCard,
} from '../../services/rateCardApi';
import { PATHS } from '../../routes/paths';
import { smartMatches } from './masterEntry';
import { SHARED_MESSAGES } from './masterDataPage';
import { RATE_CARD_MESSAGES as MESSAGES } from './rateCardMessages';

/** Rates in USD with two decimals (the legacy numeric extender), thousands separated. */
const usd = (value: number) => formatNumber(value, 2, { fixed: true });

type FreightRow = FreightRate & { id: number };
type CfsRow = CfsRate & { id: number };

const FREIGHT_COLUMNS: InventoryGridColumn<FreightRow>[] = [
  { field: 'portCode', headerName: 'Port code', width: 120 },
  { field: 'portName', headerName: 'Port name', flex: 1, minWidth: 180 },
  { field: 'cntrType', headerName: 'Container type', width: 140 },
  {
    field: 'rateInUsd',
    headerName: 'Rate (USD)',
    type: 'number',
    width: 130,
    valueFormatter: (v: number) => usd(v),
  },
];

const CFS_COLUMNS: InventoryGridColumn<CfsRow>[] = [
  { field: 'chgCode', headerName: 'Charge code', width: 120 },
  { field: 'chgDescription', headerName: 'Charge name', flex: 1, minWidth: 180 },
  {
    field: 'rateInUsd',
    headerName: 'Rate (USD)',
    type: 'number',
    width: 120,
    valueFormatter: (v: number) => usd(v),
  },
  { field: 'unitType', headerName: 'Unit type', width: 110 },
  {
    field: 'unitCalType',
    headerName: 'Calculation',
    width: 120,
    valueGetter: (_v, row) => row.unitCalType ?? MESSAGES.notSet,
  },
  {
    field: 'range',
    headerName: 'Range',
    width: 130,
    sortable: false,
    valueGetter: (_v, row) =>
      row.unitCalType === 'Range'
        ? `${formatNumber(row.range1, 2)} – ${formatNumber(row.range2, 2)}`
        : '—',
  },
  { field: 'fileCaption', headerName: 'Table type', width: 160 },
  {
    field: 'materialCode',
    headerName: 'Material',
    minWidth: 180,
    flex: 1,
    valueGetter: (_v, row) =>
      [row.materialCode, row.pmDescription].filter(Boolean).join(' · ') || '—',
  },
  {
    field: 'isActive',
    headerName: 'Active',
    width: 90,
    valueGetter: (_v, row) => (row.isActive ? 'Yes' : 'No'),
  },
  {
    field: 'rateUpdateDate',
    headerName: 'Rate updated',
    width: 170,
    valueGetter: (_v, row) =>
      row.rateUpdateDate
        ? `${formatDmy(row.rateUpdateDate, true)}${row.rateUpdateBy ? ` by ${row.rateUpdateBy}` : ''}`
        : '—',
  },
];

/**
 * Rate card (legacy /File/RateCardEntry "Rate Card Entry", CloudMenu 100.12) as a read-only rate explorer on PageShell
 * (docs/19 sections 3.4 and 14.2): the legacy page let rates be typed but never saved them (docs/18 B, R3). Kept from
 * legacy: the one call (`GET api/v1/master-data/rate-cards`) when the page opens and on Reload rates, the three tables
 * and their rows as the API builds them (every port × container type, 0 for a missing rate), two-decimal rates, Reload
 * replaces the tables (R1 fix).
 */
export function RateCardEntryPage() {
  const navigate = useNavigate();
  const [loadRates] = useLazyGetRateCardQuery();
  const [rates, setRates] = useState<RateCard | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [search, setSearch] = useState('');
  const [onlyWithRate, setOnlyWithRate] = useState(false);

  const fetchRates = () =>
    loadRates().then((result) => {
      if (result.data && !result.error) {
        setRates(result.data);
        setState('ready');
      } else {
        setState('failed');
      }
    });

  useEffect(() => {
    void fetchRates();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the page opens
  }, []);

  const reload = () => {
    setState('loading');
    void fetchRates();
  };

  const freightRows = useMemo<FreightRow[]>(
    () => (rates?.freight ?? []).map((r, id) => ({ ...r, id })),
    [rates],
  );
  const withRate = freightRows.filter((r) => r.rateInUsd !== 0).length;
  const visibleFreight = useMemo(
    () =>
      freightRows.filter(
        (r) =>
          (!onlyWithRate || r.rateInUsd !== 0) &&
          smartMatches(`${r.portCode} ${r.portName} ${r.cntrType}`, search),
      ),
    [freightRows, onlyWithRate, search],
  );
  const cfsRows = useMemo<CfsRow[]>(
    () => (rates?.cfs ?? []).map((r, id) => ({ ...r, id })),
    [rates],
  );

  const shortcuts: KeyboardShortcut[] = [
    { keys: 'alt+l', description: 'Reload rates', handler: reload, enabled: state !== 'loading' },
  ];
  useKeyboardShortcuts(shortcuts);

  const loading = state === 'loading';
  const skeleton = (columns: number) => (
    <TableSkeleton rows={4} columns={columns} label="Loading rates" />
  );

  return (
    <PageShell
      data-testid="rate-card-page"
      title="Rate card"
      context="File · Rates for export clearance, freight and CFS charges"
      status={<StatusChip tone="neutral" label="Read only" />}
      secondaryActions={
        <>
          <Button variant="outlined" onClick={reload} disabled={loading}>
            {loading ? 'Loading rates…' : 'Reload rates'}
          </Button>
          <Button variant="text" onClick={() => void navigate(PATHS.home)}>
            Close
          </Button>
        </>
      }
      toolbar={
        <Stack spacing={1}>
          <ShortcutsLegend shortcuts={shortcuts} />
          <InlineHint tone="info" data-testid="read-only-hint">
            {MESSAGES.readOnly}
          </InlineHint>
        </Stack>
      }
    >
      {state === 'failed' ? (
        <ErrorState
          title={MESSAGES.loadFailedTitle}
          message={SHARED_MESSAGES.listFailed}
          onRetry={reload}
        />
      ) : (
        <Stack spacing={2}>
          <Box
            sx={{
              display: 'grid',
              gap: 2,
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(260px, 1fr) 3fr' },
              alignItems: 'start',
            }}
          >
            <FormSection title="Export clearance charges" data-testid="clearance">
              {loading ? (
                skeleton(2)
              ) : rates && rates.clearance.length > 0 ? (
                <TableContainer>
                  <Table aria-label="Export clearance charges">
                    <TableHead>
                      <TableRow>
                        <TableCell>Container type</TableCell>
                        <TableCell align="right">Rate (USD)</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {rates.clearance.map((r) => (
                        <TableRow key={r.cntrType}>
                          <TableCell>{r.cntrType}</TableCell>
                          <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {usd(r.rateInUsd)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              ) : (
                <EmptyState size="compact" title={MESSAGES.noClearance} />
              )}
            </FormSection>

            <FormSection
              title="Export freight charges"
              status={
                rates ? (
                  <StatusChip
                    tone="neutral"
                    label={`${formatNumber(freightRows.length)} port × container rows`}
                  />
                ) : undefined
              }
              data-testid="freight"
            >
              {loading ? (
                skeleton(4)
              ) : freightRows.length === 0 ? (
                <EmptyState size="compact" title={MESSAGES.noFreight} />
              ) : (
                <Stack spacing={1}>
                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={2}
                    alignItems={{ xs: 'stretch', sm: 'center' }}
                  >
                    <Box sx={{ flex: 1, maxWidth: 360 }}>
                      <TextInput
                        label="Search ports and container types"
                        value={search}
                        onChange={setSearch}
                      />
                    </Box>
                    <CheckboxField
                      label={MESSAGES.withRate(withRate)}
                      checked={onlyWithRate}
                      onChange={setOnlyWithRate}
                    />
                  </Stack>
                  {visibleFreight.length === 0 ? (
                    <EmptyState
                      size="compact"
                      title={MESSAGES.noFreightMatch(search.trim())}
                      action={
                        <Button
                          variant="outlined"
                          onClick={() => {
                            setSearch('');
                            setOnlyWithRate(false);
                          }}
                        >
                          Clear filters
                        </Button>
                      }
                    />
                  ) : (
                    <Box data-testid="freight-grid">
                      <InventoryGrid<FreightRow>
                        columns={FREIGHT_COLUMNS}
                        rows={visibleFreight}
                        height={visibleFreight.length > 12 ? 440 : undefined}
                        initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
                        pageSizeOptions={[25, 50, 100]}
                        disableColumnMenu
                      />
                    </Box>
                  )}
                </Stack>
              )}
            </FormSection>
          </Box>

          <FormSection title="CFS charges" data-testid="cfs">
            {loading ? (
              skeleton(6)
            ) : cfsRows.length === 0 ? (
              <EmptyState size="compact" title={MESSAGES.noCfs} />
            ) : (
              <Box data-testid="cfs-grid">
                <InventoryGrid<CfsRow>
                  columns={CFS_COLUMNS}
                  rows={cfsRows}
                  height={cfsRows.length > 12 ? 520 : undefined}
                  initialState={{ pagination: { paginationModel: { pageSize: 100 } } }}
                  pageSizeOptions={[25, 50, 100]}
                  disableColumnMenu
                  disableVirtualization={cfsRows.length <= 100}
                />
              </Box>
            )}
          </FormSection>
        </Stack>
      )}
    </PageShell>
  );
}
