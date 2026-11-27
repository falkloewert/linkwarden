import { test, expect } from '../scripts/sandbox.mjs';
import { login, storedUser } from './helpers.mjs';

// #1915 / #1779: a settings section must not reset fields it does not send.

test('archive settings: saving keeps the German UI and stored language (#1779)', async ({ page }) => {
  await login(page);
  await page.goto('/settings/preference');
  await expect(page.getByText('Archiv Einstellungen')).toBeVisible();

  const pdf = page.locator('label').filter({ hasText: 'PDF' }).locator('input[type="checkbox"]').first();
  await pdf.click();
  await page.getByRole('button', { name: 'Änderungen speichern' }).nth(1).click();
  await expect(page.getByText('Einstellungen übernommen!')).toBeVisible();

  const user = await storedUser(page);
  expect(user.locale).toBe('de');
  expect(user.archiveAsPDF).toBe(false);
  await page.reload();
  await expect(page.getByText('Archiv Einstellungen')).toBeVisible();
});

test('account page: changing the language still works', async ({ page }) => {
  await login(page);
  await page.goto('/settings/account');
  const language = page.locator('select').filter({ has: page.locator('option[value="de"]') });
  await expect(language).toHaveValue('de');

  await language.selectOption('en');
  await page.getByRole('button', { name: 'Änderungen speichern' }).click();
  await expect.poll(async () => (await storedUser(page)).locale).toBe('en');
  await page.reload();
  await expect(page.locator('select').filter({ has: page.locator('option[value="de"]') })).toHaveValue('en');
});
