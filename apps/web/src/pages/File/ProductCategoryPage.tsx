import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Button,
  EmptyState,
  ErrorState,
  FieldGrid,
  FormSection,
  InlineHint,
  InventoryGrid,
  PageShell,
  SegmentedControl,
  SelectField,
  ShortcutsLegend,
  Stack,
  StatusChip,
  TableSkeleton,
  TextInput,
  useKeyboardShortcuts,
  ValidationSummary,
  type InventoryGridColumn,
  type KeyboardShortcut,
  type ValidationIssue,
} from '@cims/ui';
import {
  useGetChainCodesQuery,
  useGetChainRangesQuery,
  useSaveChainCodeMutation,
  type ChainCode,
} from '../../services/packingMaterialApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { smartMatches } from './masterEntry';
import { classifySaveFailure, SHARED_MESSAGES } from './masterDataPage';
import { PRODUCT_CATEGORY_MESSAGES as MESSAGES } from './productCategoryMessages';

/** A chain code with a row id (the table has no key and nothing stops a repeated code). */
type GridRow = ChainCode & { id: number };

const COLUMNS: InventoryGridColumn<GridRow>[] = [
  { field: 'chainCode', headerName: 'Chain code', width: 110 },
  { field: 'chainName', headerName: 'Chain name', flex: 1, minWidth: 180 },
  { field: 'range', headerName: 'Range', width: 130 },
  { field: 'tpPartnerName', headerName: 'TP partner name', minWidth: 170, flex: 1 },
  { field: 'rangeBoxEan', headerName: 'Range box EAN', width: 150 },
];

interface ChainForm {
  chainCode: string;
  chainName: string;
  tpPartnerName: string;
  rangeBoxEan: string;
}
type Field = keyof ChainForm | 'range';

const EMPTY: ChainForm = { chainCode: '', chainName: '', tpPartnerName: '', rangeBoxEan: '' };

type Result =
  | { kind: 'added'; text: string }
  | { kind: 'failed'; title: string; message: string; details?: string; retry?: boolean };

/**
 * Chain codes (legacy /File/ProductCategory "Product Category", CloudMenu 100.20) on PageShell: an "Add a chain code"
 * form above the list of existing codes (docs/19 sections 3.4 and 14: add-only page). Kept from legacy (docs/17 C):
 * the same calls and body (ranges and chain codes on open, POST {chainCode, chainName, range, tpPartnerName,
 * rangeBoxEan}, the list read again after a save), the checks in the legacy order (code, one character, name, range,
 * TP partner, EAN, then a repeated code against the list, ignoring case), the form cleared after a save except the
 * range, the first range preselected.
 */
