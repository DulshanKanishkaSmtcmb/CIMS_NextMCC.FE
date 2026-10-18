import { useState, type ReactNode } from 'react';
import { Box, Button, Paper, Stack, Typography } from '@cims/ui';

export interface SectionBoxProps {
  /** Box heading, e.g. "Address Details". */
  title: string;
  children: ReactNode;
}

/**
 * A titled group of fields with a collapse button, like the AdminLTE `box box-info` of the legacy Supplier pages
 * ("Address Details", "Contact Number Details", "Contact Person Details"). Collapsing only hides the fields; the values
 * stay in the form.
 */
export function SectionBox({ title, children }: SectionBoxProps) {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <Paper variant="outlined" sx={{ p: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle1" component="h2">
          {title}
        </Typography>
        <Button
          size="small"
          aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed((c) => !c)}
        >
          {collapsed ? '+' : '−'}
        </Button>
      </Stack>
      <Box sx={{ mt: 1, display: collapsed ? 'none' : 'flex', flexDirection: 'column', gap: 2 }}>
        {children}
      </Box>
    </Paper>
  );
}
