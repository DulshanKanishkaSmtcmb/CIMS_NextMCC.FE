import { expect, test } from '@playwright/test';

/**
 * Main flow of /Data/ConfirmArrival (legacy docs/13, redesign docs/19 "Showcase"): load contracts, pick a container
 * through the scan field (or tick a supplier), add all to the selection, try to confirm without a date (blocked with
 * the date message), enter the date, confirm. Needs the SPA (`npm run dev`, with VITE_API_BASE_URL or
 * DEV_API_PROXY_TARGET pointing at the API), the API with a Test database, and either a DevJwt token for a PwInfo
 * user in E2E_DEV_TOKEN or a PwInfo user name in E2E_DEV_USER (the sign-in page's "Get dev token"). Skips when any
 * of them is missing.
 *
 * Selectors: roles, labels and data-testid only. The legacy element ids (btnLoadPOs, SupList, tblPending,
 * tblSelected) are gone: no scanner or other page depends on them (docs/13 section 1.2, docs/19 section 12).
 *
 * The save is intercepted and answered locally unless E2E_ALLOW_SAVE=1, so a default run never writes to the
 * database; the test still checks the request body the page sends.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const apiURL = process.env.E2E_API_URL ?? 'http://localhost:5213';
const token = process.env.E2E_DEV_TOKEN ?? '';
const user = process.env.E2E_DEV_USER ?? '';
const allowSave = process.env.E2E_ALLOW_SAVE === '1';

async function isReachable(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(1500) });
    return response.status < 500;
  } catch {
    return false;
  }
}

const ready =
  (token !== '' || user !== '') &&
  (await isReachable(baseURL)) &&
  (await isReachable(`${apiURL}/health/live`));

test.describe('Confirm Arrivals', () => {
  test.skip(
    !ready,
    `Needs the SPA at ${baseURL}, the API at ${apiURL} and E2E_DEV_TOKEN or E2E_DEV_USER.`,
  );

  test('load, pick, add all and confirm', async ({ page }) => {
    let posted: unknown = null;
    if (!allowSave) {
      await page.route('**/api/v1/arrivals/confirm', async (route) => {
        posted = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            contractsConfirmed: (posted as { rcvNos: string[] }).rcvNos.length,
            importVesselUpdated: false,
            importContainerUpdated: false,
            message: 'Data Saved Successfully',
          }),
        });
      });
    }

    // Development sign-in.
    await page.goto('/login');
    if (token) {
      await page.getByLabel('Dev bearer token').fill(token);
      await page.getByRole('button', { name: 'Use dev token' }).click();
    } else {
      await page.getByLabel('User name').fill(user);
      await page.getByRole('button', { name: 'Get dev token' }).click();
    }
    await expect(page.getByRole('button', { name: 'Use dev token' })).toBeHidden();
    await page.goto('/Data/ConfirmArrival');
    await expect(page.getByRole('heading', { level: 1, name: 'Confirm arrivals' })).toBeVisible();

    await page.getByRole('button', { name: 'Import' }).click();
    await page.getByTestId('load-contracts').click();
    await expect(page.getByTestId('load-summary')).toContainText('Loaded');

    // Keyboard-first: after the load the cursor is in the scan field. Scan the first container that has a
    // container no; with none, tick the first supplier line.
    const scan = page.getByRole('textbox', {
      name: 'Scan a container or supplier',
    });
    await expect(scan).toBeFocused();
    const labels = await page
      .getByRole('checkbox', { name: /^Container / })
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
    const containerNo = labels
      .map((l) => l.replace(/^Container /, ''))
      .find((n) => /^[A-Z]{4}\d{7}$/.test(n));
    if (containerNo) {
      await scan.fill(containerNo);
      await scan.press('Enter');
      await expect(page.getByTestId('pick-result')).toContainText(
        `Picked container ${containerNo}`,
      );
      await expect(page.getByRole('checkbox', { name: `Container ${containerNo}` })).toBeChecked();
    } else {
      await page
        .getByRole('checkbox', { name: /^Supplier / })
        .first()
        .check();
    }

    const pendingTotals = page.getByTestId('pending-totals');
    await expect(pendingTotals).not.toContainText('Contracts: 0');
    await page.getByRole('button', { name: 'Add all to selection' }).click();
    await expect(pendingTotals).toContainText('Contracts: 0');
    await expect(page.getByTestId('selected-summary')).not.toContainText('Contracts: 0');

    // Confirm without a date first: blocked, the date field says why.
    await page.getByTestId('confirm-arrival').click();
    await expect(page.getByText('Enter the arrival date and time')).toBeVisible();

    await page.getByRole('spinbutton', { name: 'Day' }).first().click();
    await page.keyboard.type('181020261430');
    await page.getByTestId('confirm-arrival').click();
    await expect(page.getByTestId('save-result')).toContainText('Arrival confirmed');

    if (!allowSave) {
      expect(posted).toMatchObject({ arrivalDate: '2026-10-18T14:30:00' });
      expect((posted as { rcvNos: string[] }).rcvNos.length).toBeGreaterThan(0);
      if (containerNo) {
        expect(posted).toMatchObject({ container: { containerNo } });
      }
    }
  });
});
