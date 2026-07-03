import { expect, test } from '@playwright/test';
import { mockApi, seedAuth, users } from './fixtures/api';

test('student member cannot see organization management controls', async ({ page }) => {
  await seedAuth(page, users.student, 'dashboard');
  await mockApi(page, users.student);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Settings' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Stage Layouts' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /\+ New Event/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /\+ New Post/i })).toHaveCount(0);
  await expect(page.getByText('Organization Events')).toBeVisible();
});

test('organization owner can see management controls', async ({ page }) => {
  await seedAuth(page, users.owner, 'dashboard');
  await mockApi(page, users.owner);

  await page.goto('/');

  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Stage Layouts' })).toBeVisible();
  await expect(page.getByRole('button', { name: /\+ New Event/i })).toBeVisible();
});
