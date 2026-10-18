import type { ReactNode } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';

export interface ErrorStateProps {
  /** What failed, in plain words: "Contracts could not be loaded". */
  title?: string;
  /** Why, and what happened to the user's work ("Nothing was saved."). */
  message?: ReactNode;
  /** The server's own message, shown verbatim in smaller text (e.g. a stored-procedure error). */
  details?: ReactNode;
  /** Shows a retry button. */
  onRetry?: () => void;
  retryLabel?: string;
  /** Extra actions next to the retry button. */
  actions?: ReactNode;
  /** Dismiss button (×). */
  onClose?: () => void;
  'data-testid'?: string;
}

/**
 * A failure the user must notice and can act on: announced to screen readers (role="alert"), stays until dismissed
 * or replaced, and offers the next step. Use toasts only for confirmations; use this for errors that block the task.
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  details,
  onRetry,
  retryLabel = 'Try again',
  actions,
  onClose,
  'data-testid': testId,
}: ErrorStateProps) {
  const hasActions = !!onRetry || !!actions;
  return (
    <Alert
      severity="error"
      variant="outlined"
      data-testid={testId}
      onClose={onClose}
      sx={(theme) => ({
        bgcolor: theme.cims.status.error.bg,
        color: theme.cims.status.error.fg,
        alignItems: 'flex-start',
      })}
      action={
        hasActions ? (
          <>
            {actions}
            {onRetry ? (
              <Button color="inherit" variant="outlined" onClick={onRetry}>
                {retryLabel}
              </Button>
            ) : null}
          </>
        ) : undefined
      }
    >
      <AlertTitle sx={{ fontWeight: 600 }}>{title}</AlertTitle>
      {message ? (
        <Typography variant="body2" component="div">
          {message}
        </Typography>
      ) : null}
      {details ? (
        <Typography
          variant="body2"
          component="div"
          sx={{ mt: 0.5, fontFamily: 'monospace', wordBreak: 'break-word' }}
        >
          {details}
        </Typography>
      ) : null}
    </Alert>
  );
}
