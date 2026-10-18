import { Link as RouterLink } from 'react-router-dom';
import { Button, PageHeader, Paper, Stack, Typography } from '@cims/ui';
import { PATHS } from '../../routes/paths';

export function NotFoundPage() {
  return (
    <>
      <PageHeader title="Page not found" />
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2} alignItems="flex-start">
          <Typography variant="body1">
            This page has not been migrated yet or the address is wrong.
          </Typography>
          <Button component={RouterLink} to={PATHS.home} variant="contained">
            Go to Home
          </Button>
        </Stack>
      </Paper>
    </>
  );
}
