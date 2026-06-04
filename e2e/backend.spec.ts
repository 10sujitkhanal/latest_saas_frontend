import { test, expect } from '@playwright/test';

/**
 * Backend-dependent journeys. These require the Django API running AND the demo
 * tenants seeded (manage.py seed_retail_demo etc). They are skipped unless
 * PW_TENANT=1 so the default smoke run stays green on a bare frontend.
 *
 * Host note: the app distinguishes apex vs tenant by hostname, so tenant specs
 * drive demo.localhost:<port> rather than localhost.
 */
const RUN = !!process.env.PW_TENANT;
const PORT = process.env.PW_PORT || '3000';
const tenantURL = (path: string) => `http://demo.localhost:${PORT}${path}`;

test.describe('public storefront (demo / General Retail)', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('store page loads with listings', async ({ page }) => {
    await page.goto(`/store/demo`);
    // Storefront name + at least one listing card or an empty-but-valid store
    await expect(page.locator('body')).not.toContainText('Page not found');
    await expect(page.getByText(/add to cart|order|buy/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('cross-sell rail appears and adding an item updates it', async ({ page }) => {
    await page.goto('/store/demo');
    // Empty cart → "You may also like" rail (recommendations endpoint).
    await expect(page.getByRole('heading', { name: /You may also like/i })).toBeVisible({ timeout: 15_000 });
    // Add the first product; the rail switches to "Frequently bought together".
    await page.getByRole('button', { name: /^Add$/ }).first().click();
    await expect(page.getByRole('heading', { name: /Frequently bought together/i })).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('tenant login → dashboard', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('demo admin can sign in and reach the workspace', async ({ page }) => {
    await page.goto(tenantURL('/auth/login'));
    // Login fields use placeholders rather than associated <label for>.
    await page.getByPlaceholder(/@/).fill('demo@morefungi.com');
    await page.getByPlaceholder('••••••••').fill('DemoPass123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|w\/)/, { timeout: 20_000 });
    await expect(page.locator('body')).not.toContainText('Invalid credentials');
  });
});

test.describe('Sales / Quotes page', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('quotes page renders for demo (Sales service granted)', async ({ page }) => {
    await page.goto(tenantURL('/auth/login'));
    await page.getByPlaceholder(/@/).fill('demo@morefungi.com');
    await page.getByPlaceholder('••••••••').fill('DemoPass123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|w\/)/, { timeout: 20_000 });

    await page.goto(tenantURL('/w/1/sales/quotes'));
    await expect(page.getByRole('heading', { name: 'Quotes' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /New quote/i })).toBeVisible();
    // The quote we created via the API smoke should be listed.
    await expect(page.getByText(/QT-2026-/).first()).toBeVisible();
    // PDF + Email delivery actions are offered per quote.
    await expect(page.getByRole('button', { name: /^PDF$/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Email$/ }).first()).toBeVisible();
  });
});

test.describe('Storefront / Membership QR', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('QR card renders on the storefront setup page (demo store is open)', async ({ page }) => {
    await page.goto(tenantURL('/auth/login'));
    await page.getByPlaceholder(/@/).fill('demo@morefungi.com');
    await page.getByPlaceholder('••••••••').fill('DemoPass123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|w\/)/, { timeout: 20_000 });

    await page.goto(tenantURL('/w/1/marketplace/storefront'));
    // Demo sells memberships, so the card titles as "Membership QR".
    await expect(page.getByRole('heading', { name: /Membership QR|Storefront QR/ })).toBeVisible({ timeout: 15_000 });
    // The generated QR image (base64 PNG data URL) renders.
    await expect(page.getByRole('img', { name: /Storefront QR code/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /Download PNG/i })).toBeVisible();
  });
});

test.describe('Membership renewal (recurring revenue)', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('memberships page exposes a Renew + bill action', async ({ page }) => {
    await page.goto(tenantURL('/auth/login'));
    await page.getByPlaceholder(/@/).fill('demo@morefungi.com');
    await page.getByPlaceholder('••••••••').fill('DemoPass123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|w\/)/, { timeout: 20_000 });

    await page.goto(tenantURL('/w/1/loyalty/memberships'));
    await expect(page.getByRole('heading', { name: 'Memberships' })).toBeVisible({ timeout: 15_000 });
    // Demo has a membership (MEM-2026-xxxx) → a Renew + bill action is offered.
    await expect(page.getByRole('button', { name: /Renew \+ bill/i }).first()).toBeVisible({ timeout: 15_000 });
  });

  test('subscription insights shows MRR + active members', async ({ page }) => {
    await page.goto(tenantURL('/auth/login'));
    await page.getByPlaceholder(/@/).fill('demo@morefungi.com');
    await page.getByPlaceholder('••••••••').fill('DemoPass123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|w\/)/, { timeout: 20_000 });

    await page.goto(tenantURL('/w/1/loyalty/insights'));
    await expect(page.getByRole('heading', { name: /Subscription insights/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('MRR', { exact: true }).first()).toBeVisible();
    await expect(page.getByText(/ARR/)).toBeVisible();
    await expect(page.getByText('Active members')).toBeVisible();
    await expect(page.getByText('Revenue by plan')).toBeVisible();
  });
});

test.describe('Workspace business-health home', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('home shows the business-health band (MRR, receivable, orders)', async ({ page }) => {
    await page.goto(tenantURL('/auth/login'));
    await page.getByPlaceholder(/@/).fill('demo@morefungi.com');
    await page.getByPlaceholder('••••••••').fill('DemoPass123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|w\/)/, { timeout: 20_000 });

    await page.goto(tenantURL('/w/1'));
    await expect(page.getByRole('heading', { name: /Business health/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Collected (MTD)')).toBeVisible();
    await expect(page.getByText('Receivable')).toBeVisible();
    await expect(page.getByText('Orders (MTD)')).toBeVisible();
  });
});

test.describe('Dunning (overdue reminders)', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('overdue invoice offers a Remind action', async ({ page }) => {
    await page.goto(tenantURL('/auth/login'));
    await page.getByPlaceholder(/@/).fill('demo@morefungi.com');
    await page.getByPlaceholder('••••••••').fill('DemoPass123!');
    await page.getByRole('button', { name: /sign in|log in/i }).click();
    await page.waitForURL(/\/(dashboard|w\/)/, { timeout: 20_000 });

    await page.goto(tenantURL('/w/1/accounting/invoices'));
    await expect(page.getByRole('heading', { name: 'Invoices' })).toBeVisible({ timeout: 15_000 });
    // The backdated unpaid invoice (flagged overdue) exposes a Remind action.
    await expect(page.getByRole('button', { name: /^Remind$/ }).first()).toBeVisible({ timeout: 15_000 });
  });
});

test.describe('MoreDealsX feed', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('content filters incl. Memberships; Join deep-links into a store', async ({ page }) => {
    await page.goto('/deals');
    await expect(page.getByRole('heading', { name: 'MoreDealsX' })).toBeVisible({ timeout: 15_000 });
    // Content-type filter chips render (memberships is the on-theme add).
    const membershipsChip = page.getByRole('button', { name: /^Memberships/ });
    await expect(membershipsChip).toBeVisible({ timeout: 15_000 });
    await membershipsChip.click();
    // A business with a public plan (Demo / SwedeVital) exposes a Join link → store?join=1.
    const join = page.getByRole('link', { name: /^Join$/ }).first();
    await expect(join).toBeVisible({ timeout: 15_000 });
    await expect(join).toHaveAttribute('href', /\/store\/.+\?join=1/);
  });
});

test.describe('public invoice pay page', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('invalid token renders the unavailable state', async ({ page }) => {
    await page.goto(tenantURL('/invoice/demo/00000000-0000-0000-0000-000000000000'));
    await expect(page.getByRole('heading', { name: /Invoice unavailable/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Nothing here')).toHaveCount(0);
  });
});

test.describe('public quote accept link', () => {
  test.skip(!RUN, 'set PW_TENANT=1 with a seeded backend to run');

  test('invalid token renders the unavailable state (route + gate bypass work)', async ({ page }) => {
    // No auth — /quote/* is a public prefix; an unknown token resolves to the
    // graceful "Quote unavailable" panel rather than the org gate or a crash.
    await page.goto(tenantURL('/quote/demo/00000000-0000-0000-0000-000000000000'));
    await expect(page.getByRole('heading', { name: /Quote unavailable/i })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Nothing here')).toHaveCount(0);
  });
});
