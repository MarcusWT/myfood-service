import { expect, test } from '@playwright/test';

test('register, add item, see alert, mark consumed, logout', async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill('password123');
  await page.getByRole('button', { name: /register|sign up|create/i }).click();
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();

  await page.getByRole('link', { name: 'Inventory' }).click();
  await page.getByRole('button', { name: 'Add item' }).click();
  await page.getByLabel('Name').fill('Yogurt');
  await page.getByLabel('Quantity').fill('2');
  const tomorrow = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
  await page.getByLabel('Best before').fill(tomorrow);
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Yogurt')).toBeVisible();

  await page.getByRole('link', { name: 'Alerts' }).click();
  await expect(page.getByText('Yogurt')).toBeVisible();
  await expect(page.getByText(/Expires in/)).toBeVisible();

  await page.getByRole('link', { name: 'Inventory' }).click();
  await page.getByRole('button', { name: 'Consumed Yogurt' }).click();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByText('Yogurt')).toHaveCount(0);

  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
});
