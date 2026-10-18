import { useId, type ReactNode } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  /** Short explanation. Use children for richer content. */
  message?: ReactNode;
  children?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Red confirm button and initial focus on Cancel, so a stray Enter from a scanner cannot confirm. */
  destructive?: boolean;
  /** Disables both buttons and ignores Escape while the confirmed action runs. */
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmation prompt, required before any destructive action. */
export function ConfirmDialog({
  open,
  title,
  message,
  children,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const messageId = useId();

  return (
    <Dialog
      open={open}
      onClose={loading ? undefined : onCancel}
      aria-labelledby={titleId}
      aria-describedby={message ? messageId : undefined}
      maxWidth="xs"
      fullWidth
    >
      <DialogTitle id={titleId}>{title}</DialogTitle>
      <DialogContent>
        {message ? <DialogContentText id={messageId}>{message}</DialogContentText> : null}
        {children}
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel} disabled={loading} autoFocus={destructive}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          disabled={loading}
          variant="contained"
          color={destructive ? 'error' : 'primary'}
          autoFocus={!destructive}
        >
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
