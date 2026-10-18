/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_IDENTITY_AUTHORITY?: string;
  readonly VITE_CLIENT_ID?: string;
  /** Development only: a `dotnet user-jwts` bearer token for the API's DevJwt scheme (auth/devToken.ts). */
  readonly VITE_DEV_BEARER_TOKEN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
