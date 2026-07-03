import { expect, test } from '@playwright/test';
import { mockApi, seedAuth, users } from './fixtures/api';

test('user can save profile details', async ({ page }) => {
  await seedAuth(page, users.student, 'profile');
  await mockApi(page, users.student);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Edit your profile' })).toBeVisible();
  await page.getByLabel('Display name').fill('Stella QA');
  await page.getByLabel('Headline').fill('Student pianist');
  await page.getByLabel('Location').fill('Sofia QA Studio');
  await page.getByRole('button', { name: /save profile/i }).click();

  await expect(page.getByText('Saved')).toBeVisible();
  await expect(page.getByText('Stella QA')).toBeVisible();
});
