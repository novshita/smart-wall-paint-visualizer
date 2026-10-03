import { expect, test } from '@playwright/test';
import fs from 'fs';
import { photoPoint, register, traceBackWall, uploadRoom } from './helpers';

// Spec §20: "A new user can register, upload a JPG/PNG, select a wall with both tools,
// apply a colour, compare before/after, save, and download."
test('register → upload → select → paint → compare → save → download', async ({ page }) => {
  await register(page);
  await uploadRoom(page, 'Living room');

  // Polygon tool
  await traceBackWall(page);

  // Brush/eraser tool: remove the window from the wall
  await page.getByRole('button', { name: 'Eraser (E)' }).click();
  for (let y = 280; y <= 600; y += 40) {
    await page.mouse.move(...(await photoPoint(page, 895, y)));
    await page.mouse.down();
    await page.mouse.move(...(await photoPoint(page, 1205, y)), { steps: 8 });
    await page.mouse.up();
  }

  await page.getByRole('button', { name: 'Next: paint walls' }).click();
  await expect(page).toHaveURL(/\/studio/);

  // Apply a library colour; name, code and brand are shown (FR-C8)
  await page.getByRole('button', { name: /^Sage Garden, GN-501/ }).click();
  await expect(page.locator('app-paint-panel .applied')).toContainText('Sage Garden');
  await expect(page.locator('app-paint-panel .applied')).toContainText('GN-501 · SWPV');
  await expect(page.locator('app-studio-canvas')).toHaveAttribute('data-render-ms', /\d/);

  // Rendering stays within the spec's 300 ms budget for a colour change (spec §7)
  await page.getByRole('button', { name: /^Coastal Breeze/ }).click();
  await expect
    .poll(async () => Number(await page.locator('app-studio-canvas').getAttribute('data-render-ms')))
    .toBeLessThan(300);

  // Compare before/after
  await page.getByRole('button', { name: 'Compare before and after' }).click();
  await expect(page.getByLabel('Before and after divider position')).toBeVisible();

  // Save
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Design saved')).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'All changes saved' })).toBeVisible();

  // Download a full-resolution JPG
  await page.getByRole('button', { name: 'Download image' }).click();
  const dialog = page.getByRole('dialog', { name: 'Download your design' });
  const downloadPromise = page.waitForEvent('download');
  await dialog.getByRole('button', { name: 'Download' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('living-room-design-1.jpg');
  const file = await download.path();
  expect(fs.statSync(file).size).toBeGreaterThan(50_000);

  // The rating prompt appears after a download; dismiss it
  const later = page.getByRole('button', { name: 'Not now' });
  if (await later.isVisible({ timeout: 4000 }).catch(() => false)) await later.click();

  // Saved Designs: reopen, then delete (FR-S4)
  await page.goto('/projects');
  const card = page.locator('.card', { hasText: 'Living room' });
  await expect(card).toContainText('Saved');
  await card.getByRole('link', { name: 'Open Living room' }).click();
  await expect(page).toHaveURL(/\/studio/);
  await expect(page.locator('app-wall-list .wall').first()).toContainText('Coastal Breeze');

  await page.goto('/projects');
  await page.getByRole('button', { name: 'Actions for Living room' }).click();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Delete' }).click();
  await expect(page.getByText("You haven't created any designs yet.")).toBeVisible();
});
