import { expect, Page } from '@playwright/test';
import path from 'path';

export const ROOM_PHOTO = path.join(__dirname, '../fixtures/room.jpg');
/** The fixture photo is 1600 × 1200 */
const PHOTO = { width: 1600, height: 1200 };

export function uniqueEmail(prefix = 'e2e'): string {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@e2e.test`;
}

export async function register(page: Page, name = 'E2E Tester', email = uniqueEmail()): Promise<string> {
  await page.goto('/auth/register');
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Paint1234');
  await page.getByLabel('Confirm password').fill('Paint1234');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  return email;
}

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
}

/** Uploads the fixture photo and lands on the wall-selection step. Returns the project id. */
export async function uploadRoom(page: Page, title = 'E2E room'): Promise<string> {
  await page.goto('/projects/new');
  await page.locator('input[type=file]').setInputFiles(ROOM_PHOTO);
  await expect(page.getByRole('img', { name: /Preview of/ })).toBeVisible();
  await page.getByLabel('Project name').fill(title);
  await page.getByRole('checkbox', { name: /I took this photo/ }).check();
  await page.getByRole('button', { name: 'Upload and continue' }).click();
  await expect(page).toHaveURL(/\/projects\/[a-f0-9]{24}\/select/);
  await expect(page.locator('app-selection-canvas canvas')).toBeVisible();
  // A new user's first editor visit shows the getting-started guide (spec §7)
  const guide = page.getByRole('dialog');
  await expect(guide.getByRole('heading', { name: 'Select a wall' })).toBeVisible();
  await guide.getByRole('button', { name: 'Skip' }).click();
  await expect(guide).toBeHidden();
  return page.url().match(/projects\/([a-f0-9]{24})/)![1];
}

/** Converts a point on the photo to page coordinates, using the editor's fit-to-screen rule. */
export async function photoPoint(page: Page, x: number, y: number): Promise<[number, number]> {
  const box = (await page.locator('app-selection-canvas').boundingBox())!;
  const scale = Math.min((box.width - 48) / PHOTO.width, (box.height - 48) / PHOTO.height);
  const ox = box.x + (box.width - PHOTO.width * scale) / 2;
  const oy = box.y + (box.height - PHOTO.height * scale) / 2;
  return [ox + x * scale, oy + y * scale];
}

/** Traces the back wall of the fixture room with the polygon tool. */
export async function traceBackWall(page: Page): Promise<void> {
  for (const [x, y] of [
    [402, 152],
    [1398, 152],
    [1398, 848],
    [402, 848],
    [402, 152],
  ]) {
    await page.mouse.click(...(await photoPoint(page, x, y)));
  }
  await expect(page.locator('app-wall-list .wall .sub').first()).toHaveText('Selected');
}
