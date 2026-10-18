import { useId } from 'react';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import type { SelectOption } from './SelectField';

type Choice = Exclude<SelectOption, string>;

export interface SegmentedControlProps {
  /** Visible label above the buttons; also the group's accessible name. */
  label: string;
  value: string;
  /** Two to five short choices. More than five: use SelectField. */
  options: readonly SelectOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
  fullWidth?: boolean;
  id?: string;
  'data-testid'?: string;
}

const toOption = (o: SelectOption): Choice => (typeof o === 'string' ? { value: o, label: o } : o);

/**
 * One choice out of a few, all visible: one click (or Tab + Space) instead of open-pick-close of a drop-down. The
 * selection cannot be cleared, so there is always a value. Buttons meet the 44 px touch-target token.
 */
export function SegmentedControl({
  label,
  value,
  options,
  onChange,
  disabled,
  fullWidth,
  id,
  'data-testid': testId,
}: SegmentedControlProps) {
  const labelId = useId();
  return (
    <Stack spacing={0.5} sx={{ minWidth: 0 }}>
      <Typography id={labelId} variant="caption" color="text.secondary" component="span">
        {label}
      </Typography>
      <ToggleButtonGroup
        id={id}
        data-testid={testId}
        exclusive
        value={value}
        disabled={disabled}
        fullWidth={fullWidth}
        aria-labelledby={labelId}
        onChange={(_, next: string | null) => {
          if (next !== null && next !== value) onChange(next);
        }}
        sx={(theme) => ({
          '& .MuiToggleButton-root': {
            minHeight: theme.cims.density.touchTarget - 4,
            px: 2,
            textTransform: 'none',
            fontWeight: 600,
          },
          '& .MuiToggleButton-root.Mui-selected': {
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            '&:hover': { bgcolor: 'primary.dark' },
          },
        })}
      >
        {options.map(toOption).map((o) => (
          <ToggleButton key={o.value} value={o.value}>
            {o.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Stack>
  );
}
