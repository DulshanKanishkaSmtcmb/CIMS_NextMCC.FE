import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import { defineConfig } from 'vitest/config';

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // Optional: forward /api to a locally running API so the browser sees one origin (like the gateway).
  const apiProxyTarget = env.DEV_API_PROXY_TARGET;

  return {
    plugins: [react()],
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
