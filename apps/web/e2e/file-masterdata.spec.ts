import { expect, test, type Page } from '@playwright/test';

/**
 * /File/Country, /File/Ports and /File/DC (legacy docs/15, redesign docs/19 section 14): open each page, find a
 * record, check the validation messages, and save. Needs the SPA (`npm run dev`, with VITE_API_BASE_URL or
 * DEV_API_PROXY_TARGET pointing at the API), the API with a Test database, and a DevJwt token for a PwInfo user in
 * E2E_DEV_TOKEN or a PwInfo user name in E2E_DEV_USER. Skips when any of them is missing. Selectors: roles, labels
 * and data-testid (the redesigned pages have no legacy element ids).
 *
 * Saves are intercepted and answered locally unless E2E_ALLOW_SAVE=1. With E2E_ALLOW_SAVE=1 the test really creates
 * and then changes one clearly named row per page (E2E_ROW, default "ZZT1") in the Test database; delete them again
 * with plain SQL afterwards (there is no delete in the application).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const apiURL = process.env.E2E_API_URL ?? 'http://localhost:5213';
const token = process.env.E2E_DEV_TOKEN ?? '';
const user = process.env.E2E_DEV_USER ?? '';
const allowSave = process.env.E2E_ALLOW_SAVE === '1';
const row = process.env.E2E_ROW ?? 'ZZT1';
// E2E_PHASE=new or change runs only that half of the saving flow (to snapshot the database in between).
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

/** The country lookup inside a form: search button, filter the code column, select the first row. */
async function pickCountry(page: Page, code: string) {
  await page.getByRole('button', { name: 'Search countries' }).click();
  const dialog = page.getByRole('dialog', { name: 'Countries' });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Search Country code', exact: true }).fill(code);
  await dialog.getByRole('button', { name: 'Select' }).first().click();
  await expect(dialog).toBeHidden();
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

test.describe('File master pages', () => {
  test.skip(
    !ready,
    `Needs the SPA at ${baseURL}, the API at ${apiURL} and E2E_DEV_TOKEN or E2E_DEV_USER.`,
  );

  test('Country: list, validation messages, new and change', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/countries');
    await signIn(page);
    await page.goto('/File/Country');
    await expect(page.getByRole('heading', { level: 1, name: 'Countries' })).toBeVisible();

    // The list is the way to find a country (it replaced the Option select and the "Countries Listing" dialog).
    const list = page.getByRole('list', { name: 'Countries' });
    await expect(list.getByRole('button', { name: /INDIA/ })).toBeVisible({ timeout: 20_000 }); // first call can be slow
    const search = page.getByRole('searchbox', { name: 'Search countries' });
    await search.fill('IND');
    await search.press('Enter');
    await expect(page.getByRole('textbox', { name: 'Country name' })).toHaveValue('INDIA');
    await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0); // view mode has no Save
    await search.fill('');

    if (runNew) {
      await page.getByRole('button', { name: 'New country' }).first().click();
      await page.getByRole('button', { name: 'Save' }).click();
      const problems = page.getByTestId('save-problems');
      await expect(problems).toContainText('Enter the country name');
      await expect(problems).toContainText('Enter the country code');

      await page.getByRole('textbox', { name: 'Country code' }).fill(row);
      await page.getByRole('textbox', { name: 'Country name' }).fill(`${row} COUNTRY`);
      await page.getByRole('button', { name: 'Imports', exact: true }).click();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText(`Country ${row} created.`);
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible();
    }

    if (runChange) {
      await search.fill(row);
      await search.press('Enter');
      await expect(page.getByRole('textbox', { name: 'Country name' })).toHaveValue(
        `${row} COUNTRY`,
      );
      await page.getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('textbox', { name: 'Country name' }).fill(`${row} COUNTRY CHANGED`);
      await page.getByRole('button', { name: 'Export', exact: true }).click();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText(`Country ${row} saved.`);
    } else if (!allowSave) {
      expect(posted[0]).toEqual({
        countryCode: row,
        countryName: `${row} COUNTRY`,
        cargoMovement: 'Imports',
      });
    }
  });

  test('Ports: similar names, country picked from the list, new and change', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/ports');
    await signIn(page);
    await page.goto('/File/Ports');
    await expect(page.getByRole('heading', { level: 1, name: 'Ports' })).toBeVisible();
    const list = page.getByRole('list', { name: 'Ports' });
    await expect(list.getByRole('button').first()).toBeVisible({ timeout: 20_000 });

    if (runNew) {
      await page.getByRole('button', { name: 'New port' }).first().click();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-problems')).toContainText('Enter the port name');

      // The first letter of a new name lists the existing ports that start with it.
      await page.getByRole('textbox', { name: 'Port name' }).pressSequentially('D');
      await expect(page.getByTestId('similar-names')).toBeVisible();
      await page.getByRole('textbox', { name: 'Port name' }).fill(`${row} PORT`);
      await page.getByRole('textbox', { name: 'Port code' }).fill(row);
      await page.getByRole('checkbox', { name: 'Divertable' }).check();
      await pickCountry(page, 'IND');
      await expect(page.getByRole('textbox', { name: 'Country', exact: false })).toHaveValue('IND');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText(`Port ${row} created.`);
    }

    if (runChange) {
      const search = page.getByRole('searchbox', { name: 'Search ports' });
      await search.fill(row);
      await search.press('Enter');
      await expect(page.getByRole('textbox', { name: 'Port name' })).toHaveValue(`${row} PORT`);
      await expect(page.getByRole('textbox', { name: 'Divertable' })).toHaveValue('Yes');
      await page.getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('textbox', { name: 'Port name' }).fill(`${row} PORT CHANGED`);
      await page.getByRole('checkbox', { name: 'Divertable' }).uncheck();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText(`Port ${row} saved.`);
    } else if (!allowSave) {
      expect(posted[0]).toEqual({
        portCode: row,
        portName: `${row} PORT`,
        countryCode: 'IND',
        isDivertable: true,
      });
    }
  });

  test('DC: list, new and change', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/dcs');
    await signIn(page);
    await page.goto('/File/DC');
    await expect(page.getByRole('heading', { level: 1, name: 'DCs' })).toBeVisible();
    const list = page.getByRole('list', { name: 'DCs' });
    await expect(list.getByRole('button').first()).toBeVisible({ timeout: 20_000 });

    // Every DestWarehouse column is still visible for reference, in the open DC's settings.
    await list.getByRole('button').first().click();
    await expect(page.getByTestId('dc-settings')).toContainText('Stock update');

    if (runNew) {
      await page.getByRole('button', { name: 'New DC' }).first().click();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-problems')).toContainText('Enter the DC name');

      await page.getByRole('textbox', { name: 'DC name' }).fill(`${row} DC`);
      await pickCountry(page, 'IND');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText(`DC ${row} DC created.`);
    }

    if (runChange) {
      const search = page.getByRole('searchbox', { name: 'Search DCs' });
      await search.fill(`${row} DC`);
      await search.press('Enter');
      await expect(page.getByRole('textbox', { name: 'Country' })).toHaveValue('IND');
      await page.getByRole('button', { name: 'Edit' }).click();
      await pickCountry(page, 'PAK');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText(`DC ${row} DC saved.`);
    } else if (!allowSave) {
      expect(posted[0]).toEqual({ whDes: `${row} DC`, countryCode: 'IND' });
    }
  });
});
