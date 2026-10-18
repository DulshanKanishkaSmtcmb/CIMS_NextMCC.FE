import { useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Alert, Box, Button, Paper, Stack, Typography } from '@cims/ui';
import { getErrorMessage } from '@cims/api-client';
import { userManager } from '../../auth/userManager';
import { env } from '../../config/env';
import { useAppSelector } from '../../redux/hooks';
import { safeReturnTo } from '../../utils/returnTo';

/** Starts the Identity redirect (authorization code + PKCE). The user types their password at Identity, never here. */
export function LoginPage() {
  const status = useAppSelector((state) => state.auth.status);
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const returnTo = safeReturnTo((location.state as { from?: unknown } | null)?.from);

  if (status === 'authenticated') {
    return <Navigate to={returnTo} replace />;
  }

  const signIn = () => {
    setError(null);
    userManager.signinRedirect({ state: { returnTo } }).catch((cause: unknown) => {
      setError(getErrorMessage(cause, 'Could not reach the sign-in service'));
    });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ p: 4, width: '100%', maxWidth: 400 }}>
        <Stack spacing={2}>
          <Typography variant="h5" component="h1">
            CIMS NextMCC
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sign in with your CIMS account to continue.
          </Typography>
          {!env.identityAuthority ? (
            <Alert severity="warning">
              VITE_IDENTITY_AUTHORITY is not set. Copy apps/web/.env.example to .env.local and set
              it.
            </Alert>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}
          <Button variant="contained" size="large" onClick={signIn}>
            Sign in with CIMS Identity
          </Button>
        </Stack>
      </Paper>
    </Box>
  );
}
