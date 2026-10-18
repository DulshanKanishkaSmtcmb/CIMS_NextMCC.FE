import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page, type Response } from '@playwright/test';

/**
 * The strangler gateway in a real browser: the API repo's deploy/dev-gateway (nginx on :8080 in front of the legacy
 * IIS Express build, the API and this SPA's build). One login across old and new pages, the pilot cookie, assets,
 * API auth, sign-out, legacy pass-through. Reads only: the Confirm Arrivals save is never clicked.
 *
 *   E2E_GATEWAY_URL      http://localhost:8080 (required, else the spec skips)
 *   E2E_DEV_TOKEN        DevJwt token for a PwInfo user (deploy/dev-gateway/new-dev-token.ps1 -OutFile ...)
 *   E2E_SCREENSHOT_DIR   where to save the screenshots (optional)
 */
const gateway = process.env.E2E_GATEWAY_URL ?? '';
const token = process.env.E2E_DEV_TOKEN ?? '';
const screenshotDir = process.env.E2E_SCREENSHOT_DIR ?? '';

async function shot(page: Page, name: string): Promise<void> {
  if (!screenshotDir) return;
  mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: join(screenshotDir, name), fullPage: true });
}

/** The first response for a path (redirects included), to read which app served it. */
function firstResponse(page: Page, path: string): Promise<Response> {
  return page.waitForResponse((r) => new URL(r.url()).pathname === path);
}

