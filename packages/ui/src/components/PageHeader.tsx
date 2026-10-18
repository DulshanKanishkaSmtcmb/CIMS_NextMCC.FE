import type { ReactNode } from 'react';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  /** Buttons or other controls aligned to the right. */
  actions?: ReactNode;
}

/** Page title block: heading, optional subtitle, optional actions. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      spacing={2}
      sx={{ mb: 2 }}
    >
      <Stack spacing={0.5}>
        <Typography variant="h5" component="h1">
          {title}
        </Typography>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        ) : null}
      </Stack>
      {actions ? (
        <Stack direction="row" spacing={1}>
          {actions}
        </Stack>
      ) : null}
    </Stack>
  );
}
