import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ActionBar,
  Box,
  Button,
  ConfirmDialog,
  EmptyState,
  ErrorState,
  FormSection,
  InlineHint,
  PageShell,
  SelectField,
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
  Typography,
  useKeyboardShortcuts,
  type KeyboardShortcut,
} from '@cims/ui';
import { useLazyGetDcsQuery } from '../../services/masterDataApi';
import {
  useGetOkToLoadReasonsQuery,
  useReplaceOkToLoadReasonsMutation,
  type OkToLoadReason,
} from '../../services/okToLoadReasonApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { classifySaveFailure, SHARED_MESSAGES } from './masterDataPage';
import { OK_TO_LOAD_MESSAGES as MESSAGES } from './okToLoadReasonMessages';

interface ReasonRow {
  /** Stable key for React; the legacy row number changes when a row is removed. */
  key: number;
  reason: string;
  detail: string;
  /** Saved on the server: the reason's text is read-only (legacy `readOnly: ReasonOld() !== ''`). */
  stored: boolean;
  /** Contracts of the DC already carry the reason: it cannot be removed. */
  allocated: boolean;
}

let nextKey = 0;

const fromServer = (rows: OkToLoadReason[]): ReasonRow[] =>
  // legacy: only reasons with a text are shown
  rows
    .filter((r) => r.reason !== '')
    .map((r) => ({
      key: nextKey++,
      reason: r.reason,
      detail: r.dtlReson,
      stored: true,
      allocated: r.isAllocated,
    }));

/** What changed against the list as loaded (or last saved). */
function changes(rows: ReasonRow[], baseline: ReasonRow[]) {
  const keys = new Set(rows.map((r) => r.key));
  const before = new Map(baseline.map((r) => [r.key, r]));
  const added = rows.filter((r) => !before.has(r.key)).length;
  const removed = baseline.filter((r) => !keys.has(r.key)).length;
  const changed = rows.filter((r) => {
    const old = before.get(r.key);
    return old && (old.reason !== r.reason || old.detail !== r.detail);
  }).length;
  const reordered = added === 0 && removed === 0 && rows.some((r, i) => baseline[i]?.key !== r.key);
  return { added, removed, changed, dirty: added + removed + changed > 0 || reordered };
}

type Pending = { kind: 'dc'; dc: string } | { kind: 'close' } | null;
type SaveResult =
  | { kind: 'saved'; text: string }
  | { kind: 'failed'; title: string; message: string; details?: string; retry?: boolean };

/**
 * OK-to-load / hold reasons (legacy /File/OkToLoadReason "Shipments Ok To Load / Hold Reasons", CloudMenu 200.25.02)
 * as a table editor on PageShell (docs/19 section 3.4): choose the DC, edit its reasons, save the whole list. Kept
 * from legacy (docs/18 C): the same calls and body (DCs on open, the first DC selected and its reasons read with the
 * allocation check, PUT {dc, reasons: [{reason, dtlReson}]} with every row in order), stored reasons keep their text,
 * allocated reasons cannot be removed, blank reasons are not shown, a DC must be chosen.
 */
