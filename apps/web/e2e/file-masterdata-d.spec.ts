import { expect, test, type Page } from '@playwright/test';

/**
 * /File/RateCardEntry, /File/OkToLoadReason and the two Pallet Rack Build routes (legacy docs/18): open each page, check
 * the messages and the flow, and save. Needs the SPA (`npm run dev`, with VITE_API_BASE_URL pointing at the API), the API
 * with a Test database, and a DevJwt token for a PwInfo user in E2E_DEV_TOKEN. Skips when any of them is missing.
 *
 * Saves are intercepted and answered locally unless E2E_ALLOW_SAVE=1. With E2E_ALLOW_SAVE=1 the tests really write to the
 * Test database: E2E_DC (default "Aramex Fulfillment Centre", a DC without reasons) receives the reasons "ZZT1 A" (then its detail changed) and "ZZT1 B",
 * and the rack E2E_RACK (default "ZZT1") is created with three positions. Delete them again with plain SQL afterwards
 * (the application has no delete).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const apiURL = process.env.E2E_API_URL ?? 'http://localhost:5213';
const token = process.env.E2E_DEV_TOKEN ?? '';
const user = process.env.E2E_DEV_USER ?? '';
const allowSave = process.env.E2E_ALLOW_SAVE === '1';
const dc = process.env.E2E_DC ?? 'Aramex Fulfillment Centre';
const rack = process.env.E2E_RACK ?? 'ZZT1';

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

async function signIn(page: Page) {
  await page.goto('/login');
  if (token) {
    await page.getByLabel('Dev bearer token').fill(token);
    await page.getByRole('button', { name: 'Use dev token' }).click();
  } else {
    await page.getByLabel('User name').fill(user);
    await page.getByRole('button', { name: 'Get dev token' }).click();
  }
  await expect(page.getByRole('button', { name: 'Use dev token' })).toBeHidden();
}

/** Types into a numeric field and leaves it, which commits the value. */
async function setNumber(page: Page, label: string, value: string) {
  await page.getByRole('textbox', { name: label, exact: true }).fill(value);
  await page.keyboard.press('Tab');
}

/** Answers the page's writes locally unless E2E_ALLOW_SAVE=1; reads always go to the API. */
function interceptSaves(page: Page, urlPart: string, methods: string[]) {
  const posted: unknown[] = [];
  if (!allowSave) {
    void page.route(`**${urlPart}**`, async (route) => {
      const request = route.request();
      if (!methods.includes(request.method())) return route.continue();
      posted.push(request.postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Data Saved Successfully' }),
      });
    });
  }
  return posted;
}

