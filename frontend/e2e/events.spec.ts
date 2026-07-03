import { expect, test } from '@playwright/test';
import { mockApi, seedAuth, users } from './fixtures/api';

test('student can browse an event and register', async ({ page }) => {
  await seedAuth(page, users.student, 'events');
  await mockApi(page, users.student);

  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Musical Events' })).toBeVisible();
  await page.getByText('QA Recital').click();
  await expect(page.getByRole('heading', { name: 'QA Recital' })).toBeVisible();
  await page.getByRole('button', { name: /register for event/i }).click();

  await expect(page.getByText(/you're registered/i)).toBeVisible();
});