export function OkToLoadReasonPage() {
  const navigate = useNavigate();
  const [loadDcs] = useLazyGetDcsQuery();
  const [replace, replaceState] = useReplaceOkToLoadReasonsMutation();

  const [dcNames, setDcNames] = useState<string[] | null>(null);
  const [dcsFailed, setDcsFailed] = useState(false);
  // The DC the user chose; until one is chosen the first DC is used (Knockout `value` + `options`), which loads that
  // DC's reasons when the page opens.
  const [chosenDc, setChosenDc] = useState<string | null>(null);
  const dc = chosenDc ?? dcNames?.[0] ?? '';
  const [rows, setRows] = useState<ReasonRow[]>([]);
  const [baseline, setBaseline] = useState<ReasonRow[]>([]);
  const [blankKeys, setBlankKeys] = useState<Set<number>>(new Set());
  const [lastRemoved, setLastRemoved] = useState<{ row: ReasonRow; index: number } | null>(null);
  const [pending, setPending] = useState<Pending>(null);
  const [result, setResult] = useState<SaveResult | null>(null);
  const reasonRefs = useRef(new Map<number, HTMLInputElement | null>());
  const [focusKey, setFocusKey] = useState<number | null>(null);

  const reasons = useGetOkToLoadReasonsQuery({ dc, checkAllocation: true }, { skip: dc === '' });
  // Rows replaced by what the server returned for the selected DC (adjusting state while rendering, not in an effect).
  const [shown, setShown] = useState<OkToLoadReason[] | null>(null);
  if (reasons.data && reasons.data !== shown && !reasons.isFetching) {
    const loaded = fromServer(reasons.data);
    setShown(reasons.data);
    setRows(loaded);
    setBaseline(loaded);
    setLastRemoved(null);
    setBlankKeys(new Set());
  }

  const loadDcList = () =>
    loadDcs().then((result) => {
      if (result.data && !result.error) {
        setDcNames(result.data.map((d) => d.whDes));
        setDcsFailed(false);
      } else {
        setDcsFailed(true);
      }
    });

  useEffect(() => {
    void loadDcList();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the page opens
  }, []);

  useEffect(() => {
    if (focusKey === null) return;
    reasonRefs.current.get(focusKey)?.focus();
  }, [focusKey]);

  const diff = changes(rows, baseline);
  const saving = replaceState.isLoading;

  // Closing or reloading the tab with unsaved changes asks the browser's own question.
  useEffect(() => {
    if (!diff.dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [diff.dirty]);

  const switchDc = (next: string) => {
    setRows([]); // legacy: the list is emptied, then the DC's reasons are loaded
    setBaseline([]);
    setShown(null);
    setResult(null);
    setLastRemoved(null);
    setBlankKeys(new Set());
    setChosenDc(next);
  };

  /** Legacy: a DC change discarded the edits without asking; now it asks when there are unsaved changes. */
  const chooseDc = (next: string) => {
    if (next === dc) return;
    if (diff.dirty) setPending({ kind: 'dc', dc: next });
    else switchDc(next);
  };

  const close = () => {
    if (diff.dirty) setPending({ kind: 'close' });
    else void navigate(PATHS.home);
  };

  const patch = (key: number, change: Partial<ReasonRow>) => {
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...change } : row)));
    setResult(null);
    if (change.reason) {
      setBlankKeys((keys) => {
        if (!keys.has(key)) return keys;
        const next = new Set(keys);
        next.delete(key);
        return next;
      });
    }
  };

  const addRow = () => {
    const row: ReasonRow = {
      key: nextKey++,
      reason: '',
      detail: '',
      stored: false,
      allocated: false,
    };
    setRows((list) => [...list, row]);
    setResult(null);
    setFocusKey(row.key);
  };

  /** Legacy `Ele.EleRemoveClick`; an allocated reason has no remove button (legacy refused it with a toast). */
  const remove = (row: ReasonRow) => {
    if (row.allocated) return;
    const index = rows.findIndex((r) => r.key === row.key);
    setRows((list) => list.filter((r) => r.key !== row.key));
    setLastRemoved({ row, index });
    setResult(null);
  };

  const undoRemove = () => {
    if (!lastRemoved) return;
    setRows((list) => {
      const next = [...list];
      next.splice(Math.min(lastRemoved.index, next.length), 0, lastRemoved.row);
      return next;
    });
    setLastRemoved(null);
  };

  /** Legacy `btnSaveData`: the DC must be chosen, then the whole list is saved in its order. */
  const save = async () => {
    if (saving) return;
    setResult(null);
    if (dc === '') {
      setResult({ kind: 'failed', title: MESSAGES.dcNotSelected, message: '' });
      return;
    }
    const blanks = rows.filter((r) => r.reason.trim() === '');
    if (blanks.length > 0) {
      setBlankKeys(new Set(blanks.map((r) => r.key)));
      setFocusKey(null);
      reasonRefs.current.get(blanks[0].key)?.focus();
      return;
    }
    const reply = await replace({
      dc,
      reasons: rows.map((r) => ({ reason: r.reason, dtlReson: r.detail })),
    });
    if ('data' in reply && reply.data) {
      // The list is not read again (legacy); the saved rows are now stored ones.
      const saved = rows.map((r) => ({ ...r, stored: true }));
      setRows(saved);
      setBaseline(saved);
      setLastRemoved(null);
      setResult({ kind: 'saved', text: MESSAGES.saved(dc, rows.length) });
      return;
    }
    if (!('error' in reply)) return;
    const failure = classifySaveFailure(reply.error as ApiQueryError);
    if (failure.kind === 'noServer') {
      setResult({
        kind: 'failed',
        title: SHARED_MESSAGES.noServerTitle,
        message: SHARED_MESSAGES.noServer,
        retry: true,
      });
    } else if (failure.kind === 'exists') {
      setResult({
        kind: 'failed',
        title: SHARED_MESSAGES.notSavedTitle,
        message: MESSAGES.allocatedRefused,
      });
    } else {
      setResult({
        kind: 'failed',
        title: SHARED_MESSAGES.notSavedTitle,
        message: SHARED_MESSAGES.notSaved,
        details:
          failure.kind === 'failed'
            ? failure.details
            : (reply.error as ApiQueryError).details?.join(' '),
      });
    }
  };

  const shortcuts: KeyboardShortcut[] = [
    { keys: 'alt+r', description: 'Add reason', handler: addRow, enabled: dc !== '' && !saving },
    { keys: 'ctrl+s', description: 'Save', handler: () => void save(), enabled: !saving },
  ];
  useKeyboardShortcuts(shortcuts);

  const table = (
    <TableContainer sx={{ overflowX: 'auto' }}>
      <Table aria-label="Reasons" data-testid="reasons-table">
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: 48 }}>No</TableCell>
            <TableCell sx={{ width: { md: '34%' } }}>Reason</TableCell>
            <TableCell>Details</TableCell>
            <TableCell sx={{ width: 120 }}>
              <span className="visually-hidden">Actions</span>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {rows.map((row, i) => {
            const label = row.reason || `new reason ${i + 1}`;
            return (
              <TableRow key={row.key} data-testid="reason-row">
                <TableCell sx={{ verticalAlign: 'top', pt: 2.5 }}>{i + 1}</TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>
                  <Stack spacing={0.5}>
                    <TextInput
                      ariaLabel={`Reason ${i + 1}`}
                      inputRef={(el) => {
                        reasonRefs.current.set(row.key, el);
                      }}
                      value={row.reason}
                      readOnly={row.stored}
                      onChange={row.stored ? undefined : (reason) => patch(row.key, { reason })}
                      maxLength={50}
                      error={blankKeys.has(row.key)}
                      helperText={blankKeys.has(row.key) ? MESSAGES.enterReason : undefined}
                    />
                    {row.allocated ? (
                      <Box>
                        <StatusChip tone="info" label={MESSAGES.allocatedChip} />
                      </Box>
                    ) : null}
                  </Stack>
                </TableCell>
                <TableCell sx={{ verticalAlign: 'top' }}>
                  <TextInput
                    ariaLabel={`Details ${i + 1}`}
                    rows={2}
                    value={row.detail}
                    onChange={(detail) => patch(row.key, { detail })}
                    maxLength={1000}
                  />
                </TableCell>
                <TableCell sx={{ verticalAlign: 'top', pt: 1.5 }}>
                  {row.allocated ? (
                    <Typography variant="caption" color="text.secondary">
                      {MESSAGES.allocated}
                    </Typography>
                  ) : (
                    <Button
                      variant="text"
                      color="error"
                      onClick={() => remove(row)}
                      aria-label={`Remove ${label}`}
                    >
                      Remove
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
          <TableRow>
            <TableCell colSpan={4}>
              <Button variant="outlined" onClick={addRow} disabled={dc === ''}>
                Add reason
              </Button>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );

  const reasonsBody = reasons.isError ? (
    <ErrorState
      title={MESSAGES.loadFailedTitle}
      message={SHARED_MESSAGES.listFailed}
      onRetry={() => void reasons.refetch()}
    />
  ) : dc === '' ? (
    <EmptyState size="compact" title={MESSAGES.noDcTitle} description={MESSAGES.noDcHelp} />
  ) : reasons.isFetching && rows.length === 0 ? (
    <TableSkeleton rows={3} columns={3} label="Loading reasons" />
  ) : (
    <Stack spacing={1.5}>
      {rows.length === 0 ? (
        <EmptyState
          size="compact"
          title={MESSAGES.emptyTitle(dc)}
          description={MESSAGES.emptyHelp}
        />
      ) : null}
      {table}
      {lastRemoved ? (
        <InlineHint tone="info" live data-testid="removed-hint">
          {MESSAGES.removed(lastRemoved.row.reason)}{' '}
          <Button size="small" onClick={undoRemove}>
            Undo
          </Button>
        </InlineHint>
      ) : null}
    </Stack>
  );

  const blankCount = blankKeys.size;
  const summary = MESSAGES.unsaved(diff.added, diff.removed, diff.changed);

  return (
    <PageShell
      data-testid="ok-to-load-reason-page"
      title="OK-to-load and hold reasons"
      context="Loading approvals"
      secondaryActions={
        <Button variant="text" onClick={close}>
          Close
        </Button>
      }
      toolbar={<ShortcutsLegend shortcuts={shortcuts} />}
      footer={
        <ActionBar
          label="Save reasons"
          message={
            result?.kind === 'failed' && result.message ? (
              <ErrorState
                data-testid="save-error"
                title={result.title}
                message={result.message}
                details={result.details}
                onRetry={result.retry ? () => void save() : undefined}
                onClose={() => setResult(null)}
              />
            ) : null
          }
          start={
            result?.kind === 'saved' ? (
              <InlineHint tone="success" live data-testid="save-result">
                {result.text}
              </InlineHint>
            ) : result?.kind === 'failed' && !result.message ? (
              <InlineHint tone="error" data-testid="save-problem">
                {result.title}
              </InlineHint>
            ) : blankCount > 0 ? (
              <InlineHint tone="error" data-testid="save-problem">
                {MESSAGES.blankReasons(blankCount)}
              </InlineHint>
            ) : diff.dirty ? (
              <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
                <StatusChip tone="warning" label="Unsaved changes" />
                <Typography variant="body2" color="text.secondary" data-testid="change-summary">
                  {summary}
                </Typography>
              </Stack>
            ) : null
          }
        >
          <Button variant="contained" onClick={() => void save()} disabled={saving}>
            {saving ? 'Saving…' : 'Save reasons'}
          </Button>
        </ActionBar>
      }
    >
      <Stack spacing={2}>
        <FormSection title="Choose the DC" step={1}>
          {dcsFailed ? (
            <ErrorState
              title={MESSAGES.dcsFailedTitle}
              message={SHARED_MESSAGES.listFailed}
              onRetry={() => void loadDcList()}
            />
          ) : (
            <Box sx={{ maxWidth: 420 }}>
              <SelectField
                label="DC"
                value={dcNames?.includes(dc) ? dc : ''}
                options={dcNames ?? []}
                onChange={chooseDc}
                disabled={dcNames === null}
              />
            </Box>
          )}
        </FormSection>
        <FormSection
          title="Reasons"
          step={2}
          description={rows.some((r) => r.stored) ? MESSAGES.readOnlyHelp : undefined}
          status={
            shown && dc !== '' ? (
              <StatusChip
                tone="neutral"
                label={MESSAGES.count(rows.length)}
                data-testid="reason-count"
              />
            ) : undefined
          }
          data-testid="reasons-section"
        >
          {reasonsBody}
        </FormSection>
      </Stack>
      <ConfirmDialog
        open={pending !== null}
        destructive
        title="Discard unsaved changes?"
        message={`Your changes to the reasons of ${dc} have not been saved and will be lost.`}
        confirmLabel="Discard changes"
        cancelLabel="Keep editing"
        onCancel={() => setPending(null)}
        onConfirm={() => {
          const next = pending;
          setPending(null);
          if (next?.kind === 'dc') switchDc(next.dc);
          else if (next?.kind === 'close') void navigate(PATHS.home);
        }}
      />
    </PageShell>
  );
}
