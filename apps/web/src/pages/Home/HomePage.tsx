import { Link as RouterLink } from 'react-router-dom';
import { Button, PageHeader, Paper, Stack, Typography } from '@cims/ui';
import { useAppSelector } from '../../redux/hooks';
import { PATHS } from '../../routes/paths';

export function HomePage() {
  const profile = useAppSelector((state) => state.auth.profile);
  const tenant = useAppSelector((state) => state.tenant.selectedTenantId);

  return (
    <>
      <PageHeader title="Home" subtitle={`Signed in as ${profile?.name ?? 'unknown user'}`} />
      <Paper sx={{ p: 2 }}>
        <Stack spacing={2}>
          <Typography variant="body1">
            Tenant: {tenant ?? 'none selected'}. Pages migrate from the legacy application one at a
            time; anything not listed in the menu is still served by the legacy application.
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button component={RouterLink} to={PATHS.confirmArrival} variant="contained">
              Confirm arrival
            </Button>
            <Button component={RouterLink} to={PATHS.fieldCaptions} variant="outlined">
              Field captions
            </Button>
          </Stack>
        </Stack>
      </Paper>
    </>
  );
}
