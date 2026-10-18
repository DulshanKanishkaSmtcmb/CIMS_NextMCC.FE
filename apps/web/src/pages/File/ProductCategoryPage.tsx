import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BlockingOverlay,
  Box,
  Button,
  InventoryGrid,
  PageHeader,
  Paper,
  SelectField,
  Stack,
  TextInput,
  useScanFeedback,
  type InventoryGridColumn,
} from '@cims/ui';
import {
  useGetChainCodesQuery,
  useGetChainRangesQuery,
  useSaveChainCodeMutation,
  type ChainCode,
} from '../../services/packingMaterialApi';
import type { ApiQueryError } from '../../services/axiosBaseQuery';
import { PATHS } from '../../routes/paths';
import { COMMON_MESSAGES, saveFailureText, smartMatches, type EntryMessages } from './masterEntry';

/** Legacy texts of AppJs/ProductCategory.js, word for word. */
const CODE_REQUIRED = 'Can not be empty Chain Code';
const CODE_LENGTH = 'Chain Code must be exactly 1 character long';
const NAME_REQUIRED = 'Can not be empty Chain Name';
const RANGE_REQUIRED = 'Can not be empty Range';
const TP_REQUIRED = 'Can not be empty TP Partner Name';
const EAN_REQUIRED = 'Can not be empty Range Box EAN';
const DUPLICATE = 'Can not Duplicate same Chain Code';
const LOAD_FAILED = 'Error Loading PM Category Data';
const MESSAGES: EntryMessages = {
  alreadyExists: DUPLICATE,
  doesNotExist: DUPLICATE,
  checkFailed: LOAD_FAILED,
};

/** A chain code with a row id (the table has no key and nothing stops a repeated code). */
type GridRow = ChainCode & { id: number };

/** The grid of the legacy page (`LoadjqDatatable`, table `dtStuffingSum`): titles as in `arrSumCol`, no sorting. */
const COLUMNS: InventoryGridColumn<GridRow>[] = [
  { field: 'chainCode', headerName: 'Chain Code', sortable: false },
  { field: 'chainName', headerName: 'Chain Name', sortable: false },
  { field: 'tpPartnerName', headerName: 'TP Partner Name', sortable: false },
  { field: 'range', headerName: 'Range', sortable: false },
  { field: 'rangeBoxEan', headerName: 'Range Box EAN', sortable: false },
];

/** The DataTables Buttons row of the legacy grid. Stubs: the exports are not ported yet. */
const EXPORT_BUTTONS = ['Copy', 'CSV', 'Excel', 'PDF', 'Print'] as const;

/**
 * Product Category (legacy /File/ProductCategory, CloudMenu 100.20): adds a contract chain code and lists the existing
 * ones. Same field order, labels, element ids (the Chain Code input has the legacy id PMDescription), messages and flow as
 * Views/File/ProductCategory.cshtml + AppJs/ProductCategory.js; write-up in the legacy repo docs/17-wave1-masterdata-c.md.
 */
export function ProductCategoryPage() {
  const navigate = useNavigate();
  const feedback = useScanFeedback();

  const [chainCode, setChainCode] = useState('');
  const [chainName, setChainName] = useState('');
  // The chosen range; until one is chosen the select shows the first category (legacy LoadDefault).
  const [chosenRange, setRange] = useState<string | null>(null);
  const [tpPartnerName, setTpPartnerName] = useState('');
  const [rangeBoxEan, setRangeBoxEan] = useState('');
  const [saveEnabled, setSaveEnabled] = useState(true);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');

  const ranges = useGetChainRangesQuery();
  const codes = useGetChainCodesQuery();
  const [saveChain] = useSaveChainCodeMutation();

  const rangeNames = (ranges.data ?? []).map((r) => r.category);
  const range = chosenRange ?? rangeNames[0] ?? '';
  const rows = useMemo(() => codes.data ?? [], [codes.data]);

  useEffect(() => {
    if (ranges.isError || codes.isError) feedback.notifyError(LOAD_FAILED);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when a load fails
  }, [ranges.isError, codes.isError]);

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

  /** Legacy `beforeSaveCheking`: the checks in order, then the save; the grid is reloaded afterwards. */
  const save = async () => {
    setSaveEnabled(false);
    const refuse = (message: string) => {
      feedback.notifyError(message);
      setSaveEnabled(true);
    };
    if (chainCode === '') return refuse(CODE_REQUIRED);
    if (chainCode.length !== 1) return refuse(CODE_LENGTH);
    if (chainName === '') return refuse(NAME_REQUIRED);
    if (range === '') return refuse(RANGE_REQUIRED);
    if (tpPartnerName === '') return refuse(TP_REQUIRED);
    if (rangeBoxEan === '') return refuse(EAN_REQUIRED);
    if (rows.some((r) => r.chainCode.trim().toUpperCase() === chainCode.toUpperCase())) {
      return refuse(DUPLICATE);
    }

    setBusy(true);
    try {
      const result = await saveChain({ chainCode, chainName, range, tpPartnerName, rangeBoxEan });
      if ('data' in result && result.data) {
        setChainCode('');
        setChainName('');
        setTpPartnerName('');
        setRangeBoxEan('');
        setSaveEnabled(true);
        feedback.notifySuccess(COMMON_MESSAGES.saved);
        await codes.refetch();
      } else if ('error' in result) {
        refuse(saveFailureText(result.error as ApiQueryError, MESSAGES));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ position: 'relative' }}>
      <PageHeader title="Product Category" />
      <BlockingOverlay open={busy} contained message="Saving..." />
      <Paper sx={{ p: 2, mb: 2 }}>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <Box sx={{ width: 180 }}>
              <TextInput
                id="PMDescription"
                label="Chain Code"
                value={chainCode}
                onChange={setChainCode}
              />
            </Box>
            <Box sx={{ width: 260 }}>
              <TextInput label="Chain Name" value={chainName} onChange={setChainName} />
            </Box>
            <Box sx={{ width: 200 }}>
              <SelectField
                label="Range"
                value={rangeNames.includes(range) ? range : ''}
                options={rangeNames}
                onChange={setRange}
              />
            </Box>
            <Box sx={{ width: 200 }}>
              <TextInput
                label="TP Partner Name"
                value={tpPartnerName}
                onChange={setTpPartnerName}
              />
            </Box>
            <Box sx={{ width: 200 }}>
              <TextInput label="Range Box EAN" value={rangeBoxEan} onChange={setRangeBoxEan} />
            </Box>
          </Box>
          {rows.length > 0 ? (
            <Box id="divDtlRowsSum">
              <Stack direction="row" spacing={1} sx={{ mb: 1 }}>
                {EXPORT_BUTTONS.map((name) => (
                  <Button
                    key={name}
                    size="small"
                    variant="outlined"
                    onClick={() => feedback.notifyWarning(`${name} export is not available yet`)}
                  >
                    {name}
                  </Button>
                ))}
              </Stack>
              <Box sx={{ maxWidth: 280, mb: 1 }}>
                <TextInput label="Search:" value={search} onChange={setSearch} />
              </Box>
              <Box id="dtStuffingSum">
                <InventoryGrid<GridRow>
                  columns={COLUMNS}
                  rows={visibleRows}
                  initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
                  disableColumnMenu
                  disableVirtualization
                />
              </Box>
            </Box>
          ) : null}
        </Stack>
      </Paper>
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          color="info"
          onClick={() => void save()}
          disabled={!saveEnabled}
        >
          Save
        </Button>
        <Button variant="contained" color="info" onClick={() => void navigate(PATHS.home)}>
          Close
        </Button>
      </Stack>
    </Box>
  );
}
