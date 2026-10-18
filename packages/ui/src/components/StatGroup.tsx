import type { ReactNode } from 'react';
import Box from '@mui/material/Box';

export interface StatItem {
  label: string;
  value: ReactNode;
}

export interface StatGroupProps {
  items: readonly StatItem[];
  /** large: progress figures in a context panel or action bar. Default small (table footers). */
  size?: 'small' | 'large';
  /** Accessible name of the group, e.g. "Selected totals". */
  label?: string;
  'data-testid'?: string;
}

/**
 * Key figures (counts, totals) as a description list: label above or before a tabular-number value. The text content
 * reads "Label: value" for screen readers and tests.
 */
export function StatGroup({ items, size = 'small', label, 'data-testid': testId }: StatGroupProps) {
  const large = size === 'large';
  return (
    <Box
      component="dl"
      aria-label={label}
      data-testid={testId}
      sx={{
        m: 0,
        display: 'flex',
        flexWrap: 'wrap',
        columnGap: large ? 3 : 2.5,
        rowGap: 0.5,
      }}
    >
      {items.map((item) => (
        <Box
          key={item.label}
          sx={{
            display: 'flex',
            flexDirection: large ? 'column' : 'row',
            alignItems: large ? 'flex-start' : 'baseline',
            gap: large ? 0 : 0.75,
          }}
        >
          <Box
            component="dt"
            sx={{ typography: large ? 'caption' : 'body2', color: 'text.secondary' }}
          >
            {item.label}
            <Box
              component="span"
              sx={{
                position: 'absolute',
                width: 1,
                height: 1,
                overflow: 'hidden',
                clip: 'rect(0 0 0 0)',
              }}
            >
              :{' '}
            </Box>
          </Box>
          <Box
            component="dd"
            sx={{
              m: 0,
              typography: large ? 'h3' : 'body2',
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {item.value}
          </Box>
        </Box>
      ))}
    </Box>
  );
}
