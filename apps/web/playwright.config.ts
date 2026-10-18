import { defineConfig, devices } from '@playwright/test';

// The smoke test skips itself when nothing is listening on E2E_BASE_URL.
// Start the app first (npm run dev) or point E2E_BASE_URL at a deployed instance.
export default defineConfig({
  testDir: './e2e',
  reporter: 'list',
  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
