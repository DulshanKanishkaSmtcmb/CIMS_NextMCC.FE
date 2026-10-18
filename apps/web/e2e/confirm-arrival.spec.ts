import { expect, test } from '@playwright/test';

/**
 * Main flow of /Data/ConfirmArrival (legacy docs/13): load contracts, tick a line, select all, enter the arrival date,
 * save. Needs the SPA (`npm run dev`, with VITE_API_BASE_URL pointing at the API), the API with a Test database, and
 * a DevJwt token for a PwInfo user in E2E_DEV_TOKEN. Skips when any of them is missing.
 *
 * The save is intercepted and answered locally unless E2E_ALLOW_SAVE=1, so a default run never writes to the
 * database; the test still checks the request body the page sends.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const apiURL = process.env.E2E_API_URL ?? 'http://localhost:5213';
const token = process.env.E2E_DEV_TOKEN ?? '';
const allowSave = process.env.E2E_ALLOW_SAVE === '1';

async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

const ready = token !== '' && (await isReachable(baseURL)) && (await isReachable(`${apiURL}/health/live`));

test.describe('Confirm Arrivals', () => {
  test.skip(!ready, `Needs the SPA at ${baseURL}, the API at ${apiURL} and E2E_DEV_TOKEN.`);

  test('load, tick, select all and confirm', async ({ page }) => {
    let posted: unknown = null;
    if (!allowSave) {
      await page.route('**/api/v1/arrivals/confirm', async (route) => {
        posted = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            contractsConfirmed: 1,
            importVesselUpdated: false,
            importContainerUpdated: false,
            message: 'Data Saved Successfully',
          }),
        });
      });
    }

    // Development sign-in with the DevJwt token.
    await page.goto('/login');
    await page.getByLabel('Dev bearer token').fill(token);
    await page.getByRole('button', { name: 'Use dev token' }).click();
    await page.goto('/Data/ConfirmArrival');
    await expect(page.getByRole('heading', { name: 'Contract - Confirm Arrivals' })).toBeVisible();

    await page.getByRole('combobox', { name: 'Shipment' }).click();
    await page.getByRole('option', { name: 'Import' }).click();
    await page.locator('#btnLoadPOs').click();
    await expect(page.getByText('Contracts Loaded successfully')).toBeVisible();

    // Tick the first supplier line, or else the first container line.
    const supplier = page.getByRole('checkbox', { name: /^Supplier / }).first();
    const container = page.getByRole('checkbox', { name: /^Container / }).first();
    if (await supplier.count()) await supplier.check();
    else await container.check();

    const pendingTotals = page.getByTestId('pendingTotals');
    await expect(pendingTotals).not.toHaveText(/^0 Contracts/);
    await page.getByRole('button', { name: 'Select All' }).click();
    await expect(pendingTotals).toHaveText(/^0 Contracts/);
    await expect(page.getByTestId('selectedTotals')).not.toHaveText(/^0 Contracts/);

    // Save without a date first: legacy message.
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Enter Confirm Arrival Date')).toBeVisible();

    await page.getByRole('spinbutton', { name: 'Day' }).first().click();
    await page.keyboard.type('181020261430');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Data Saved Successfully')).toBeVisible();

    if (!allowSave) {
      expect(posted).toMatchObject({ arrivalDate: '2026-10-18T14:30:00' });
      expect((posted as { rcvNos: string[] }).rcvNos.length).toBeGreaterThan(0);
    }
  });
});
