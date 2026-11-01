import type { Page } from '@playwright/test';

export async function goTo(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Open menu' });
  await menu
    .or(page.getByRole('navigation', { name: 'Main' }))
    .first()
    .waitFor();
  if (await menu.isVisible()) {
    await menu.click();
    await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name }).click();
  } else {
    await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name }).click();
  }
}
