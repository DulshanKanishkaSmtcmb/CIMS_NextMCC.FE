# CIMS_NextMCC.FE

Front end for CIMS NextMCC, the warehouse / CFS application being moved page by page from the legacy ASP.NET MVC 5 + Knockout.js app to the CIMS stack: React + MUI here, ASP.NET Core + Dapper on the API side, CIMS Identity Server for sign-in. Design: `docs/09-modernization-plan.md` in the legacy repository, sections 2.4, 4.2 and 4.3.

Old and new pages share one hostname and one login. A page moves to this app by changing the gateway routing; its route here keeps the legacy path (`/Home/Index`, `/Data/ConfirmArrival`).

## Layout

```
apps/
  web/                  The single-page app (Vite + React 19). Pages, routing, auth, Redux store.
packages/
  ui/                   @cims/ui. The only package that may import @mui/* and @emotion/*.
                        Theme, warehouse components, COMPONENT-REGISTRY.md.
  api-client/           @cims/api-client. Axios instance, bearer token, tenant header, 401 handling,
                        legacy cookie bridge call.
```

npm workspaces, TypeScript project references (strict), ESLint 9 flat config, Prettier, Vitest, Playwright.

## Requirements

Node 20.19 or newer (developed on Node 24, npm 11). Docker is only needed to build the image.

## Getting started

```bash
npm install
cp apps/web/.env.example apps/web/.env.local   # then edit the values
npm run dev                                    # http://localhost:5173
```

## Scripts (run from the repository root)

| Script                            | What it does                                                                                                                                                                 |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Starts the Vite dev server for `apps/web`.                                                                                                                                   |
| `npm run build`                   | Type-checks (`tsc -b`) and builds every workspace. The app lands in `apps/web/dist`.                                                                                         |
| `npm test`                        | Runs the Vitest suites of every workspace.                                                                                                                                   |
| `npm run test:e2e`                | Playwright smoke test. It skips itself when no server is running on `E2E_BASE_URL` (default `http://localhost:5173`). The first run needs `npx playwright install chromium`. |
| `npm run lint`                    | ESLint over the whole repository, warnings count as failures.                                                                                                                |
| `npm run typecheck`               | `tsc -b` only.                                                                                                                                                               |
| `npm run format` / `format:check` | Prettier write / check.                                                                                                                                                      |

## Environment variables

Set in `apps/web/.env.local` for development, or as Docker build arguments for the image. Vite inlines them at build time and only `VITE_*` values reach the browser, so nothing secret belongs here. The SPA is a public OIDC client (authorization code + PKCE); there is no client secret and no password grant.

| Variable                  | Meaning                                                                          | Default            |
| ------------------------- | -------------------------------------------------------------------------------- | ------------------ |
| `VITE_API_BASE_URL`       | API base URL. Empty means the same origin (behind the gateway or the dev proxy). | empty              |
| `VITE_IDENTITY_AUTHORITY` | CIMS Identity Server issuer URL.                                                 | none, required     |
| `VITE_CLIENT_ID`          | OIDC client id registered in Identity.                                           | `cims-nextmcc-spa` |
| `DEV_API_PROXY_TARGET`    | Dev server only. Forwards `/api` to a local API so the browser sees one origin.  | unset              |

Identity needs a public client with: redirect URI `<origin>/auth/callback` (also used for silent renew), post-logout redirect `<origin>/login`, scope `openid profile cims.nextmcc`. The dev origin is `http://localhost:5173`. The scope and client id follow the task for this repository; section 4.2 of the plan still names `cims-inventory-spa` and `cims.inventory`, so confirm the final names with the Identity and API teams.

## Running against the API

The API lives in `CIMS_NextMCC.API`. The sample endpoint is `GET /api/v1/reference/field-captions`; the cookie bridge is `POST /api/v1/legacy-session` (a stub that answers 501 for now, which this app treats as "not available yet").

Option 1, same origin through the dev proxy (closest to production, no CORS needed):

```
VITE_API_BASE_URL=
DEV_API_PROXY_TARGET=http://localhost:<api port>
VITE_IDENTITY_AUTHORITY=<identity url>
```

Option 2, direct calls: set `VITE_API_BASE_URL=http://localhost:<api port>`. The API must then allow the origin `http://localhost:5173` with credentials in CORS.

Either way the API must accept tokens from the same Identity authority, with the audience and scope you registered for this client. After signing in, open **Reference / Field Captions** (`/Reference/FieldCaptions`) to see the sample call. The app sends `Authorization: Bearer <token>` and `X-Tenant: <selected tenant>`.

Assumption to confirm: the allowed tenants come from a token claim named `tenants` (`apps/web/src/auth/profile.ts`). Identity has not defined this yet.

