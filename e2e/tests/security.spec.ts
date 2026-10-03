import { expect, test } from '@playwright/test';
import { register, uploadRoom } from './helpers';

// Spec §20: "Unauthorised access to other users' projects and admin routes is blocked."
test('guests are sent to log in; users cannot open admin pages or others’ projects', async ({ browser }) => {
  const guest = await browser.newPage();
  await guest.goto('/admin');
  await expect(guest).toHaveURL(/\/auth\/login\?returnUrl=%2Fadmin/);
  await guest.close();

  const owner = await browser.newPage();
  await register(owner, 'Owner');
  const projectId = await uploadRoom(owner);

  const other = await (await browser.newContext()).newPage();
  await register(other, 'Someone else');
  await other.goto('/admin');
  await expect(other).toHaveURL(/\/dashboard$/);

  await other.goto(`/projects/${projectId}/studio`);
  await expect(other.getByRole('heading', { name: 'Project not found' })).toBeVisible();

  const api = await other.request.get(`/api/v1/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${await other.evaluate(() => localStorage.getItem('swpv.token'))}` },
  });
  expect(api.status()).toBe(404);

  // Tidy up: the owner deletes the project (and its images)
  const ownerToken = await owner.evaluate(() => localStorage.getItem('swpv.token'));
  const deleted = await owner.request.delete(`/api/v1/projects/${projectId}`, {
    headers: { Authorization: `Bearer ${ownerToken}` },
  });
  expect(deleted.status()).toBe(204);
});
