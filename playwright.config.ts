import { defineConfig, devices } from '@playwright/test';

/**
 * E2E config for the Merkoll storefront platform.
 *
 * Hosts used by the app:
 *   - apex:   http://localhost:3000           (marketing landing, /signup, /partner, /store/<schema>)
 *   - tenant: http://demo.localhost:3000      (workspace dashboard, requires login)
 *
 * The dev server must already be running (npm run dev) OR set PW_WEBSERVER=1 to
 * let Playwright boot it. Tenant-auth specs are skipped unless PW_TENANT=1 so the
 * smoke suite stays green without a seeded backend.
 */
const PORT = Number(process.env.PW_PORT || 3000);
const BASE = process.env.PW_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: process.env.PW_WEBSERVER
    ? {
        command: 'npm run dev',
        url: BASE,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      }
    : undefined,
});
