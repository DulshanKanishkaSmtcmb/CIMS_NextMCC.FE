import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Alert, Box, Button, Paper, Stack, Typography } from '@cims/ui';
import { getErrorMessage } from '@cims/api-client';
import { devTokenEnabled } from '../../auth/devToken';
import { userManager } from '../../auth/userManager';
import { env } from '../../config/env';
import { useAppSelector } from '../../redux/hooks';
import { legacyReturnUrl, safeReturnTo } from '../../utils/returnTo';
import { ContinueAfterSignIn } from './ContinueAfterSignIn';
import { DevTokenForm } from './DevTokenForm';

/**
 * Starts the Identity redirect (authorization code + PKCE). The user types their password at Identity, never here.
 * Served at /login and at the legacy /Account/Login (flipped at the gateway), where legacy pages send users with
 * ?ReturnUrl=<legacy path>.
 */
export function LoginPage() {
  const status = useAppSelector((state) => state.auth.status);
  const location = useLocation();
  const [error, setError] = useState<string | null>(null);
  const fromLegacy = legacyReturnUrl(location.search);
  const returnTo = safeReturnTo(fromLegacy ?? (location.state as { from?: unknown } | null)?.from);

  if (status === 'authenticated') {
    return <ContinueAfterSignIn returnTo={returnTo} fullPageLoad={fromLegacy !== null} />;
  }

  const signIn = () => {
    setError(null);
    const state = fromLegacy !== null ? { returnTo, fullPageLoad: true } : { returnTo };
    userManager.signinRedirect({ state }).catch((cause: unknown) => {
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
          {devTokenEnabled ? <DevTokenForm /> : null}
        </Stack>
      </Paper>
    </Box>
  );
}
