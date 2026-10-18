/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_IDENTITY_AUTHORITY?: string;
  readonly VITE_CLIENT_ID?: string;
  /**
   * "true" compiles the dev-token sign-in into a production build: the API repo's local dev gateway only, never a
   * deployed build. Under `vite dev` the sign-in is always on.
   */
  readonly VITE_ENABLE_DEV_TOKEN?: string;
  /** Development only: a `dotnet user-jwts` bearer token for the API's DevJwt scheme (auth/devToken.ts). */
  readonly VITE_DEV_BEARER_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