## The component registry rule

Application code never imports `@mui/*` or `@emotion/*`. It imports from `@cims/ui`. ESLint enforces this for everything outside `packages/ui` and the rule must not be disabled.

Before writing a component, read `packages/ui/COMPONENT-REGISTRY.md` and search `packages/ui/src`. Extend an existing component with props instead of copying it. A new shared component gets a registry entry in the same change. Colours, spacing and typography come from theme tokens (`packages/ui/src/theme.ts`), not from literals.

If a page needs something MUI offers that `@cims/ui` does not export yet, add a purpose-built component to `packages/ui` (and the registry). Add a plain re-export to `primitives.ts` only for generic building blocks.

## Authentication in short

1. `/login` starts the Identity redirect (`oidc-client-ts`, code + PKCE).
2. `/auth/callback` finishes it, stores the profile and allowed tenants in Redux, then calls `POST /api/v1/legacy-session` so legacy pages on the same hostname accept the user. A 501 is ignored.
3. Tokens stay inside `oidc-client-ts` (session storage). They are never copied into Redux. `@cims/api-client` asks for the token on every request.
4. A 401 from the API signs the user out locally and sends them back to `/login`.
5. Silent renew reloads `/auth/callback` in a hidden iframe; `main.tsx` completes it without mounting the app. Nginx therefore sends `X-Frame-Options: SAMEORIGIN`.

Not done yet: clearing the legacy cookie on sign-out (needs a bridge endpoint, plan section 4.3 item 3), and loading the menu from the API (currently `apps/web/src/navigation/menuStub.ts`, shaped like the `CloudMenu` rows).

## Docker and pipeline

`apps/web/Dockerfile` builds with the repository root as context and serves the static files with nginx; `apps/web/nginx/default.conf` has the SPA fallback and a placeholder `/api/` proxy. `azure-pipelines.yml` runs lint, test and build, then builds and pushes `ghcr.io/speedmark-transportation-lanka-pvt-ltd/cims-nextmcc-fe`. Neither has been run yet: Docker was not available when this was scaffolded, and the pipeline contains values marked `PLACEHOLDER` (ports, Identity URLs, the compose service name).

```bash
docker build -f apps/web/Dockerfile \
  --build-arg VITE_IDENTITY_AUTHORITY=https://identity.example.invalid \
  -t cims-nextmcc-fe .
docker run --rm -p 8080:80 cims-nextmcc-fe
```

## Moving the shared packages into the Cargo front-end workspace

`CIMS.Cargo.FE` has an empty `packages/ui`. `@cims/ui` and `@cims/api-client` are written to move there without changes to their code:

1. Copy `packages/ui` and `packages/api-client` into the Cargo workspace. Keep the package names `@cims/ui` and `@cims/api-client`.
2. Merge `packages/ui/COMPONENT-REGISTRY.md` with the Cargo registry (the Cargo seed list overlaps with `PageHeader`, `ConfirmDialog` and `TenantSwitcher`, which now exist).
3. Copy the `no-restricted-imports` block from `eslint.config.js` into the Cargo ESLint config, with `packages/ui` as the only exception.
4. Align `tsconfig.base.json` options and tooling versions (React 19, MUI 7, MUI X 8, Vitest) with the Cargo workspace.
5. Publish the two packages to the company registry, or keep them as workspace packages, then change the `@cims/*` dependencies in this repository from `*` to the published version and delete the local `packages/` folders.
6. Until then, keep changes to the two packages free of anything specific to NextMCC so they stay movable. App-specific code belongs in `apps/web`.

Both packages are consumed from source (`exports` points at `src/index.ts`). When they are published, add a build step that emits JavaScript and declarations, and point `exports` at the output.

## Notes

- ESLint stays on major version 9 as specified. The 9.x line is flagged end of life on npm; move to ESLint 10 when the other CIMS repositories do.
- Every page and the application shell are lazy loaded (`React.lazy` + `Suspense` with the `PageLoading` fallback from `@cims/ui`), and `apps/web/vite.config.ts` splits vendor code into react, mui, mui-x, toolpad, router, redux and oidc chunks. New pages must be lazy loaded in `apps/web/src/routes/AppRoutes.tsx`. The entry chunk is about 12 kB.
- The SPA is served at the site root (Vite `base` is `/`, no router basename). The gateway sends only the flipped legacy page paths, `/auth/callback`, `/login` and `/assets/` to this container; `apps/web/nginx/default.conf` documents the contract. Deep links and refreshes work through the `index.html` fallback.
- Legacy sounds are not copied into this repository. See the ScanFeedback entry in the registry.
