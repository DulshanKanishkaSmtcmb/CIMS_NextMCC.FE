import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

export interface PageLoadingProps {
  /** Accessible label announced to screen readers. Default "Loading page". */
  label?: string;
  /** Fill the whole window height (for the first load) instead of a short block. Default false. */
  fullScreen?: boolean;
}

/** Fallback shown while a lazily loaded page is fetched. Use it as the Suspense fallback. */
export function PageLoading({ label = 'Loading page', fullScreen = false }: PageLoadingProps) {
  return (
    <Box
      role="status"
      aria-label={label}
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: fullScreen ? '100vh' : 240,
      }}
    >
      <CircularProgress />
    </Box>
  );
}
