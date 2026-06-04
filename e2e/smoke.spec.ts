import { test, expect } from '@playwright/test';

/**
 * Apex (localhost:3000) public-surface smoke tests.
 * These need only the frontend running — no backend/seed required.
 */

test.describe('apex public surface', () => {
  test('landing renders hero + primary CTAs', async ({ page }) => {
    await page.goto('/');
    // Brand + hero headline
    await expect(page.getByRole('banner').getByText('Merkoll')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Run your business/i })).toBeVisible();
    // Primary conversion CTAs
    await expect(page.getByRole('link', { name: /Start your business free/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Become a partner/i })).toBeVisible();
    // Trial promise
    await expect(page.getByText(/14-day Pro trial/i).first()).toBeVisible();
  });

  test('signup page shows industry picker', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByRole('heading', { name: /Start your business/i })).toBeVisible();
    await expect(page.getByText('Business name')).toBeVisible();
    await expect(page.getByText('Industry', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Create my business/i })).toBeVisible();
  });

  test('signup validates required fields before submit', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: /Create my business/i }).click();
    await expect(page.getByText(/Enter your business name\./i)).toBeVisible();
  });

  test('"Become a partner" links out to the separate agency app', async ({ page }) => {
    await page.goto('/');
    // The agency portal is its own app (latest_agency); the landing only links to it.
    const partner = page.getByRole('link', { name: /Become a partner/i });
    await expect(partner).toBeVisible();
    await expect(partner).toHaveAttribute('href', /agency\..*\/signup|\/signup/);
  });

  test('unknown route renders the styled 404', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByRole('link', { name: /Go to homepage/i })).toBeVisible();
  });
});
