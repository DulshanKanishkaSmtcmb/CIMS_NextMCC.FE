import { expect, test, type Page } from '@playwright/test';

/**
 * /File/PMMaster and /File/ProductCategory (legacy docs/17, redesign docs/19 section 14): open each page, check the
 * validation messages, and save. Needs the SPA (`npm run dev`, with VITE_API_BASE_URL or DEV_API_PROXY_TARGET pointing
 * at the API), the API with a Test database, and a DevJwt token in E2E_DEV_TOKEN or a PwInfo user name in E2E_DEV_USER.
 * Skips when any of them is missing. Selectors: roles, labels and data-testid.
 *
 * Saves are intercepted and answered locally unless E2E_ALLOW_SAVE=1. With E2E_ALLOW_SAVE=1 the test really creates
 * (and, for PM Master, changes) one clearly named row per page in the Test database: E2E_ROW (default "ZZT1") is the
 * PM code, E2E_CHAIN (default "Z") the one-character chain code. Delete them again with plain SQL afterwards (there is
 * no delete in the application). E2E_PHASE=new or change runs only that half of the PM Master flow.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const apiURL = process.env.E2E_API_URL ?? 'http://localhost:5213';
const token = process.env.E2E_DEV_TOKEN ?? '';
const user = process.env.E2E_DEV_USER ?? '';
const allowSave = process.env.E2E_ALLOW_SAVE === '1';
const row = process.env.E2E_ROW ?? 'ZZT1';
const chain = process.env.E2E_CHAIN ?? 'Z';
const phase = process.env.E2E_PHASE ?? 'both';
const runNew = phase !== 'change';
const runChange = allowSave && phase !== 'new';

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

function interceptSaves(page: Page, urlPart: string) {
  const posted: unknown[] = [];
  if (!allowSave) {
    void page.route(`**${urlPart}**`, async (route) => {
      const request = route.request();
      if (request.method() !== 'POST' && request.method() !== 'PUT') return route.continue();
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

test.describe('File master pages, wave 1c', () => {
  test.skip(
    !ready,
    `Needs the SPA at ${baseURL}, the API at ${apiURL} and E2E_DEV_TOKEN or E2E_DEV_USER.`,
  );

  test('PM Master: list, validation messages, new and change', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/pm-masters');
    await signIn(page);
    await page.goto('/File/PMMaster');
    await expect(page.getByRole('heading', { level: 1, name: 'Packing materials' })).toBeVisible();
    const list = page.getByRole('list', { name: 'Packing materials' });
    await expect(list.getByRole('button').first()).toBeVisible({ timeout: 20_000 });

    if (runNew) {
      await page.getByRole('button', { name: 'New packing material' }).first().click();
      // the first PMCategories row is preselected
      await expect(page.getByRole('combobox', { name: 'PM category' })).not.toBeEmpty();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-problems')).toContainText('Enter the description');
      await page.getByRole('textbox', { name: 'Description' }).fill(`${row} PM`);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-problems')).toContainText(
        'Enter the packing material code',
      );

      await page.getByRole('textbox', { name: 'Packing material code' }).fill(row);
      await page.getByRole('combobox', { name: 'PM category' }).click();
      await page.getByRole('option', { name: 'Hanger' }).click();
      await setNumber(page, 'Reorder level', '100');
      await setNumber(page, 'Weight (g)', '12');
      await setNumber(page, 'CBM', '3');
      await page.getByRole('checkbox', { name: 'Get parts count' }).check();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText(
        `Packing material ${row} created.`,
      );
      await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
    }

    if (runChange) {
      const search = page.getByRole('searchbox', { name: 'Search packing materials' });
      await search.fill(row);
      await search.press('Enter');
      await expect(page.getByRole('textbox', { name: 'Description' })).toHaveValue(`${row} PM`);
      await expect(page.getByRole('textbox', { name: 'Reorder level' })).toHaveValue('100');
      await expect(page.getByRole('textbox', { name: 'Get parts count' })).toHaveValue('Yes');
      await page.getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('textbox', { name: 'Description' }).fill(`${row} PM CHANGED`);
      await page.getByRole('combobox', { name: 'PM category' }).click();
      await page.getByRole('option', { name: 'Carton' }).click();
      await setNumber(page, 'Reorder level', '200');
      await setNumber(page, 'Weight (g)', '15');
      await setNumber(page, 'CBM', '4');
      await page.getByRole('checkbox', { name: 'Get parts count' }).uncheck();
      await page.getByRole('checkbox', { name: 'Get jokers count' }).check();
      await page.getByRole('checkbox', { name: 'Active' }).uncheck();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText(`Packing material ${row} saved.`);
    } else if (!allowSave) {
      expect(posted[0]).toMatchObject({
        pmCode: row,
        pmDescription: `${row} PM`,
        pmCategory: 'Hanger',
        reorderLevel: 100,
        pmWeight: 12,
        cbm: 3,
        getJokersCount: false,
        getPartsCount: true,
        isActive: true,
      });
    }
  });

  test('Product Category: list, validation messages and a new chain code', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/product-categories');
    await signIn(page);
    await page.goto('/File/ProductCategory');
    await expect(page.getByRole('heading', { level: 1, name: 'Chain codes' })).toBeVisible();
    // the existing chain codes are listed
    const grid = page.getByTestId('chain-code-grid');
    await expect(grid.getByText('Chain code').first()).toBeVisible({ timeout: 20_000 });
    await expect(grid.getByText('Childrensware').first()).toBeVisible();

    const addButton = page.getByRole('button', { name: 'Add chain code' });
    await addButton.click();
    await expect(page.getByTestId('save-problems')).toContainText('Enter the chain code');
    await page.getByRole('textbox', { name: /^Chain code/ }).fill('a');
    await page.getByRole('textbox', { name: 'Chain name' }).fill('Duplicate test');
    await page.getByRole('textbox', { name: 'TP partner name' }).fill('NEXT');
    await page.getByRole('textbox', { name: 'Range box EAN' }).fill('DUP');
    await addButton.click();
    await expect(page.getByTestId('save-problems')).toContainText('is already used by');

    await page.getByRole('textbox', { name: /^Chain code/ }).fill(chain);
    await page.getByRole('textbox', { name: 'Chain name' }).fill(`${row} CHAIN`);
    await page.getByRole('textbox', { name: 'TP partner name' }).fill('ZZT');
    await page.getByRole('textbox', { name: 'Range box EAN' }).fill('ZZT');
    await addButton.click();
    await expect(page.getByTestId('save-result')).toContainText(`Chain code ${chain}`);
    await expect(page.getByRole('textbox', { name: /^Chain code/ })).toHaveValue('');
    if (allowSave) {
      await expect(page.getByText(`${row} CHAIN`)).toBeVisible();
    } else {
      expect(posted[0]).toEqual({
        chainCode: chain,
        chainName: `${row} CHAIN`,
        range: expect.any(String),
        tpPartnerName: 'ZZT',
        rangeBoxEan: 'ZZT',
      });
    }
  });
});
