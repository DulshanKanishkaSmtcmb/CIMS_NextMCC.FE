import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, BlockingOverlay, Box, Button, Stack } from '@cims/ui';
import { getErrorMessage, legacySession } from '@cims/api-client';
import { sessionFromUser } from '../../auth/profile';
import { userManager } from '../../auth/userManager';
import { useAppDispatch } from '../../redux/hooks';
import { signedIn } from '../../redux/slices/authSlice';
import { PATHS } from '../../routes/paths';
import { safeReturnTo } from '../../utils/returnTo';

/** Completes the OIDC redirect, stores the profile, asks the API for the legacy cookie, then moves on. */
export function AuthCallbackPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // The authorization code can be redeemed once; React StrictMode runs effects twice in development.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    (async () => {
      const user = await userManager.signinCallback();
      if (!user) throw new Error('Sign-in did not return a user');

      dispatch(signedIn(sessionFromUser(user)));

      // Cookie bridge for legacy pages. 501 means "not available yet" and is not an error.
      try {
        await legacySession.create();
      } catch (cause) {
        console.warn('Legacy session could not be created', cause);
      }

      const returnTo = (user.state as { returnTo?: unknown } | undefined)?.returnTo;
      navigate(safeReturnTo(returnTo), { replace: true });
    })().catch((cause: unknown) => setError(getErrorMessage(cause, 'Sign-in failed')));
  }, [dispatch, navigate]);

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 480, mx: 'auto' }}>
        <Stack spacing={2}>
          <Alert severity="error">{error}</Alert>
          <Button variant="contained" onClick={() => navigate(PATHS.login, { replace: true })}>
            Back to sign in
          </Button>
        </Stack>
      </Box>
    );
  }
  return <BlockingOverlay open message="Signing you in..." />;
}
