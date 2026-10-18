# =========================================================
# CIMS NextMCC front end: Vite build -> static files on nginx
#
# Build with the REPOSITORY ROOT as the context (the app depends on packages/ui and packages/api-client):
#   docker build -f apps/web/Dockerfile \
#     --build-arg VITE_API_BASE_URL="" \
#     --build-arg VITE_IDENTITY_AUTHORITY="https://identity.example.invalid" \
#     --build-arg VITE_CLIENT_ID="cims-nextmcc-spa" \
#     -t cims-nextmcc-fe .
#
# Vite inlines the VITE_* values at build time, so they are build arguments, not runtime variables.
# None of them is a secret: the SPA is a public OIDC client (authorization code + PKCE).
# =========================================================

# ---------- Stage 1: build ----------
FROM node:24-alpine AS build
WORKDIR /app

# Install dependencies first so Docker can cache this layer.
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/
COPY packages/ui/package.json packages/ui/
COPY packages/api-client/package.json packages/api-client/
RUN npm ci

ARG VITE_API_BASE_URL=""
ARG VITE_IDENTITY_AUTHORITY=""
ARG VITE_CLIENT_ID="cims-nextmcc-spa"
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_IDENTITY_AUTHORITY=$VITE_IDENTITY_AUTHORITY \
    VITE_CLIENT_ID=$VITE_CLIENT_ID

COPY tsconfig.base.json ./
COPY packages packages
COPY apps apps
RUN npm run build --workspace @cims/web

# ---------- Stage 2: serve ----------
FROM nginx:1.27-alpine
RUN rm -rf /usr/share/nginx/html/*
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/nginx/default.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
