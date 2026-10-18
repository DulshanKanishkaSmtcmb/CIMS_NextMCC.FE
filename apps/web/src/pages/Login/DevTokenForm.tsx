import { useState } from 'react';
import { Alert, Button, Stack, TextInput, Typography } from '@cims/ui';
import { devTokenApi, getErrorMessage } from '@cims/api-client';
import { sessionFromDevToken, setDevToken } from '../../auth/devToken';
import { useAppDispatch } from '../../redux/hooks';
import { signedIn } from '../../redux/slices/authSlice';

/**
 * DEVELOPMENT ONLY (rendered only when devTokenEnabled): sign in to the local API without CIMS Identity, either by
 * typing a PwInfo user name and asking the API's Development-only endpoint for a token ("Get dev token"), or by
 * pasting one from `dotnet user-jwts create --scheme DevJwt ...`.
 */
export function DevTokenForm() {
  const dispatch = useAppDispatch();
  const [userName, setUserName] = useState('');
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const signInWith = (value: string) => {
    const session = sessionFromDevToken(value.trim());
    if (!session) {
      setError('Not a readable, unexpired JWT.');
      return;
    }
    setDevToken(value);
    dispatch(signedIn(session));
  };

  const getToken = async () => {
    setError(null);
    setBusy(true);
    try {
      const result = await devTokenApi.create(userName.trim());
      setToken(result.token);
      signInWith(result.token);
    } catch (cause: unknown) {
      setError(getErrorMessage(cause, 'Could not get a dev token'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Development: sign in with a DevJwt token</Typography>
      <TextInput
        id="devUserName"
        label="User name"
        value={userName}
        onChange={(value) => {
          setUserName(value);
          setError(null);
        }}
      />
      <Button
        variant="outlined"
        onClick={() => void getToken()}
        disabled={!userName.trim() || busy}
      >
        Get dev token
      </Button>
      <TextInput
        id="devToken"
        label="Dev bearer token"
        value={token}
        onChange={(value) => {
          setToken(value);
          setError(null);
        }}
      />
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Button variant="outlined" onClick={() => signInWith(token)} disabled={!token.trim()}>
        Use dev token
      </Button>
    </Stack>
  );
}
