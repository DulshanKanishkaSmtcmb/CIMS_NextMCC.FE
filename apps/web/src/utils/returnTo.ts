import { PATHS } from '../routes/paths';

const isSignInPath = (value: string): boolean => {
  const lower = value.toLowerCase();
  return (
    lower.startsWith(PATHS.login) ||
    lower.startsWith(PATHS.legacyLogin.toLowerCase()) ||
    lower.startsWith('/auth/')
  );
};

/**
 * A post-login destination is accepted only when it is an in-app path. This blocks open redirects
 * such as "//evil.example" or "https://evil.example" smuggled through router state or OIDC state.
 */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return PATHS.home;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return PATHS.home;
  if (isSignInPath(value)) return PATHS.home;
  return value;
}

/**
 * The ReturnUrl a legacy page put on its redirect to /Account/Login (Katana cookie middleware), or null. Not validated
 * here: pass it through safeReturnTo.
 */
export function legacyReturnUrl(search: string): string | null {
  return new URLSearchParams(search).get('ReturnUrl') || null;
}
