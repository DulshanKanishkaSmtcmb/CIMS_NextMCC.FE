import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BlockingOverlay,
  Box,
  Button,
  PageHeader,
  SelectField,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableFooter,
  TableHead,
  TableRow,
  TextInput,
  useScanFeedback,
} from '@cims/ui';
import { useLazyGetDcsQuery } from '../../services/masterDataApi';
import {
  useGetOkToLoadReasonsQuery,
  useReplaceOkToLoadReasonsMutation,
  type OkToLoadReason,
} from '../../services/okToLoadReasonApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { COMMON_MESSAGES } from './masterEntry';
import { SectionBox } from './SectionBox';

/** Legacy texts of AppJs/OkToLoadReason.js, word for word. */
const DC_NOT_SELECTED = 'DC not selected';
const LOADED = 'Reasons Data Loaded successfully';
const LOAD_FAILED = 'Something went wrong.Please contact administrator';
const ALLOCATED = 'This Reason is already allocated into Contracts. So not allow to Remove';
/** New: the legacy page saved blank reasons (and hid them on the next load). */
const REASON_REQUIRED = 'Enter Reason';

interface ReasonRow {
  /** Stable key for React; the legacy row number changes when a row is removed. */
  key: number;
  reason: string;
  detail: string;
  /** Loaded from the server: the reason's text is read-only (legacy `readOnly: ReasonOld() !== ''`). */
  stored: boolean;
  /** Contracts of the DC already carry the reason. */
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

/**
 * Shipments Ok To Load / Hold Reasons (legacy /File/OkToLoadReason, CloudMenu 200.25.02): the reasons of one DC, edited as
 * a list (add, remove, detail) and saved as a whole. Same fields, labels, messages and flow as
 * Views/File/OkToLoadReason.cshtml + AppJs/OkToLoadReason.js; write-up in the legacy repo docs/18-wave1-masterdata-d.md.
 */
export function OkToLoadReasonPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();
  const [loadDcs] = useLazyGetDcsQuery();
  const [replace] = useReplaceOkToLoadReasonsMutation();

  const [dcNames, setDcNames] = useState<string[]>([]);
  // The DC the user chose; until one is chosen the select shows the first DC and so does the model (Knockout `value` +
  // `options`), which loads that DC's reasons when the page opens.
  const [chosenDc, setChosenDc] = useState<string | null>(null);
  const dc = chosenDc ?? dcNames[0] ?? '';
  const [rows, setRows] = useState<ReasonRow[]>([]);
  const [busy, setBusy] = useState(true);

  const reasons = useGetOkToLoadReasonsQuery({ dc, checkAllocation: true }, { skip: dc === '' });
  // Rows replaced by what the server returned for the selected DC (adjusting state while rendering, not in an effect).
  const [shown, setShown] = useState<OkToLoadReason[] | null>(null);
  if (reasons.data && reasons.data !== shown && !reasons.isFetching) {
    setShown(reasons.data);
    setRows(fromServer(reasons.data));
  }

  useEffect(() => {
    let active = true;
    void loadDcs().then((result) => {
      if (!active) return;
      if (result.data) setDcNames(result.data.map((d) => d.whDes));
      else feedback.notifyError(COMMON_MESSAGES.noServer);
      setBusy(false);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once, when the page opens
  }, [loadDcs]);

  useEffect(() => {
    if (shown) feedback.notifySuccess(LOADED);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per loaded list
  }, [shown]);

  useEffect(() => {
    if (reasons.isError) feedback.notifyError(LOAD_FAILED);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a load fails
  }, [reasons.isError]);

  const chooseDc = (next: string) => {
    if (next === dc) return;
    setRows([]); // legacy: the list is emptied, then the DC's reasons are loaded
    setShown(null);
    setChosenDc(next);
  };

  const patch = (key: number, change: Partial<ReasonRow>) =>
    setRows((list) => list.map((row) => (row.key === key ? { ...row, ...change } : row)));

  /** Legacy `Ele.EleRemoveClick`: an allocated reason is refused with a toast. */
  const remove = (row: ReasonRow) => {
    if (row.allocated) {
      feedback.notifyError(ALLOCATED);
      return;
    }
    setRows((list) => list.filter((r) => r.key !== row.key));
  };

  /** Legacy `btnSaveData`: the DC must be selected, then the whole list is saved. */
  const save = async () => {
    if (dc === '') {
      feedback.notifyError(DC_NOT_SELECTED);
      return;
    }
    if (rows.some((r) => r.reason.trim() === '')) {
      feedback.notifyError(REASON_REQUIRED);
      return;
    }
    setBusy(true);
    try {
      const result = await replace({
        dc,
        reasons: rows.map((r) => ({ reason: r.reason, dtlReson: r.detail })),
      });
      if ('data' in result && result.data) {
        feedback.notifySuccess(COMMON_MESSAGES.saved);
      } else if ('error' in result) {
        const error = result.error as ApiQueryError;
        if (error.status === undefined) feedback.notifyError(COMMON_MESSAGES.noServer);
        else if (error.status === 409) feedback.notifyError(ALLOCATED);
        else
          feedback.notifyError(COMMON_MESSAGES.notSaved(error.details?.join(' ') ?? error.message));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <PageHeader title="Shipments Ok To Load / Hold Reasons" />
      <BlockingOverlay open={busy || reasons.isFetching} contained message="Loading..." />
      <Stack spacing={2} sx={{ mb: 2 }}>
        <Box sx={{ maxWidth: 360 }}>
          <SelectField label="DC" value={dc} options={dcNames} onChange={chooseDc} />
        </Box>
        <SectionBox title="Reasons Listing">
          <TableContainer sx={{ overflow: 'auto' }}>
            <Table aria-label="Reasons Listing">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ width: 30 }} />
                  <TableCell sx={{ width: 300 }}>Reason</TableCell>
                  <TableCell>Detail Reson</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.key}>
                    <TableCell>
                      <Button
                        size="small"
                        variant="contained"
                        color="error"
                        aria-label="Remove reason"
                        onClick={() => remove(row)}
                      >
                        −
                      </Button>
                    </TableCell>
                    <TableCell>
                      <TextInput
                        ariaLabel="Reason"
                        value={row.reason}
                        readOnly={row.stored}
                        onChange={row.stored ? undefined : (reason) => patch(row.key, { reason })}
                      />
                    </TableCell>
                    <TableCell>
                      <TextInput
                        ariaLabel="Detail Reson"
                        rows={2}
                        value={row.detail}
                        onChange={(detail) => patch(row.key, { detail })}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell>
                    <Button
                      size="small"
                      variant="contained"
                      color="success"
                      aria-label="Add reason"
                      onClick={() =>
                        setRows((list) => [
                          ...list,
                          {
                            key: nextKey++,
                            reason: '',
                            detail: '',
                            stored: false,
                            allocated: false,
                          },
                        ])
                      }
                    >
                      +
                    </Button>
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </TableContainer>
        </SectionBox>
      </Stack>
      <Stack direction="row" spacing={1}>
        <Button variant="contained" color="info" onClick={() => void save()}>
          Save
        </Button>
        <Button variant="contained" color="info" onClick={() => void navigate(PATHS.home)}>
          Close
        </Button>
      </Stack>
    </Box>
  );
}
