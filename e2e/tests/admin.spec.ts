import { expect, test } from '@playwright/test';
import { login } from './helpers';

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? 'admin@swpv.local';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? 'ChangeMe123!';

// Spec §20: admin manages colours (reflected in the library immediately) and the
// dashboard shows all four KPIs.
test('admin dashboard shows the KPIs; colour changes appear in the library at once', async ({ page }) => {
  await login(page, ADMIN_EMAIL, ADMIN_PASSWORD);
  await page.goto('/admin');

  for (const kpi of ['Room photos uploaded', 'Designs saved', 'Average session', 'User satisfaction']) {
    await expect(page.getByRole('heading', { name: kpi })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Activity per day' })).toBeVisible();
  await page.getByRole('button', { name: 'Show table' }).click();
  await expect(page.getByRole('table')).toBeVisible();

  // Add a colour
  const code = `E2E-${Date.now().toString().slice(-6)}`;
  await page.goto('/admin/colors');
  await page.getByRole('button', { name: 'Add colour' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Code').fill(code);
  await dialog.getByLabel('Name').fill('Playwright Plum');
  await dialog.getByLabel('HEX').fill('#5E3B5C');
  await dialog.getByLabel('Family').fill('Purple');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Colour added')).toBeVisible();

  // Visible in the public library straight away
  await page.goto(`/colors?q=${code}`);
  await expect(page.getByText('Playwright Plum')).toBeVisible();

  // Remove it again; it disappears from the library
  await page.goto('/admin/colors');
  await page.getByLabel('Search colours').fill(code);
  await page.getByRole('button', { name: 'Remove Playwright Plum' }).click();
  await expect(page.getByText('Removed Playwright Plum from the library')).toBeVisible();
  await page.goto(`/colors?q=${code}`);
  await expect(page.getByText('No colours match your search.')).toBeVisible();
});
