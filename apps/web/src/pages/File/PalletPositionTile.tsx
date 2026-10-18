import { Box, Button } from '@cims/ui';

export interface PalletPositionTileProps {
  /** The position number the tile stands for, e.g. "A35-01-01". */
  position: string;
  /** In use (saved with the rack) or switched off. */
  enabled: boolean;
  onToggle: () => void;
  /** A stored layout is shown, not edited. */
  readOnly?: boolean;
}

/**
 * One pallet position of the Pallet rack build page: a toggle button (aria-pressed) that shows the position number and
 * its state in words and colour, "In use" on a green tint or "Off" on a grey one (legacy: a green AdminLTE box with the
 * number and "Disable", red without the number and "Enable"; colour is never the only signal here).
 */
export function PalletPositionTile({
  position,
  enabled,
  onToggle,
  readOnly = false,
}: PalletPositionTileProps) {
  const tone = enabled ? 'success' : 'neutral';
  return (
    <Button
      variant="outlined"
      aria-pressed={enabled}
      aria-label={`${position}: ${enabled ? 'in use' : 'off'}`}
      onClick={readOnly ? undefined : onToggle}
      aria-disabled={readOnly || undefined}
      data-testid="position-tile"
      sx={(theme) => ({
        minHeight: theme.cims.density.touchTarget,
        minWidth: 0,
        px: 1,
        py: 0.5,
        flexDirection: 'column',
        alignItems: 'stretch',
        textAlign: 'left',
        lineHeight: 1.2,
        cursor: readOnly ? 'default' : 'pointer',
        color: theme.cims.status[tone].fg,
        bgcolor: theme.cims.status[tone].bg,
        borderColor: theme.cims.status[tone].main,
        '&:hover': { bgcolor: theme.cims.status[tone].bg, borderColor: theme.cims.status[tone].fg },
        ...(enabled ? null : { borderStyle: 'dashed' }),
      })}
    >
      <Box
        component="span"
        sx={{
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          textDecoration: enabled ? 'none' : 'line-through',
          overflowWrap: 'anywhere',
        }}
      >
        {position}
      </Box>
      <Box component="span" sx={{ typography: 'caption' }}>
        {enabled ? '✓ In use' : 'Off'}
      </Box>
    </Button>
  );
}
