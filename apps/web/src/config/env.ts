/** Build-time configuration. Only VITE_* values are exposed to the browser; none of them is secret. */
export const env = {
  /** API base URL. Empty means same origin (behind the gateway or the dev proxy). */
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
  /** CIMS Identity Server authority (issuer URL). */
  identityAuthority: import.meta.env.VITE_IDENTITY_AUTHORITY ?? '',
  /** Public OIDC client id for this SPA. */
  clientId: import.meta.env.VITE_CLIENT_ID || 'cims-nextmcc-spa',
} as const;
