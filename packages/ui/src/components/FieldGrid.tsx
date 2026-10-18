import type { ReactNode } from 'react';
import Box from '@mui/material/Box';

type Breakpoint = 'xs' | 'sm' | 'md' | 'lg' | 'xl';
export type FieldGridColumns = number | Partial<Record<Breakpoint, number>>;

export interface FieldGridProps {
  /** Columns per breakpoint. Default { xs: 1, sm: 2, md: 3 }: one column on phones, more on wider screens. */
  columns?: FieldGridColumns;
  /** Gap in spacing units. Default 2. */
  gap?: number;
  /** Align items to the end of their row (buttons next to fields). Default stretch. */
  alignItems?: 'stretch' | 'start' | 'end' | 'center';
  children: ReactNode;
  'data-testid'?: string;
}

function templateFor(columns: FieldGridColumns) {
  const toTemplate = (n: number) => `repeat(${n}, minmax(0, 1fr))`;
  if (typeof columns === 'number') return toTemplate(columns);
  return Object.fromEntries(Object.entries(columns).map(([bp, n]) => [bp, toTemplate(n)]));
}

/**
 * Responsive grid for form fields: equal columns, consistent gaps, DOM order = reading order = tab order.
 * Use FieldGridItem to let a field span several columns.
 */
export function FieldGrid({
  columns = { xs: 1, sm: 2, md: 3 },
  gap = 2,
  alignItems = 'start',
  children,
  'data-testid': testId,
}: FieldGridProps) {
  return (
    <Box
      data-testid={testId}
      sx={{ display: 'grid', gap, alignItems, gridTemplateColumns: templateFor(columns) }}
    >
      {children}
    </Box>
  );
}

export interface FieldGridItemProps {
  /** Columns to span, or 'full' for the whole row. Default 1. */
  span?: number | 'full';
  children: ReactNode;
}

/** A cell of FieldGrid that spans more than one column (long names, addresses, text areas). */
export function FieldGridItem({ span = 1, children }: FieldGridItemProps) {
  return (
    <Box sx={{ gridColumn: span === 'full' ? '1 / -1' : `span ${span}`, minWidth: 0 }}>
      {children}
    </Box>
  );
}
