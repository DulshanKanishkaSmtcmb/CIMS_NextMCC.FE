import { expect, test, type Page } from '@playwright/test';

/**
 * /File/Supplier and /File/PmSupplier (legacy docs/16, redesign docs/19 section 14): open each page, find a record,
 * check the validation, and save. Needs the SPA (`npm run dev`, with VITE_API_BASE_URL or DEV_API_PROXY_TARGET
 * pointing at the API), the API with a Test database, and a DevJwt token in E2E_DEV_TOKEN or a PwInfo user name in
 * E2E_DEV_USER. Skips when any of them is missing. Selectors: roles, labels and data-testid.
 *
 * Saves are intercepted and answered locally unless E2E_ALLOW_SAVE=1. With E2E_ALLOW_SAVE=1 the test really creates
 * and then changes one clearly named row per page (E2E_ROW, default "ZZT1": the names are "ZZT1 SUPPLIER" and
 * "ZZT1 PM SUPPLIER"; the server generates their codes) in the Test database; delete them again with plain SQL
 * afterwards (there is no delete in the application).
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

async function chooseOption(page: Page, option: string) {
  await page.getByRole('combobox', { name: 'Option' }).click();
  await page.getByRole('option', { name: option }).click();
}

/** Opens a list dialog, filters one column to `text`, and selects the first row. */
async function pickFromDialog(
  page: Page,
  buttonId: string,
  title: string,
  column: string,
  text: string,
) {
  await page.locator(`#${buttonId}`).click();
  const dialog = page.getByRole('dialog', { name: title });
  await expect(dialog).toBeVisible();
  await dialog.getByRole('textbox', { name: `Search ${column}`, exact: true }).fill(text);
  await dialog.getByRole('button', { name: 'Select' }).first().click();
  await expect(dialog).toBeHidden();
}

function interceptSaves(page: Page, urlPart: string, codeKey: string) {
  const posted: unknown[] = [];
  if (!allowSave) {
    void page.route(`**${urlPart}**`, async (route) => {
      const request = route.request();
      if (request.method() !== 'POST' && request.method() !== 'PUT') return route.continue();
      posted.push(request.postDataJSON());
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ [codeKey]: 'Z9999', message: 'Data Saved Successfully' }),
      });
    });
  }
  return posted;
}

