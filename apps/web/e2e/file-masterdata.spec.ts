import { expect, test, type Page } from '@playwright/test';

/**
 * /File/Country, /File/Ports and /File/DC (legacy docs/15): open each page, list from the search dialogs, and save.
 * Needs the SPA (`npm run dev`, with VITE_API_BASE_URL pointing at the API), the API with a Test database, and a
 * DevJwt token for a PwInfo user in E2E_DEV_TOKEN. Skips when any of them is missing.
 *
 * Saves are intercepted and answered locally unless E2E_ALLOW_SAVE=1. With E2E_ALLOW_SAVE=1 the test really creates
 * and then changes one clearly named row per page (E2E_ROW, default "ZZT1") in the Test database; delete them again
 * with plain SQL afterwards (there is no delete in the application).
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:5173';
const apiURL = process.env.E2E_API_URL ?? 'http://localhost:5213';
const token = process.env.E2E_DEV_TOKEN ?? '';
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
  token !== '' && (await isReachable(baseURL)) && (await isReachable(`${apiURL}/health/live`));

async function signIn(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Dev bearer token').fill(token);
  await page.getByRole('button', { name: 'Use dev token' }).click();
}

async function chooseOption(page: Page, option: string) {
  await page.getByRole('combobox', { name: 'Option' }).click();
  await page.getByRole('option', { name: option }).click();
}

/** Opens a list dialog, filters the first column to `text`, and selects the only row. */
async function pickFromDialog(
  page: Page,
  buttonId: string,
  title: string,
  firstColumn: string,
  text: string,
) {
  await page.locator(`#${buttonId}`).click();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: `Search ${firstColumn}`, exact: true }).fill(text);
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
  test.skip(!ready, `Needs the SPA at ${baseURL}, the API at ${apiURL} and E2E_DEV_TOKEN.`);

  test('Country: list, validation messages, new and change', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/countries');
    await signIn(page);
    await page.goto('/File/Country');
    await expect(page.getByRole('heading', { name: 'Country Master Details' })).toBeVisible();

    // The listing dialog shows every Country column; New mode does not fill the form from it.
    await page.locator('#btnCountryCode').click();
    const dialog = page.getByRole('dialog', { name: 'Countries Listing' });
    await expect(dialog.getByText('CargoMovement').first()).toBeVisible({ timeout: 20_000 }); // first call can be slow
    await expect(dialog.getByText('INDIA')).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();

    if (runNew) {
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Enter Country Name')).toBeVisible();
      await page.locator('#CountryName').fill(`${row} COUNTRY`);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Enter Country Code')).toBeVisible();

      await page.locator('#CountryCode').fill(row);
      await page.locator('#CountryName').fill(`${row} COUNTRY`);
      await page.getByRole('combobox', { name: 'Cargo Movement' }).click();
      await page.getByRole('option', { name: 'Imports' }).click();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Data Saved Successfully')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    }

    if (runChange) {
      await chooseOption(page, 'Change');
      await pickFromDialog(page, 'btnCountryCode', 'Countries Listing', 'CountryCode', row);
      await expect(page.locator('#CountryName')).toHaveValue(`${row} COUNTRY`);
      await page.locator('#CountryName').fill(`${row} COUNTRY CHANGED`);
      await page.getByRole('combobox', { name: 'Cargo Movement' }).click();
      await page.getByRole('option', { name: 'Export' }).click();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Data Saved Successfully').last()).toBeVisible();
    } else if (!allowSave) {
      expect(posted[0]).toEqual({
        countryCode: row,
        countryName: `${row} COUNTRY`,
        cargoMovement: 'Imports',
      });
    }
  });

  test('Ports: pre-entered box, country picked from the list, new and change', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/ports');
    await signIn(page);
    await page.goto('/File/Ports');
    await expect(page.getByRole('heading', { name: 'Ports Master Details' })).toBeVisible();

    if (runNew) {
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Enter Port Name')).toBeVisible();

      // The first letter of a new name lists the existing ports that start with it.
      await page.locator('#PortName').pressSequentially('D');
      await expect(page.getByText('Pre-Entered Ports Listing')).toBeVisible();
      await page.locator('#PortName').fill(`${row} PORT`);
      await page.locator('#PortCode').fill(row);
      await page.locator('#IsDivertable').check();
      await pickFromDialog(page, 'btnCountryCode', 'Countries Listing', 'CountryCode', 'IND');
      await expect(page.locator('#CountryName')).toHaveValue(/INDIA/i);
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Data Saved Successfully')).toBeVisible();
    }

    if (runChange) {
      await chooseOption(page, 'Change');
      await pickFromDialog(page, 'btnPortCode', 'Ports Listing', 'PortCode', row);
      await expect(page.locator('#PortName')).toHaveValue(`${row} PORT`);
      await expect(page.locator('#IsDivertable')).toBeChecked();
      await page.locator('#PortName').fill(`${row} PORT CHANGED`);
      await page.locator('#IsDivertable').uncheck();
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Data Saved Successfully').last()).toBeVisible();
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
    await expect(page.getByRole('heading', { name: 'DC Master Details' })).toBeVisible();

    await page.locator('#btnDc').click();
    const dialog = page.getByRole('dialog', { name: 'DC Listing' });
    await expect(dialog.getByText('StockUpdate').first()).toBeVisible();
    await dialog.getByRole('button', { name: 'Close' }).click();

    if (runNew) {
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Enter DC Name')).toBeVisible();

      await page.locator('#WhDes').fill(`${row} DC`);
      await pickFromDialog(page, 'btnCountryCode', 'Countries Listing', 'CountryCode', 'IND');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Data Saved Successfully')).toBeVisible();
    }

    if (runChange) {
      await chooseOption(page, 'Change');
      await pickFromDialog(page, 'btnDc', 'DC Listing', 'WhDes', `${row} DC`);
      await expect(page.locator('#CountryCode')).toHaveValue('IND');
      await pickFromDialog(page, 'btnCountryCode', 'Countries Listing', 'CountryCode', 'PAK');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Data Saved Successfully').last()).toBeVisible();
    } else if (!allowSave) {
      expect(posted[0]).toEqual({ whDes: `${row} DC`, countryCode: 'IND' });
    }
  });
});
