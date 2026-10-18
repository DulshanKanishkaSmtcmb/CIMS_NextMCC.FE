import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';

interface FrameProps {
  label: string;
  children: ReactNode;
  testId?: string;
}

/** Announces "loading" once to screen readers; the placeholder shapes themselves are hidden from them. */
function LoadingFrame({ label, children, testId }: FrameProps) {
  return (
    <Box role="status" aria-label={label} aria-busy="true" data-testid={testId}>
      <Box aria-hidden>{children}</Box>
    </Box>
  );
}

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  /** Screen-reader text. Default "Loading". */
  label?: string;
  'data-testid'?: string;
}

/** Placeholder for a grid or table while its first page loads: header row plus body rows. */
export function TableSkeleton({
  rows = 5,
  columns = 5,
  label = 'Loading',
  'data-testid': testId,
}: TableSkeletonProps) {
  const cells = Array.from({ length: columns });
  return (
    <LoadingFrame label={label} testId={testId}>
      <Stack spacing={1}>
        <Stack direction="row" spacing={2}>
          {cells.map((_, c) => (
            <Skeleton key={c} variant="text" sx={{ flex: 1, fontSize: '1rem' }} />
          ))}
        </Stack>
        {Array.from({ length: rows }).map((_, r) => (
          <Stack key={r} direction="row" spacing={2}>
            {cells.map((_, c) => (
              <Skeleton key={c} variant="rounded" height={24} sx={{ flex: 1 }} />
            ))}
          </Stack>
        ))}
      </Stack>
    </LoadingFrame>
  );
}

export interface ListSkeletonProps {
  rows?: number;
  /** Two text lines per row (primary + secondary). Default true. */
  twoLine?: boolean;
  label?: string;
  'data-testid'?: string;
}

/** Placeholder for a list of selectable lines (master-data list, pick lists). */
export function ListSkeleton({
  rows = 6,
  twoLine = true,
  label = 'Loading',
  'data-testid': testId,
}: ListSkeletonProps) {
  return (
    <LoadingFrame label={label} testId={testId}>
      <Stack spacing={1.5}>
        {Array.from({ length: rows }).map((_, r) => (
          <Stack key={r} spacing={0.25}>
            <Skeleton variant="text" width="60%" sx={{ fontSize: '1rem' }} />
            {twoLine ? <Skeleton variant="text" width="40%" /> : null}
          </Stack>
        ))}
      </Stack>
    </LoadingFrame>
  );
}

export interface FormSkeletonProps {
  fields?: number;
  /** Columns of the field grid it stands in for. Default 2. */
  columns?: number;
  label?: string;
  'data-testid'?: string;
}

/** Placeholder for a detail form while its record loads. */
export function FormSkeleton({
  fields = 6,
  columns = 2,
  label = 'Loading',
  'data-testid': testId,
}: FormSkeletonProps) {
  return (
    <LoadingFrame label={label} testId={testId}>
      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: `repeat(${columns}, minmax(0, 1fr))` },
        }}
      >
        {Array.from({ length: fields }).map((_, f) => (
          <Skeleton key={f} variant="rounded" height={40} />
        ))}
      </Box>
    </LoadingFrame>
  );
}
