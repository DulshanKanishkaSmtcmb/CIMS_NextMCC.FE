import { expect, test } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';

async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

const serverUp = await isReachable(baseURL);

test.describe('smoke', () => {
  test.skip(!serverUp, `No server is running at ${baseURL}. Start it with "npm run dev".`);

  test('an unauthenticated visit lands on the sign-in page', async ({ page }) => {
    await page.goto('/Home/Index');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });
});
