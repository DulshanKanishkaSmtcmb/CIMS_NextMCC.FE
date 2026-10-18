import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import InboxOutlinedIcon from '@mui/icons-material/InboxOutlined';

export interface EmptyStateProps {
  /** What is empty, in plain words: "No contracts waiting for arrival". */
  title: string;
  /** What to do next: "Choose a shipment and select Load contracts." */
  description?: ReactNode;
  /** Usually one button that performs the next step. */
  action?: ReactNode;
  /** Defaults to an inbox outline. Pass null for none. */
  icon?: ReactNode | null;
  /** compact: for panels and table bodies. Default: page sections. */
  size?: 'default' | 'compact';
  /** Heading element for the title. Default h3 (inside a section that has its own h2). */
  titleComponent?: 'h2' | 'h3' | 'h4' | 'p';
  'data-testid'?: string;
}

/** An empty list or section that says why it is empty and what to do next. */
export function EmptyState({
  title,
  description,
  action,
  icon,
  size = 'default',
  titleComponent = 'h3',
  'data-testid': testId,
}: EmptyStateProps) {
  const compact = size === 'compact';
  const shownIcon = icon === undefined ? <InboxOutlinedIcon fontSize="inherit" /> : icon;
  return (
    <Stack
      data-testid={testId}
      alignItems="center"
      textAlign="center"
      spacing={compact ? 0.5 : 1}
      sx={{ py: compact ? 2 : 5, px: 2, color: 'text.secondary' }}
    >
      {shownIcon ? (
        <Box
          aria-hidden
          sx={{ fontSize: compact ? 32 : 44, lineHeight: 0, color: 'text.disabled' }}
        >
          {shownIcon}
        </Box>
      ) : null}
      <Typography
        component={titleComponent}
        variant={compact ? 'subtitle2' : 'h3'}
        sx={{ color: 'text.primary' }}
      >
        {title}
      </Typography>
      {description ? (
        <Typography variant="body2" component="div" sx={{ maxWidth: 480 }}>
          {description}
        </Typography>
      ) : null}
      {action ? <Box sx={{ pt: 1 }}>{action}</Box> : null}
    </Stack>
  );
}