test.describe('dev gateway', () => {
  test.skip(!gateway || !token, 'Needs E2E_GATEWAY_URL and E2E_DEV_TOKEN.');
  test.use({ baseURL: gateway });

  test('one login across legacy and SPA pages, pilot flip, sign-out', async ({ page, context }) => {
    test.setTimeout(180_000);

    // (a) Without the pilot cookie /Data/ConfirmArrival is the legacy page: unauthenticated, it redirects to the
    // flipped /Account/Login, which is the SPA sign-in.
    const legacyFirst = firstResponse(page, '/Data/ConfirmArrival');
    await page.goto('/Data/ConfirmArrival');
    const redirect = await legacyFirst;
    expect(redirect.status()).toBe(302);
    expect(redirect.headers()['x-served-by']).toBe('legacy');
    await expect(page).toHaveURL(/\/Account\/Login\?ReturnUrl=%2FData%2FConfirmArrival$/);
    await expect(page.getByRole('button', { name: 'Use dev token' })).toBeVisible();
    await shot(page, '01-spa-login-at-account-login.png');

    // (d) Dev-token sign-in: the SPA calls POST /api/v1/legacy-session, then loads ReturnUrl in full; the gateway sends
    // it to legacy (no pilot cookie) and the legacy app accepts the API-issued cookie.
    const bridge = page.waitForResponse(
      (r) => r.url().endsWith('/api/v1/legacy-session') && r.request().method() === 'POST',
    );
    await page.getByLabel('Dev bearer token').fill(token);
    await page.getByRole('button', { name: 'Use dev token' }).click();
    expect((await bridge).status()).toBe(204);
    await expect(page).toHaveURL(`${gateway}/Data/ConfirmArrival`);
    await expect(page).toHaveTitle(/CIMS for Next MCC Operation/); // the legacy layout
    await expect(
      page.locator('h3.box-title', { hasText: 'Contract - Confirm Arrivals' }),
    ).toBeVisible();
    const cookie = (await context.cookies(gateway)).find(
      (c) => c.name === '.AspNet.ApplicationCookie',
    );
    expect(cookie).toMatchObject({
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    });
    await page.waitForLoadState('networkidle'); // Knockout fills the DC and Country lists
    await shot(page, '02-legacy-confirm-arrival-via-8080.png');

    // A legacy page with its Navbar (menu from CloudMenuAllocation) and the uid the legacy scripts use.
    const home = firstResponse(page, '/Home/Index');
    await page.goto('/Home/Index');
    expect((await home).status()).toBe(200);
    await expect(page).toHaveTitle(/CIMS for Next MCC Operation/);
    const uid = await page.locator('#txtMyUid').inputValue();
    expect(uid).not.toBe('');
    await page.waitForLoadState('networkidle');
    await shot(page, '03-legacy-home-via-8080.png');

    // (e) Legacy Web API through the gateway with the browser's cookie.
    const menu = await page.request.get(
      `/api/DataApi/getCloudMenuItems?uid=${encodeURIComponent(uid)}`,
    );
    expect(menu.status()).toBe(200);
    expect(((await menu.json()) as { dtMain: unknown[] }).dtMain.length).toBeGreaterThan(0);
    const qc = await page.request.get(
      `/api/DataApi/getQCPendingCount?strRtnPara=e2e&uid=${encodeURIComponent(uid)}`,
    );
    expect(qc.status()).toBe(200);

    // (a) Pilot on: the same path is now the SPA page (dev token still in this tab's sessionStorage).
    await page.goto('/pilot/on');
    await expect(page).toHaveURL(`${gateway}/Home/Index`);
    const spaFirst = firstResponse(page, '/Data/ConfirmArrival');
    const lookups = page.waitForResponse((r) => r.url().includes('/api/v1/arrivals/confirm/dcs'));
    await page.goto('/Data/ConfirmArrival');
    expect((await spaFirst).headers()['x-served-by']).toBe('spa');
    expect((await lookups).status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Contract - Confirm Arrivals' })).toBeVisible();
    await page.getByRole('combobox', { name: 'Shipment' }).click();
    await page.getByRole('option', { name: 'Import' }).click();
    await page.locator('#btnLoadPOs').click();
    await expect(page.getByText('Contracts Loaded successfully')).toBeVisible();
    await shot(page, '04-spa-confirm-arrival-pilot-via-8080.png');

    // Deep link / refresh of the flipped path stays on the SPA.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Contract - Confirm Arrivals' })).toBeVisible();

    // (b) Assets come from nginx with the one-year immutable cache.
    const script = await page.locator('script[type="module"][src^="/assets/"]').getAttribute('src');
    const asset = await page.request.get(script ?? '/assets/missing.js');
    expect(asset.status()).toBe(200);
    expect(asset.headers()['cache-control']).toMatch(/max-age=31536000/);
    expect(asset.headers()['cache-control']).toMatch(/immutable/);

    // (c) The API through the gateway: 401 without a token, 200 with it.
    expect((await page.request.get('/api/v1/reference/field-captions')).status()).toBe(401);
    const captions = await page.request.get('/api/v1/reference/field-captions', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(captions.status()).toBe(200);

    // (g) Sounds pass through to legacy.
    const sound = await page.request.get('/Sounds/bell_ring.mp3');
    expect(sound.status()).toBe(200);
    expect(sound.headers()['content-type']).toMatch(/audio/);

    // While the SPA session lives, a missing legacy cookie is re-issued on the way through /Account/Login.
    await context.clearCookies({ name: '.AspNet.ApplicationCookie' });
    await page.goto('/pilot/off');
    await expect(page).toHaveURL(`${gateway}/Home/Index`);
    await expect(page).toHaveTitle(/CIMS for Next MCC Operation/);

    // (f) Sign-out: DELETE legacy-session clears the cookie; with the SPA session gone too (sign-out clears both),
    // the legacy page sends the user to the sign-in page again.
    const signOut = await page.request.delete('/api/v1/legacy-session', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(signOut.status()).toBe(204);
    expect(
      (await context.cookies(gateway)).find((c) => c.name === '.AspNet.ApplicationCookie'),
    ).toBeUndefined();
    await page.evaluate(() => window.sessionStorage.clear());
    const afterSignOut = firstResponse(page, '/Home/Index');
    await page.goto('/Home/Index');
    expect((await afterSignOut).status()).toBe(302);
    await expect(page).toHaveURL(/\/Account\/Login\?ReturnUrl=%2FHome%2FIndex$/);
    await expect(page.getByRole('button', { name: 'Use dev token' })).toBeVisible();
    await shot(page, '05-signed-out-back-at-login.png');
  });
});
