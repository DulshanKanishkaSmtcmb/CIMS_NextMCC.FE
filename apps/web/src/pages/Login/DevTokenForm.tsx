import { useState } from 'react';
import { Alert, Button, Stack, TextInput, Typography } from '@cims/ui';
import { sessionFromDevToken, setDevToken } from '../../auth/devToken';
import { useAppDispatch } from '../../redux/hooks';
import { signedIn } from '../../redux/slices/authSlice';

/**
 * DEVELOPMENT ONLY (rendered only when import.meta.env.DEV): paste a token from
 * `dotnet user-jwts create --scheme DevJwt ...` to call the local API without CIMS Identity.
 */
export function DevTokenForm() {
  const dispatch = useAppDispatch();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);

  const applyToken = () => {
    const session = sessionFromDevToken(token.trim());
    if (!session) {
      setError('Not a readable, unexpired JWT.');
      return;
    }
    setDevToken(token);
    dispatch(signedIn(session));
  };

  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2">Development: sign in with a DevJwt token</Typography>
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
      <Button variant="outlined" onClick={applyToken} disabled={!token.trim()}>
        Use dev token
      </Button>
    </Stack>
  );
}
