import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import {
  DataGrid,
  type DataGridProps,
  type GridColDef,
  type GridValidRowModel,
} from '@mui/x-data-grid';

declare module '@mui/x-data-grid' {
  interface NoRowsOverlayPropsOverrides {
    message?: string;
  }
}

function EmptyOverlay({ message }: { message?: string }) {
  return (
    <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
      <Typography variant="body2" color="text.secondary">
        {message}
      </Typography>
    </Box>
  );
}

export type InventoryGridProps<R extends GridValidRowModel = GridValidRowModel> = Omit<
  DataGridProps<R>,
  'columns' | 'density' | 'autoHeight'
> & {
  columns: readonly GridColDef<R>[];
  /** Fixed grid height. Omit to size the grid to its rows. */
  height?: number | string;
  /** Text shown when there are no rows. Default "No records". */
  emptyMessage?: string;
  /** Props applied to every column unless the column sets its own. */
  defaultColumn?: Partial<GridColDef<R>>;
};

const BASE_DEFAULT_COLUMN = { flex: 1, minWidth: 120, sortable: true, filterable: true } as const;

/**
 * Standard grid for warehouse screens: dense rows, sensible column defaults, loading and empty states.
 * Community features only (no Pro or Premium props).
 */
export function InventoryGrid<R extends GridValidRowModel = GridValidRowModel>({
  columns,
  height,
  emptyMessage = 'No records',
  defaultColumn,
  slots,
  slotProps,
  pageSizeOptions = [10, 25, 50, 100],
  initialState,
  ...rest
}: InventoryGridProps<R>) {
  const resolvedColumns = useMemo(
    () =>
      columns.map((column) => {
        // A fixed width wins over the default flex sizing.
        const base: Partial<GridColDef<R>> =
          column.width !== undefined
            ? { ...BASE_DEFAULT_COLUMN, ...defaultColumn, flex: undefined }
            : { ...BASE_DEFAULT_COLUMN, ...defaultColumn };
        return { ...base, ...column } as GridColDef<R>;
      }),
    [columns, defaultColumn],
  );

  return (
    <Box sx={{ width: '100%', height }}>
      <DataGrid<R>
        density="compact"
        autoHeight={height === undefined}
        disableRowSelectionOnClick
        hideFooterSelectedRowCount
        pageSizeOptions={pageSizeOptions}
        initialState={{
          pagination: { paginationModel: { pageSize: 25 } },
          ...initialState,
        }}
        {...rest}
        columns={resolvedColumns}
        slots={{ noRowsOverlay: EmptyOverlay, ...slots }}
        slotProps={{
          loadingOverlay: { variant: 'linear-progress', noRowsVariant: 'linear-progress' },
          noRowsOverlay: { message: emptyMessage },
          ...slotProps,
        }}
      />
    </Box>
  );
}
