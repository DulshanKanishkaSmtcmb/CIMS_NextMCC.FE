import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';

export interface BlockingOverlayProps {
  open: boolean;
  /** Default "Processing request...", the legacy blockUI text. */
  message?: string;
  /**
   * Cover only the nearest positioned parent (set position: relative on it), like the legacy
   * block-a-div behaviour. Default false: cover the whole window.
   */
  contained?: boolean;
}

/** Blocks input while a request runs and shows a progress message. */
export function BlockingOverlay({
  open,
  message = 'Processing request...',
  contained = false,
}: BlockingOverlayProps) {
  if (!open) return null;
  return (
    <Backdrop
      open
      role="alert"
      aria-busy="true"
      // MUI hides Backdrop from assistive technology by default; this one carries a status message.
      aria-hidden={false}
      sx={(theme) => ({
        position: contained ? 'absolute' : 'fixed',
        zIndex: theme.zIndex.modal + 1,
        flexDirection: 'column',
        gap: 2,
        color: theme.palette.text.primary,
        backgroundColor: alpha(theme.palette.background.paper, 0.6),
      })}
    >
      <CircularProgress color="primary" />
      <Typography variant="subtitle1">{message}</Typography>
    </Backdrop>
  );
}