test.describe('File supplier pages', () => {
  test.skip(
    !ready,
    `Needs the SPA at ${baseURL}, the API at ${apiURL} and E2E_DEV_TOKEN or E2E_DEV_USER.`,
  );

  test('Supplier: similar names, country and shipper lookups, new and change', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/suppliers', 'supplierCode');
    await signIn(page);
    await page.goto('/File/Supplier');
    await expect(page.getByRole('heading', { level: 1, name: 'Suppliers' })).toBeVisible();
    const list = page.getByRole('list', { name: 'Suppliers' });
    await expect(list.getByRole('button').first()).toBeVisible({ timeout: 20_000 }); // first call can be slow

    if (runNew) {
      await page.getByRole('button', { name: 'New supplier' }).first().click();

      // The sea and air shipper lists come from the sibling freight systems: a dialog, or the "cannot be reached"
      // message under the field where this environment has no connection to them.
      await page.getByRole('button', { name: 'Search sea shippers' }).click();
      const seaDialog = page.getByRole('dialog', { name: 'Sea shippers (SFOS)' });
      await expect(
        seaDialog.or(page.getByText('The sea freight system (SFOS) cannot be reached now.')),
      ).toBeVisible();
      if (await seaDialog.isVisible())
        await seaDialog.getByRole('button', { name: 'Close' }).click();

      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-problems')).toContainText('Enter the supplier name');

      // The first letter of a new name lists the existing suppliers that start with it.
      await page.getByRole('textbox', { name: 'Supplier name' }).pressSequentially('S');
      await expect(page.getByTestId('similar-names')).toBeVisible();
      await page.getByRole('textbox', { name: 'Supplier name' }).fill(`${row} SUPPLIER`);
      await page.getByRole('textbox', { name: 'Address line 1' }).fill('1 Test Road');
      await page.getByRole('textbox', { name: 'Telephone no' }).fill('011 000 0000');
      await page.getByRole('textbox', { name: 'REX no' }).fill('ZZREX');
      await pickCountry(page, 'IND');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText('Supplier created with code Z');
      await expect(page.getByRole('textbox', { name: 'Supplier code' })).toHaveValue(/^Z\d{4}$/);
      await expect(page.getByRole('button', { name: 'Save' })).toHaveCount(0);
    }

    if (runChange) {
      const search = page.getByRole('searchbox', { name: 'Search suppliers' });
      await search.fill(`${row} SUPPLIER`);
      await list
        .getByRole('button', { name: new RegExp(`${row} SUPPLIER`) })
        .first()
        .click();
      await expect(page.getByRole('textbox', { name: 'Supplier name' })).toHaveValue(
        `${row} SUPPLIER`,
      );
      await expect(page.getByRole('textbox', { name: 'Address line 1' })).toHaveValue(
        '1 Test Road',
      );
      await expect(page.getByRole('textbox', { name: /^Country/ })).toHaveValue('IND');
      await page.getByRole('button', { name: 'Edit' }).click();
      await page.getByRole('textbox', { name: 'Supplier name' }).fill(`${row} SUPPLIER CHANGED`);
      await page.getByRole('textbox', { name: 'Telephone no' }).fill('011 111 1111');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByTestId('save-result')).toContainText('saved.');
    } else if (!allowSave) {
      expect(posted[0]).toMatchObject({
        shipperName: `${row} SUPPLIER`,
        shipperAddress1: '1 Test Road',
        shipperTel: '011 000 0000',
        countryCode: 'IND',
        rexNo: 'ZZREX',
      });
    }
  });

  test('PM Supplier: country picker, new and change', async ({ page }) => {
    const posted = interceptSaves(page, '/master-data/pm-suppliers', 'pmSupplierCode');
    await signIn(page);
    await page.goto('/File/PmSupplier');
    await expect(page.getByRole('heading', { name: 'PM Suppliers Master Details' })).toBeVisible();
    // no search button on the code in New mode
    await expect(page.locator('#btnSupplierCode')).toHaveCount(0);

    if (runNew) {
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Enter Supplier Name')).toBeVisible();

      await page.getByRole('textbox', { name: 'Supplier Name' }).fill(`${row} PM SUPPLIER`);
      await page.getByRole('textbox', { name: 'Contact Person 1' }).fill('Test Person');
      await pickFromDialog(page, 'btnCountryCode', 'Country Listing', 'CountryCode', 'LKA');
      await expect(page.locator('#CountryName')).not.toHaveValue('');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Data Saved Successfully')).toBeVisible();
      await expect(page.locator('#SupplierCode')).toHaveValue(/^Z\d{4}$/);
    }

    if (runChange) {
      await chooseOption(page, 'Change');
      await pickFromDialog(
        page,
        'btnSupplierCode',
        'Supplier Listing',
        'PMSupplierName',
        `${row} PM SUPPLIER`,
      );
      await expect(page.getByRole('textbox', { name: 'Supplier Name' })).toHaveValue(
        `${row} PM SUPPLIER`,
      );
      await expect(page.locator('#CountryCode')).toHaveValue('LKA');
      await page.getByRole('textbox', { name: 'Supplier Name' }).fill(`${row} PM SUPPLIER CHANGED`);
      await page.getByRole('textbox', { name: 'Contact Person 1' }).fill('Other Person');
      await page.getByRole('button', { name: 'Save' }).click();
      await expect(page.getByText('Data Saved Successfully').last()).toBeVisible();
    } else if (!allowSave) {
      expect(posted[0]).toMatchObject({
        pmSupplierName: `${row} PM SUPPLIER`,
        pmSupplierContact1: 'Test Person',
        countryCode: 'LKA',
      });
    }
  });
});
