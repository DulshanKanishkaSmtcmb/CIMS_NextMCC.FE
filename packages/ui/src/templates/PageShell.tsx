import type { ReactNode } from 'react';
import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export interface PageShellProps {
  /** The page's one h1, as the task: "Confirm arrivals", "Countries". */
  title: string;
  /** Context line above the title: where this page sits ("Booking · Contracts") or what record is open. */
  context?: ReactNode;
  /** Page-level status next to the title (StatusChip). */
  status?: ReactNode;
  /** The one main action of the page, rightmost in the header. Omit when the action lives in the action bar. */
  primaryAction?: ReactNode;
  /** Less important actions (text or outlined buttons), left of the primary action. */
  secondaryActions?: ReactNode;
  /** A line under the header, e.g. ShortcutsLegend or a page-level InlineHint. */
  toolbar?: ReactNode;
  /** Sticky bar at the bottom of the page (ActionBar). */
  footer?: ReactNode;
  /** Cap the content width (default) or use the full width (wide grids). */
  width?: 'content' | 'full';
  children: ReactNode;
  'data-testid'?: string;
}

/**
 * The one page frame every CIMS page uses: context line, h1 title with status, actions on the right, content with
 * the standard paddings, and an optional sticky footer. Keeps the same anatomy and spacing on every screen.
 */
export function PageShell({
  title,
  context,
  status,
  primaryAction,
  secondaryActions,
  toolbar,
  footer,
  width = 'content',
  children,
  'data-testid': testId,
}: PageShellProps) {
  return (
    <Box
      data-testid={testId}
      sx={{ display: 'flex', flexDirection: 'column', minHeight: '100%', minWidth: 0 }}
    >
      <Box
        sx={(theme) => ({
          flex: 1,
          width: '100%',
          maxWidth: width === 'content' ? theme.cims.layout.contentMaxWidth : 'none',
          mx: 'auto',
          px: theme.cims.layout.pagePaddingX,
          py: theme.cims.layout.pagePaddingY,
        })}
      >
        <Box component="header" sx={{ mb: 2 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
            justifyContent="space-between"
            spacing={{ xs: 1, sm: 2 }}
          >
            <Box sx={{ minWidth: 0 }}>
              {context ? (
                <Typography
                  variant="body2"
                  color="text.secondary"
                  component="div"
                  sx={{ mb: 0.25 }}
                >
                  {context}
                </Typography>
              ) : null}
              <Stack direction="row" alignItems="center" spacing={1.5} flexWrap="wrap" useFlexGap>
                <Typography variant="h1" component="h1">
                  {title}
                </Typography>
                {status}
              </Stack>
            </Box>
            {primaryAction || secondaryActions ? (
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
                sx={{ flex: 'none' }}
              >
                {secondaryActions}
                {primaryAction}
              </Stack>
            ) : null}
          </Stack>
          {toolbar ? <Box sx={{ mt: 1 }}>{toolbar}</Box> : null}
        </Box>
        {children}
      </Box>
      {footer}
    </Box>
  );
}
