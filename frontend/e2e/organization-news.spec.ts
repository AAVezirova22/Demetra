import { expect, test } from '@playwright/test';
import { mockApi, seedAuth, tinyPng, users } from './fixtures/api';

test('organizer can publish organization news with an image', async ({ page }) => {
  await seedAuth(page, users.owner, 'dashboard');
  await mockApi(page, users.owner);

  await page.goto('/');
  await page.getByRole('button', { name: 'News' }).click();
  await page.getByRole('button', { name: /\+ New Post/i }).click();

  await page.getByLabel('Title').fill('Image announcement');
  await page.getByLabel('Text').fill('This post includes a compressed image from Playwright.');
  await page.locator('input[type="file"]').setInputFiles({
    name: 'qa-image.png',
    mimeType: 'image/png',
    buffer: tinyPng,
  });

  await expect(page.locator('.post-image-preview img')).toBeVisible();
  await page.getByRole('button', { name: /publish post/i }).click();

  await expect(page.getByText('Image announcement')).toBeVisible();
  await expect(page.locator('.dash-post-card-image')).toBeVisible();
});

test('student member can read news but cannot create posts', async ({ page }) => {
  await seedAuth(page, users.student, 'dashboard');
  await mockApi(page, users.student);

  await page.goto('/');
  await page.getByRole('button', { name: 'News' }).click();

  await expect(page.getByText('Welcome to QA News')).toBeVisible();
  await expect(page.getByRole('button', { name: /\+ New Post/i })).toHaveCount(0);
});
