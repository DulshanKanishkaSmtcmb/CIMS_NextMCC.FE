import { useId, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import { InventoryGrid, type InventoryGridProps } from './InventoryGrid';
import { lookupCellText, type LookupColumnKind } from './lookupText';

export interface LookupColumn {
  field: string;
  headerName: string;
  /** Default "text". `date` shows dd/MM/yyyy; `dateTime` shows dd/MM/yyyy and adds HH:mm unless it is midnight. */
  kind?: LookupColumnKind;
  width?: number;
}

export interface LookupDialogProps<R extends object> {
  open: boolean;
  /** Dialog heading, e.g. "Countries Listing". */
  title: string;
  columns: readonly LookupColumn[];
  rows: readonly R[];
  /** Called with the row whose Select button was clicked. The dialog does not close itself. */
  onSelect: (row: R) => void;
  onClose: () => void;
  /** Stable row id. Default: the row's index in `rows`. */
  getRowId?: (row: R) => string | number;
}

type Cells = Record<string, unknown>;

/**
 * Modal list of records with a Select button on every row and a search box per column (legacy `GetApiDataForDialogBox`
 * + `LoadListDialog`: a Bootstrap modal with a DataTable). Sorted by the first column, 10 rows per page; the search
 * boxes match the displayed text, case-insensitively, anywhere in the cell.
 */
export function LookupDialog<R extends object>({
  open,
  title,
  columns,
  rows,
  onSelect,
  onClose,
  getRowId,
}: LookupDialogProps<R>) {
  const titleId = useId();
  const [filters, setFilters] = useState<Record<string, string>>({});

  const items = useMemo(
    () => rows.map((row, index) => ({ row, id: getRowId ? getRowId(row) : index })),
    [rows, getRowId],
  );

  const visible = useMemo(() => {
    const active = columns.filter((c) => (filters[c.field] ?? '').trim() !== '');
    if (active.length === 0) return items;
    return items.filter(({ row }) =>
      active.every((c) =>
        lookupCellText((row as Cells)[c.field], c.kind)
          .toLowerCase()
          .includes((filters[c.field] ?? '').trim().toLowerCase()),
      ),
    );
  }, [items, columns, filters]);

  type Item = (typeof items)[number];
  const gridColumns: InventoryGridProps<Item>['columns'] = useMemo(
    () => [
      {
        field: '__select',
        headerName: '',
        width: 100,
        sortable: false,
        filterable: false,
        disableColumnMenu: true,
        renderCell: ({ row }: { row: Item }) => (
          <Button
            size="small"
            variant="contained"
            color="info"
            className="btn-select"
            onClick={() => onSelect(row.row)}
          >
            Select
          </Button>
        ),
      },
      ...columns.map((c) => {
        const kind = c.kind ?? 'text';
        return {
          field: c.field,
          headerName: c.headerName,
          width: c.width ?? (kind === 'text' ? 180 : 130),
          type: kind === 'number' ? ('number' as const) : ('string' as const),
          valueGetter: (_: unknown, item: Item) => (item.row as Cells)[c.field],
          valueFormatter: (value: unknown) => lookupCellText(value, kind),
          filterable: false,
        };
      }),
    ],
    [columns, onSelect],
  );

  const first = columns[0]?.field;

  return (
    <Dialog open={open} onClose={onClose} aria-labelledby={titleId} maxWidth="lg" fullWidth>
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        <Stack direction="row" useFlexGap flexWrap="wrap" spacing={1} sx={{ py: 1 }}>
          {columns.map((c) => (
            <TextField
              key={c.field}
              size="small"
              placeholder={`Search ${c.headerName}`}
              value={filters[c.field] ?? ''}
              onChange={(event) => setFilters((f) => ({ ...f, [c.field]: event.target.value }))}
              slotProps={{ htmlInput: { 'aria-label': `Search ${c.headerName}` } }}
              sx={{ width: 150 }}
            />
          ))}
        </Stack>
        <InventoryGrid<Item>
          columns={gridColumns}
          rows={visible}
          getRowId={(item) => item.id}
          initialState={{
            pagination: { paginationModel: { pageSize: 10 } },
            sorting: first ? { sortModel: [{ field: first, sort: 'asc' }] } : undefined,
          }}
          disableColumnFilter
          disableVirtualization
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
