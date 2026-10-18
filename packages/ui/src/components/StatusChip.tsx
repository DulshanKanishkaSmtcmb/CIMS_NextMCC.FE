import type { ReactElement } from 'react';
import Chip from '@mui/material/Chip';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CircleOutlinedIcon from '@mui/icons-material/CircleOutlined';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import type { CimsStatusTone } from '../theme';

export type StatusTone = CimsStatusTone;

const DEFAULT_ICONS: Record<StatusTone, ReactElement> = {
  success: <CheckCircleOutlineIcon />,
  warning: <WarningAmberIcon />,
  error: <ErrorOutlineIcon />,
  info: <InfoOutlinedIcon />,
  neutral: <CircleOutlinedIcon />,
};

export interface StatusChipProps {
  /** Colour family from theme.cims.status. */
  tone: StatusTone;
  /** The status in words. Always shown: colour is never the only signal. */
  label: string;
  /** Replace the tone's default icon. */
  icon?: ReactElement;
  size?: 'small' | 'medium';
  id?: string;
  'data-testid'?: string;
}

/** A status shown as icon + text in a soft tinted chip (WCAG AA text contrast in every tone). */
export function StatusChip({
  tone,
  label,
  icon,
  size = 'small',
  id,
  'data-testid': testId,
}: StatusChipProps) {
  return (
    <Chip
      id={id}
      data-testid={testId}
      data-tone={tone}
      size={size}
      icon={icon ?? DEFAULT_ICONS[tone]}
      label={label}
      variant="outlined"
      sx={(theme) => {
        const colour = theme.cims.status[tone];
        return {
          fontWeight: 600,
          color: colour.fg,
          backgroundColor: colour.bg,
          borderColor: colour.main,
          '& .MuiChip-icon': { color: colour.main },
        };
      }}
    />
  );
}