export function ProductCategoryPage() {
  const navigate = useNavigate();
  const ranges = useGetChainRangesQuery();
  const codes = useGetChainCodesQuery();
  const [saveChain, saveState] = useSaveChainCodeMutation();

  const [form, setForm] = useState<ChainForm>(EMPTY);
  // The chosen range; until one is chosen the first category is used (legacy LoadDefault).
  const [chosenRange, setRange] = useState<string | null>(null);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [problems, setProblems] = useState<ValidationIssue[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [search, setSearch] = useState('');
  const [exportAsked, setExportAsked] = useState(false);

  const codeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const tpRef = useRef<HTMLInputElement>(null);
  const eanRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const refs: Partial<Record<Field, typeof codeRef>> = {
    chainCode: codeRef,
    chainName: nameRef,
    tpPartnerName: tpRef,
    rangeBoxEan: eanRef,
  };

  const rangeNames = useMemo(() => (ranges.data ?? []).map((r) => r.category), [ranges.data]);
  const range = chosenRange ?? rangeNames[0] ?? '';
  const rows = useMemo(() => codes.data ?? [], [codes.data]);
  const saving = saveState.isLoading;

  const visibleRows = useMemo<GridRow[]>(
    () =>
      rows
        .map((r, id) => ({ ...r, id }))
        .filter((r) =>
          smartMatches(
            [r.chainCode, r.chainName, r.tpPartnerName, r.range, r.rangeBoxEan].join(' '),
            search,
          ),
        ),
    [rows, search],
  );

  const sameCode = (row: ChainCode, code: string) =>
    row.chainCode.trim().toUpperCase() === code.toUpperCase();

  const clearProblem = (field: Field) => {
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
    setProblems((p) => p.filter((i) => i.field !== field));
  };

  const set = (field: keyof ChainForm, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setResult(null);
    if (value.length > 0) clearProblem(field);
  };

  const issue = (field: Field, message: string): ValidationIssue => ({
    field,
    message,
    onSelect: () => refs[field]?.current?.focus(),
  });

  const show = (problem: ValidationIssue) => {
    setErrors({ [problem.field]: problem.message });
    setProblems([problem]);
  };

  /** New, not legacy: a repeated code is said as soon as the code field is left. */
  const checkCode = () => {
    if (form.chainCode.length !== 1) return;
    const match = rows.find((r) => sameCode(r, form.chainCode));
    if (match)
      setErrors((e) => ({ ...e, chainCode: MESSAGES.duplicate(match.chainCode, match.chainName) }));
  };

  /** Legacy `beforeSaveCheking`: the first failing check stops (no request), in the legacy order. */
  const firstProblem = (): ValidationIssue | null => {
    if (form.chainCode === '') return issue('chainCode', MESSAGES.codeRequired);
    if (form.chainCode.length !== 1) return issue('chainCode', MESSAGES.codeLength);
    if (form.chainName === '') return issue('chainName', MESSAGES.nameRequired);
    if (range === '') return issue('range', MESSAGES.rangeRequired);
    if (form.tpPartnerName === '') return issue('tpPartnerName', MESSAGES.tpRequired);
    if (form.rangeBoxEan === '') return issue('rangeBoxEan', MESSAGES.eanRequired);
    const match = rows.find((r) => sameCode(r, form.chainCode));
    if (match) return issue('chainCode', MESSAGES.duplicate(match.chainCode, match.chainName));
    return null;
  };

  const add = async () => {
    if (saving) return;
    setResult(null);
    const problem = firstProblem();
    if (problem) {
      show(problem);
      return;
    }
    setErrors({});
    setProblems([]);
    const values = { ...form, range };
    const reply = await saveChain(values);
    if ('data' in reply && reply.data) {
      setForm(EMPTY);
      setResult({ kind: 'added', text: MESSAGES.added(values.chainCode, values.chainName) });
      codeRef.current?.focus();
      await codes.refetch();
      return;
    }
    if (!('error' in reply)) return;
    const failure = classifySaveFailure(reply.error as ApiQueryError);
    if (failure.kind === 'exists') show(issue('chainCode', MESSAGES.duplicate(values.chainCode)));
    else if (failure.kind === 'noServer')
      setResult({
        kind: 'failed',
        title: SHARED_MESSAGES.noServerTitle,
        message: SHARED_MESSAGES.noServer,
        retry: true,
      });
    else
      setResult({
        kind: 'failed',
        title: SHARED_MESSAGES.notSavedTitle,
        message: SHARED_MESSAGES.notSaved,
        details: failure.kind === 'failed' ? failure.details : undefined,
      });
  };

  const shortcuts: KeyboardShortcut[] = [
    { keys: '/', description: 'Search', handler: () => searchRef.current?.focus() },
    { keys: 'ctrl+s', description: 'Add chain code', handler: () => void add(), enabled: !saving },
  ];
  useKeyboardShortcuts(shortcuts);

  const textField = (
    label: string,
    field: keyof ChainForm,
    maxLength: number,
    onBlur?: () => void,
  ) => (
    <TextInput
      label={label}
      inputRef={refs[field]}
      value={form[field]}
      onChange={(v) => set(field, v)}
      onBlur={onBlur}
      required
      maxLength={maxLength}
      error={!!errors[field]}
      helperText={errors[field]}
    />
  );

  const listBody = codes.isError ? (
    <ErrorState
      title={MESSAGES.loadFailedTitle}
      message={SHARED_MESSAGES.listFailed}
      onRetry={() => void codes.refetch()}
    />
  ) : codes.isLoading ? (
    <TableSkeleton rows={4} columns={5} label="Loading chain codes" />
  ) : rows.length === 0 ? (
    <EmptyState size="compact" title={MESSAGES.emptyTitle} description={MESSAGES.emptyHelp} />
  ) : (
    <Stack spacing={1}>
      <Box sx={{ maxWidth: 360 }}>
        <TextInput
          label="Search chain codes"
          inputRef={searchRef}
          value={search}
          onChange={setSearch}
        />
      </Box>
      {visibleRows.length === 0 ? (
        <EmptyState
          size="compact"
          title={MESSAGES.noMatch(search.trim())}
          action={
            <Button variant="outlined" onClick={() => setSearch('')}>
              Clear search
            </Button>
          }
        />
      ) : (
        <Box data-testid="chain-code-grid">
          <InventoryGrid<GridRow>
            columns={COLUMNS}
            rows={visibleRows}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            pageSizeOptions={[10, 25, 50, 100]}
            disableColumnMenu
            disableVirtualization
          />
        </Box>
      )}
    </Stack>
  );

  return (
    <PageShell
      data-testid="product-category-page"
      title="Chain codes"
      context="File · Product Category"
      secondaryActions={
        <Button variant="text" onClick={() => void navigate(PATHS.home)}>
          Close
        </Button>
      }
      toolbar={<ShortcutsLegend shortcuts={shortcuts} />}
    >
      <Stack spacing={2}>
        <FormSection
          title="Add a chain code"
          description="Every field is needed. A chain code cannot be changed or removed here once added."
          data-testid="add-chain-code"
        >
          {ranges.isError ? <InlineHint tone="error">{MESSAGES.rangesFailed}</InlineHint> : null}
          <ValidationSummary
            issues={problems}
            title={SHARED_MESSAGES.fixBeforeSaving}
            data-testid="save-problems"
          />
          <FieldGrid columns={{ xs: 1, sm: 2, md: 3 }}>
            {textField('Chain code', 'chainCode', 1, checkCode)}
            {textField('Chain name', 'chainName', 50)}
            {rangeNames.length > 0 && rangeNames.length <= 5 ? (
              <SegmentedControl
                label="Range"
                value={range}
                options={rangeNames}
                onChange={(v) => {
                  setRange(v);
                  clearProblem('range');
                }}
                data-testid="range"
              />
            ) : (
              <SelectField
                label="Range"
                value={rangeNames.includes(range) ? range : ''}
                options={rangeNames}
                onChange={(v) => {
                  setRange(v);
                  clearProblem('range');
                }}
                error={!!errors.range}
                helperText={errors.range}
              />
            )}
            {textField('TP partner name', 'tpPartnerName', 20)}
            {textField('Range box EAN', 'rangeBoxEan', 10)}
          </FieldGrid>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            justifyContent="space-between"
          >
            <Box sx={{ minWidth: 0 }}>
              {result?.kind === 'added' ? (
                <InlineHint tone="success" live data-testid="save-result">
                  {result.text}
                </InlineHint>
              ) : null}
            </Box>
            <Button
              variant="contained"
              onClick={() => void add()}
              disabled={saving}
              sx={(t) => ({ minHeight: t.cims.density.touchTarget - 4, flex: 'none' })}
            >
              {saving ? 'Adding…' : 'Add chain code'}
            </Button>
          </Stack>
          {result?.kind === 'failed' ? (
            <ErrorState
              data-testid="detail-error"
              title={result.title}
              message={result.message}
              details={result.details}
              onRetry={result.retry ? () => void add() : undefined}
              onClose={() => setResult(null)}
            />
          ) : null}
        </FormSection>

        <FormSection
          title="Existing chain codes"
          status={
            codes.data ? (
              <StatusChip tone="neutral" label={`${rows.length} codes`} data-testid="code-count" />
            ) : undefined
          }
          actions={
            <Button variant="outlined" onClick={() => setExportAsked(true)}>
              Export
            </Button>
          }
          data-testid="chain-code-list"
        >
          {exportAsked ? (
            <InlineHint tone="info" live data-testid="export-hint">
              {MESSAGES.exportNotAvailable}
            </InlineHint>
          ) : null}
          {listBody}
        </FormSection>
      </Stack>
    </PageShell>
  );
}
