import type { ReactNode } from 'react';
import { Box, Checkbox, Stack, Typography } from '@cims/ui';

export interface PickLineProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Accessible name of the checkbox, e.g. "Container MSCU1234567" (tests and the e2e scenario use it). */
  checkboxLabel: string;
  primary: ReactNode;
  secondary?: ReactNode;
  /** Contracts this line lists when ticked. */
  count: number;
  /** Status next to the primary text (e.g. "Updated on confirm"). */
  badge?: ReactNode;
  /** Shown under the line, outside the clickable label (e.g. the editable container no). */
  children?: ReactNode;
  disabled?: boolean;
}

/**
 * One supplier or container line of the Confirm Arrivals pick list: the whole line is the click target (gloves,
 * touch), ticked lines are tinted and outlined, and the line says how many contracts it brings in. Feature-local:
 * promote to @cims/ui when a second page needs it.
 */
export function PickLine({
  checked,
  onChange,
  checkboxLabel,
  primary,
  secondary,
  count,
  badge,
  children,
  disabled,
}: PickLineProps) {
  return (
    <Box
      component="li"
      sx={{
        listStyle: 'none',
        border: 1,
        borderColor: checked ? 'primary.main' : 'divider',
        borderRadius: 1,
        bgcolor: checked ? 'action.selected' : 'background.paper',
        transition: 'background-color 120ms, border-color 120ms',
      }}
    >
      <Box
        component="label"
        sx={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.5,
          pr: 1.5,
          py: 0.5,
          cursor: disabled ? 'default' : 'pointer',
          '&:hover': disabled ? undefined : { bgcolor: 'action.hover' },
          borderRadius: 1,
        }}
      >
        <Checkbox
          checked={checked}
          disabled={disabled}
          onChange={(_, value) => onChange(value)}
          slotProps={{ input: { 'aria-label': checkboxLabel } }}
        />
        <Stack sx={{ flex: 1, minWidth: 0, py: 0.75 }} spacing={0.25}>
          <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
            <Typography variant="body1" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
              {primary}
            </Typography>
            {badge}
          </Stack>
          {secondary ? (
            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: 'break-word' }}>
              {secondary}
            </Typography>
          ) : null}
        </Stack>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 0.75, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}
        >
          {count} {count === 1 ? 'contract' : 'contracts'}
        </Typography>
      </Box>
      {children ? <Box sx={{ px: 1.5, pb: 1.5, pl: 6 }}>{children}</Box> : null}
    </Box>
  );
}
