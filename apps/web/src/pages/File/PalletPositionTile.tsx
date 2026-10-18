import { Box, Button, Typography } from '@cims/ui';

export interface PalletPositionTileProps {
  /** The position number the tile stands for, e.g. "A35-01-01". */
  position: string;
  /** In use (green, "Disable") or switched off (red, "Enable"; the legacy tile then shows no number). */
  enabled: boolean;
  onToggle: () => void;
}

/**
 * One pallet position of the Pallet Rack Build pages: the legacy AdminLTE small box, green with the position number and a
 * "Disable" link while the position is in use, red with no number and an "Enable" link when it is switched off.
 */
export function PalletPositionTile({ position, enabled, onToggle }: PalletPositionTileProps) {
  const action = enabled ? 'Disable' : 'Enable';
  return (
    <Box
      role="group"
      aria-label={position}
      sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}
    >
      <Box
        sx={{
          bgcolor: enabled ? 'success.main' : 'error.main',
          color: 'common.white',
          px: 2,
          py: 1,
          minHeight: 40,
        }}
      >
        <Typography variant="h6" component="h4">
          {enabled ? position : ''}
        </Typography>
      </Box>
      <Button
        fullWidth
        size="small"
        color="inherit"
        aria-label={`${action} ${position}`}
        onClick={onToggle}
        sx={{ borderRadius: 0 }}
      >
        {action}
      </Button>
    </Box>
  );
}