test.describe('File master pages, wave 1d', () => {
  test.skip(
    !ready,
    `Needs the SPA at ${baseURL}, the API at ${apiURL} and E2E_DEV_TOKEN or E2E_DEV_USER.`,
  );

  test('Rate Card: three read-only tables, filters, Reload rates', async ({ page }) => {
    await signIn(page);
    await page.goto('/File/RateCardEntry');
    await expect(page.getByRole('heading', { level: 1, name: 'Rate card' })).toBeVisible();
    await expect(page.getByText('Read only', { exact: true })).toBeVisible();
    for (const title of ['Export clearance charges', 'Export freight charges', 'CFS charges']) {
      await expect(page.getByRole('heading', { level: 2, name: title })).toBeVisible();
    }
    const clearance = page.getByRole('table', { name: 'Export clearance charges' });
    await expect(clearance).toBeVisible({ timeout: 15_000 });
    await expect(clearance.getByRole('cell', { name: '20GP' })).toBeVisible();
    await expect(clearance.getByRole('cell', { name: '700.00' })).toBeVisible();
    const cfs = page.getByTestId('cfs-grid');
    await expect(cfs.locator('[role="row"][data-id]')).toHaveCount(10); // the 10 stored charges

    // the freight table lists every port × container type; the filter keeps the ones with a rate
    const freight = page.getByTestId('freight-grid');
    await page.getByRole('checkbox', { name: /Only ports with a rate/ }).check();
    await expect(freight.locator('[role="row"][data-id]')).toHaveCount(6);

    await page.getByRole('button', { name: 'Reload rates' }).click();
    await expect(cfs.locator('[role="row"][data-id]')).toHaveCount(10); // replaced, not appended
  });

  test('OK-to-Load Reason: first DC, allocated reason, new reason and save', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/ok-to-load-reasons', ['PUT']);
    await signIn(page);
    await page.goto('/File/OkToLoadReason');
    await expect(
      page.getByRole('heading', { level: 1, name: 'OK-to-load and hold reasons' }),
    ).toBeVisible();
    // the first DC is selected and its reasons are loaded when the page opens
    await expect(page.getByTestId('reason-count')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('combobox', { name: 'DC' })).toHaveText(/\S/);

    // a reason that contracts already carry cannot be removed: it says so instead of offering Remove
    await page.getByRole('combobox', { name: 'DC' }).click();
    await page.getByRole('option', { name: 'Zalora Online' }).click();
    await expect(page.getByText('Used by contracts').first()).toBeVisible();

    // add a reason to a DC that has none and save it
    await page.getByRole('combobox', { name: 'DC' }).click();
    await page.getByRole('option', { name: dc, exact: true }).click();
    await expect(page.getByTestId('reason-count')).toBeVisible();
    await page.getByRole('button', { name: 'Add reason' }).click();
    await page.getByRole('button', { name: 'Save reasons' }).click();
    await expect(page.getByTestId('save-problem')).toContainText('One reason has no text');
    await page.getByRole('textbox', { name: 'Reason 1' }).fill('ZZT1 A');
    await page.getByRole('textbox', { name: 'Details 1' }).fill('detail A');
    await page.getByRole('button', { name: 'Save reasons' }).click();
    await expect(page.getByTestId('save-result')).toContainText(`Saved 1 reason for ${dc}.`);
    if (!allowSave) {
      expect(posted).toEqual([{ dc, reasons: [{ reason: 'ZZT1 A', dtlReson: 'detail A' }] }]);
    } else {
      // change: the stored reason is read-only, its detail is edited, a second reason is added, the list is saved again
      await page.goto('/File/OkToLoadReason');
      await expect(page.getByRole('combobox', { name: 'DC' })).toHaveText(/\S/);
      await page.getByRole('combobox', { name: 'DC' }).click();
      await page.getByRole('option', { name: dc, exact: true }).click();
      const stored = page.getByRole('textbox', { name: 'Reason 1' });
      await expect(stored).toHaveValue('ZZT1 A');
      await expect(stored).toHaveAttribute('readonly', '');
      await page.getByRole('textbox', { name: 'Details 1' }).fill('detail A changed');
      await page.getByRole('button', { name: 'Add reason' }).click();
      await page.getByRole('textbox', { name: 'Reason 2' }).fill('ZZT1 B');
      await page.getByRole('textbox', { name: 'Details 2' }).fill('detail B');
      await page.getByRole('button', { name: 'Save reasons' }).click();
      await expect(page.getByTestId('save-result')).toContainText('Saved 2 reasons');
    }
  });

  test('Pallet Rack Build (/Data/PalletRackBuildArr): messages, layout, toggle, existing rack, save', async ({
    page,
  }) => {
    const posted = interceptSaves(page, '/master-data/pallet-racks', ['POST']);
    await signIn(page);
    await page.goto('/Data/PalletRackBuildArr');
    await expect(page.getByRole('heading', { name: 'Pallets Rack Build' })).toBeVisible();
    await expect(page.locator('#RackNo')).toHaveValue('A35');

    // the rack of the Test database exists: the legacy defaults cannot be saved as a new rack
    await page.locator('#btnLoadData').click();
    await expect(page.getByRole('group')).toHaveCount(39 * 8);
    await expect(page.locator('#TotPltPositions')).toHaveValue('312');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Pallet Rack Already Exist')).toBeVisible();

    // messages
    await page.locator('#RackNo').fill('');
    await page.locator('#RackNo').blur();
    await page.locator('#btnLoadData').click();
    await expect(page.getByText('Enter Rack No')).toBeVisible();
    await setNumber(page, 'No of Rows', '100');
    await page.locator('#RackNo').fill(rack);
    await page.locator('#RackNo').blur();
    await page.locator('#btnLoadData').click();
    await expect(page.getByText('Nof of Rows must be less than 99')).toBeVisible();

    // a new rack: 2 rows x 2 layers, one position switched off, saved with the other three
    await setNumber(page, 'No of Rows', '2');
    await setNumber(page, 'No of Layers', '2');
    await page.locator('#btnLoadData').click();
    await expect(page.getByRole('group')).toHaveCount(4);
    await page.getByRole('button', { name: `Disable ${rack}-02-02` }).click();
    await expect(page.locator('#TotPltPositions')).toHaveValue('3');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText('Data Saved Successfully')).toBeVisible();
    if (!allowSave) {
      expect(posted).toEqual([
        {
          rackNo: rack,
          nofRows: 2,
          nofLayers: 2,
          nofPositions: 3,
          positions: [`${rack}-01-01`, `${rack}-01-02`, `${rack}-02-01`],
        },
      ]);
    }

    // View loads the stored layout of the rack
    await page.getByRole('combobox', { name: 'Entry Type' }).click();
    await page.getByRole('option', { name: 'View' }).click();
    await page.locator('#btnRackNo').click();
    const dialog = page.getByRole('dialog', { name: 'Pallets Area Listing' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Select' }).first().click();
    await expect(page.locator('#RackNo')).toHaveValue('A35');
    await page.getByRole('button', { name: 'Load Pallet Position Layout' }).click();
    await expect(page.getByRole('group')).toHaveCount(39 * 8);
    await expect(page.locator('#TotPltPositions')).toHaveValue('312');
  });

  test('Pallet Rack Build (/File/PalletRackBuild) is the same page', async ({ page }) => {
    await signIn(page);
    await page.goto('/File/PalletRackBuild');
    await expect(page.getByRole('heading', { name: 'Pallets Rack Build' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Create Pallet Position Layout' })).toBeVisible();
  });
});
