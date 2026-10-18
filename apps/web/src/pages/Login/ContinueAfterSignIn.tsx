import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, BlockingOverlay, Box, Button, Stack } from '@cims/ui';
import { legacySession } from '@cims/api-client';
import { PATHS } from '../../routes/paths';
import { loadPage } from '../../utils/loadPage';

const BOUNCE_KEY = 'cims.legacyReturn';
const BOUNCE_WINDOW_MS = 30_000;

/** True when this tab already sent the user to the same legacy path a moment ago and the legacy app sent them back. */
function bouncedRecently(path: string, now: number): boolean {
  try {
    const raw = window.sessionStorage.getItem(BOUNCE_KEY);
    const last = raw ? (JSON.parse(raw) as { path?: unknown; at?: unknown }) : null;
    return last?.path === path && typeof last.at === 'number' && now - last.at < BOUNCE_WINDOW_MS;
  } catch {
    return false;
  }
}

function rememberBounce(path: string, now: number): void {
  try {
    window.sessionStorage.setItem(BOUNCE_KEY, JSON.stringify({ path, at: now }));
  } catch {
    // Storage blocked: no loop guard, the redirect still works.
  }
}

interface Props {
  returnTo: string;
  /** The destination came from a legacy page (ReturnUrl): open it with a full page load so the gateway routes it. */
  fullPageLoad: boolean;
}

/**
 * Runs once the user is signed in on the sign-in page: asks the API for the legacy cookie (cookie bridge, plan section
 * 4.3), then goes to the return path. A path from a legacy page is loaded in full, because the gateway decides which
 * app serves it; if the legacy app sends the user straight back, the loop stops here with a message.
 */
export function ContinueAfterSignIn({ returnTo, fullPageLoad }: Props) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      const now = Date.now();
      if (fullPageLoad && bouncedRecently(returnTo, now)) {
        setError(
          'The legacy pages did not accept your session. Sign out and sign in again, or ask support to check the cookie bridge.',
        );
        return;
      }
      // 501 means "not available yet" and is not an error; a failure still leaves the new pages usable.
      try {
        await legacySession.create();
      } catch (cause) {
        console.warn('Legacy session could not be created', cause);
      }
      if (fullPageLoad) {
        rememberBounce(returnTo, now);
        loadPage(returnTo);
      } else {
        navigate(returnTo, { replace: true });
      }
    })();
  }, [fullPageLoad, navigate, returnTo]);

  if (error) {
    return (
      <Box sx={{ p: 4, maxWidth: 480, mx: 'auto' }}>
        <Stack spacing={2}>
          <Alert severity="error">{error}</Alert>
          <Button variant="contained" onClick={() => navigate(PATHS.home, { replace: true })}>
            Go to the home page
          </Button>
        </Stack>
      </Box>
    );
  }
  return <BlockingOverlay open message="Signing you in..." />;
}
