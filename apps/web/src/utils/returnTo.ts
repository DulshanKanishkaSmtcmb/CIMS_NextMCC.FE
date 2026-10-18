import { PATHS } from '../routes/paths';

/**
 * A post-login destination is accepted only when it is an in-app path. This blocks open redirects
 * such as "//evil.example" or "https://evil.example" smuggled through router state or OIDC state.
 */
export function safeReturnTo(value: unknown): string {
  if (typeof value !== 'string') return PATHS.home;
  if (!value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\'))
    return PATHS.home;
  if (value.startsWith(PATHS.login) || value.startsWith('/auth/')) return PATHS.home;
  return value;
}
