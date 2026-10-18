import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import type { FieldGridColumns } from './FieldGrid';

export interface PropertyItem {
  label: string;
  value: ReactNode;
}

export interface PropertyListProps {
  items: readonly PropertyItem[];
  /** Accessible name of the list ("Settings maintained in other screens"). */
  label?: string;
  /** Columns per breakpoint. Default { xs: 1, sm: 2, lg: 3 }. */
  columns?: FieldGridColumns;
  'data-testid'?: string;
}

function templateFor(columns: FieldGridColumns) {
  const toTemplate = (n: number) => `repeat(${n}, minmax(0, 1fr))`;
  if (typeof columns === 'number') return toTemplate(columns);
  return Object.fromEntries(Object.entries(columns).map(([bp, n]) => [bp, toTemplate(n)]));
}

/**
 * Read-only properties of a record as an aligned description list: label left, value right, one row per property,
 * in responsive columns. For many reference values (a DC's label settings, record history); a few key figures
 * belong in StatGroup instead.
 */
export function PropertyList({
  items,
  label,
  columns = { xs: 1, sm: 2, lg: 3 },
  'data-testid': testId,
}: PropertyListProps) {
  return (
    <Box
      component="dl"
      aria-label={label}
      data-testid={testId}
      sx={{
        m: 0,
        display: 'grid',
        columnGap: 3,
        gridTemplateColumns: templateFor(columns),
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 1,
            py: 0.5,
            borderBottom: 1,
            borderColor: 'divider',
            minWidth: 0,
            typography: 'body2',
          }}
        >
          <Box component="dt" sx={{ color: 'text.secondary' }}>
            {item.label}
          </Box>
          <Box
            component="dd"
            sx={{ m: 0, fontWeight: 600, textAlign: 'right', overflowWrap: 'anywhere' }}
          >
            {item.value}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
