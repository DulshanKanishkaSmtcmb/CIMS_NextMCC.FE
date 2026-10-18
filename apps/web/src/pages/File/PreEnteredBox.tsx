import { useState } from 'react';
import { Box, Button, InventoryGrid, Paper, Stack, Typography } from '@cims/ui';
import type { InventoryGridColumn } from '@cims/ui';

export interface PreEnteredBoxProps<R extends object> {
  /** Box heading, e.g. "Pre-Entered Ports Listing". */
  heading: string;
  columns: readonly InventoryGridColumn<R>[];
  rows: readonly R[];
  getRowId: (row: R) => string;
}

/**
 * The "Pre-Entered ... Listing" box under the name field in New mode (legacy `LoadPreviousData` /
 * `TblBoxFromAjaxCall`, element id `PData`, table `tblPdata`): the existing records whose name starts with what was
 * typed, so a duplicate is noticed before saving. A collapse button, like the AdminLTE box tool it had.
 */
export function PreEnteredBox<R extends object>({
  heading,
  columns,
  rows,
  getRowId,
}: PreEnteredBoxProps<R>) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Paper sx={{ p: 2 }} id="PData">
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" component="h2">
          {heading}
        </Typography>
        <Button
          size="small"
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? '+' : '−'}
        </Button>
      </Stack>
      {collapsed ? null : (
        <Box id="tblPdata" sx={{ mt: 1 }}>
          <InventoryGrid<R>
            columns={columns}
            rows={[...rows]}
            getRowId={getRowId}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            disableColumnMenu
            disableVirtualization
          />
        </Box>
      )}
    </Paper>
  );
}
