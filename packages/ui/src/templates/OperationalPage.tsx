import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import { PageShell, type PageShellProps } from './PageShell';

export interface OperationalPageProps extends Omit<
  PageShellProps,
  'footer' | 'children' | 'width'
> {
  /**
   * Top band: the scan field (or the filter + load step on pages without a scanner). The first thing the cursor and
   * the eye land on.
   */
  scanArea?: ReactNode;
  /** Context and progress panel: what is being worked on, picked lines, counts. */
  aside?: ReactNode;
  /** Accessible name of the aside. Default "Context". */
  asideLabel?: string;
  /** Side of the aside at md and up. Default 'end'. Below md it stacks above the results. */
  asidePosition?: 'start' | 'end';
  /** Width token of the aside (theme.cims.layout.asideWidth). Default 'narrow'. */
  asideWidth?: 'narrow' | 'wide';
  /** The results: lists of scanned/picked lines. */
  children: ReactNode;
  /** Sticky ActionBar with the commit action and running totals. */
  actionBar?: ReactNode;
  'data-testid'?: string;
}

/**
 * Template for operational (scan/task) pages: scan area on top, results with a context/progress panel, and a sticky
 * action bar so the next action is always visible. See docs/19 section 3.2.
 */
export function OperationalPage({
  scanArea,
  aside,
  asideLabel = 'Context',
  asidePosition = 'end',
  asideWidth = 'narrow',
  children,
  actionBar,
  ...shell
}: OperationalPageProps) {
  return (
    <PageShell {...shell} footer={actionBar}>
      <Stack spacing={2}>
        {scanArea ? <Box>{scanArea}</Box> : null}
        <Box
          sx={(theme) => {
            const w = theme.cims.layout.asideWidth[asideWidth];
            return {
              display: 'grid',
              gap: 2,
              alignItems: 'start',
              gridTemplateColumns: {
                xs: 'minmax(0, 1fr)',
                md: aside
                  ? asidePosition === 'start'
                    ? `${w}px minmax(0, 1fr)`
                    : `minmax(0, 1fr) ${w}px`
                  : 'minmax(0, 1fr)',
              },
            };
          }}
        >
          {aside ? (
            <Box
              component="aside"
              aria-label={asideLabel}
              sx={{
                minWidth: 0,
                order: { xs: 0, md: asidePosition === 'start' ? 0 : 1 },
              }}
            >
              {aside}
            </Box>
          ) : null}
          <Box sx={{ minWidth: 0, order: { xs: 1, md: asidePosition === 'start' ? 1 : 0 } }}>
            {children}
          </Box>
        </Box>
      </Stack>
    </PageShell>
  );
}
