import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export type InlineHintTone = 'info' | 'success' | 'warning' | 'error';

const ICONS: Record<InlineHintTone, ReactNode> = {
  info: <InfoOutlinedIcon fontSize="inherit" />,
  success: <CheckCircleOutlineIcon fontSize="inherit" />,
  warning: <WarningAmberIcon fontSize="inherit" />,
  error: <ErrorOutlineIcon fontSize="inherit" />,
};

export interface InlineHintProps {
  tone?: InlineHintTone;
  children: ReactNode;
  /** Give it an id and point the field's aria-describedby at it. */
  id?: string;
  /**
   * Announce the hint when it appears: errors as role="alert", other tones as role="status". Default true for
   * errors, false otherwise (static guidance should not interrupt a screen reader).
   */
  live?: boolean;
  /** Tinted box instead of plain text. Use for hints that sit between sections. */
  boxed?: boolean;
  'data-testid'?: string;
}

/**
 * One line of guidance or validation next to the thing it is about: icon + text in the tone's colour. The single
 * convention for inline validation messages outside a field's own helper text (docs/19 section 5).
 */
export function InlineHint({
  tone = 'info',
  children,
  id,
  live,
  boxed = false,
  'data-testid': testId,
}: InlineHintProps) {
  const announce = live ?? tone === 'error';
  const role = announce ? (tone === 'error' ? 'alert' : 'status') : undefined;
  return (
    <Box
      id={id}
      role={role}
      data-testid={testId}
      data-tone={tone}
      sx={(theme) => {
        const colour = theme.cims.status[tone];
        return {
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0.75,
          color: colour.fg,
          typography: 'body2',
          ...(boxed
            ? {
                bgcolor: colour.bg,
                border: 1,
                borderColor: colour.main,
                borderRadius: 1,
                px: 1.5,
                py: 1,
              }
            : null),
        };
      }}
    >
      <Box
        component="span"
        aria-hidden
        sx={(theme) => ({
          fontSize: '1.125rem',
          lineHeight: 0,
          mt: '1px',
          color: theme.cims.status[tone].main,
        })}
      >
        {ICONS[tone]}
      </Box>
      <Box component="span" sx={{ minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
}
