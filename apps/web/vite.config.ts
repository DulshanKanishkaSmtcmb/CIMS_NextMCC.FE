import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

/**
 * Splits third-party code into long-cacheable vendor chunks. Order matters: the more specific
 * package groups come first. Everything else from node_modules falls into "vendor".
 */
function manualChunks(id: string): string | undefined {
  if (!id.includes('/node_modules/')) return undefined;
  const inPackage = (...names: string[]) =>
    names.some((name) => id.includes(`/node_modules/${name}/`));

  if (id.includes('/node_modules/@mui/x-')) return 'mui-x';
  if (inPackage('dayjs')) return 'mui-x'; // only used by the MUI X date pickers
  if (inPackage('@toolpad/core', '@toolpad/utils')) return 'toolpad';
  if (
    id.includes('/node_modules/@mui/') ||
    id.includes('/node_modules/@emotion/') ||
    inPackage(
      'notistack',
      'goober',
      'stylis',
      'clsx',
      'prop-types',
      'react-is',
      'react-transition-group',
      'dom-helpers',
      'hoist-non-react-statics',
      '@popperjs/core',
      '@babel/runtime',
    )
  ) {
    return 'mui';
  }
  if (inPackage('react-router', 'react-router-dom', 'cookie', 'set-cookie-parser')) return 'router';
  if (inPackage('@reduxjs/toolkit', 'react-redux', 'redux', 'redux-thunk', 'reselect', 'immer')) {
    return 'redux';
  }
  if (inPackage('oidc-client-ts', 'jwt-decode')) return 'oidc';
  if (inPackage('react', 'react-dom', 'scheduler', 'use-sync-external-store')) return 'react';
  return 'vendor';
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Optional: forward /api to a locally running API so the browser sees one origin (like the gateway).
  const apiProxyTarget = env.DEV_API_PROXY_TARGET;

  return {
    plugins: [react()],
    // The SPA is served at the site root, never under a sub-path such as /app/. The gateway sends only
    // the flipped legacy page paths and /assets/ to this container (see nginx/default.conf).
    base: '/',
    build: {
      rollupOptions: {
        output: { manualChunks },
      },
    },
    server: {
      port: 5173,
      proxy: apiProxyTarget
        ? { '/api': { target: apiProxyTarget, changeOrigin: true } }
        : undefined,
    },
    test: {
      environment: 'jsdom',
      include: ['src/**/*.test.{ts,tsx}'],
      setupFiles: ['./src/test/setup.ts'],
      css: false,
    },
  };
});
