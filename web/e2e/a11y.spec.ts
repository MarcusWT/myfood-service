import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { goTo } from './helpers';

const TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa'];

async function audit(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(TAGS).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
}

test('auth pages have no axe violations', async ({ page }) => {
  await page.goto('/login');
  await expect(page.getByRole('heading', { name: 'Log in' })).toBeVisible();
  await audit(page);
  await page.goto('/register');
  await expect(page.getByRole('heading', { name: 'Create account' })).toBeVisible();
  await audit(page);
});

test('app pages have no axe violations, set titles and move focus', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const email = `a11y-${Date.now()}-${test.info().project.name}@example.com`;
  await page.goto('/register');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  await expect(page).toHaveTitle('Dashboard · MYFood');
  await audit(page);

  const pages = [
    ['Inventory', 'Inventory'],
    ['Alerts', 'Expiry alerts'],
    ['Shopping', 'Shopping summary'],
    ['Recipes', 'Recipe suggestions'],
  ];
  for (const [link, heading] of pages) {
    await goTo(page, link);
    await expect(page.getByRole('heading', { name: heading })).toBeVisible();
    await expect(page).toHaveTitle(`${link} · MYFood`);
    await expect(page.locator('#main-content')).toBeFocused();
    await audit(page);
  }

  await goTo(page, 'Inventory');
  await page.getByRole('button', { name: 'Add item' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await audit(page);
});
