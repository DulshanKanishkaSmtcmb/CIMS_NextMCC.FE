import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';

export interface ActionBarProps {
  /** Left side: the input the action needs (e.g. a date) and a summary of what the action will affect. */
  start?: ReactNode;
  /** Right side: the actions. Put the primary action last (rightmost). */
  children: ReactNode;
  /** A message row above the bar's content (ErrorState after a failed save, success banner). */
  message?: ReactNode;
  /** Accessible name of the region. Default "Page actions". */
  label?: string;
  'data-testid'?: string;
}

/**
 * Sticky bar at the bottom of the scrolling page: the commit point of a task page, always visible however long the
 * lists get. On narrow screens the start content stacks above the actions.
 */
export function ActionBar({
  start,
  children,
  message,
  label = 'Page actions',
  'data-testid': testId,
}: ActionBarProps) {
  return (
    <Box
      component="section"
      aria-label={label}
      data-testid={testId}
      sx={(theme) => ({
        position: 'sticky',
        bottom: 0,
        zIndex: theme.zIndex.appBar - 1,
        bgcolor: 'background.paper',
        borderTop: 1,
        borderColor: 'divider',
        boxShadow: '0 -4px 12px rgba(16, 24, 40, 0.06)',
        px: theme.cims.layout.pagePaddingX,
        py: 1.5,
      })}
    >
      <Box sx={(theme) => ({ maxWidth: theme.cims.layout.contentMaxWidth, mx: 'auto' })}>
        {message ? <Box sx={{ mb: 1.5 }}>{message}</Box> : null}
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
          spacing={{ xs: 1.5, md: 3 }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>{start}</Box>
          <Stack
            direction="row"
            spacing={1}
            alignItems="center"
            justifyContent="flex-end"
            flexWrap="wrap"
            useFlexGap
            sx={(theme) => ({
              flex: 'none',
              '& .MuiButton-root': { minHeight: theme.cims.density.touchTarget },
            })}
          >
            {children}
          </Stack>
        </Stack>
      </Box>
    </Box>
  );
}
