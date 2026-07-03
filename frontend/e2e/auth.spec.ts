import { expect, test } from '@playwright/test';
import { mockApi, users } from './fixtures/api';

test('student can sign in and reach the dashboard for their organization', async ({ page }) => {
  await mockApi(page, users.student);
  await page.goto('/');

  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /sign in/i }).click();
  await page.getByLabel('Email').fill(users.student.email);
  await page.getByLabel('Password').fill('Password123');
  await page.getByRole('button', { name: /^sign in$/i }).click();

  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  await page.getByRole('link', { name: 'Dashboard' }).click();
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await expect(page.getByText('QA Music School')).toBeVisible();
});

test('registration form validates password requirements before API submit', async ({ page }) => {
  await mockApi(page, users.student);
  await page.goto('/');

  await page.getByRole('button', { name: /get started/i }).click();
  await page.getByRole('button', { name: /student/i }).click();
  await page.getByLabel('Student name').fill('QA Student');
  await page.getByLabel('Student email').fill('student.form@demetra.test');
  await page.getByLabel('Password').fill('short');
  await page.getByRole('button', { name: /create student account/i }).click();

  await expect(page.getByText(/password must be between 8 and 128 characters/i)).toBeVisible();
});
