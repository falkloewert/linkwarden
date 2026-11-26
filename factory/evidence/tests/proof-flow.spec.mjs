import path from 'node:path';
import fs from 'node:fs/promises';
import { test, expect } from '../scripts/sandbox.mjs';
import { createProofSession, highlightLocator, highlightAndClick, humanType } from '../scripts/proof-helpers.mjs';
import { USER, storedUser, radio } from './helpers.mjs';

// Proof for linkwarden#1915: with the language set to German, saving the AI tagging method
// keeps the UI and the stored language German (before the fix it was reset to English).

const OUT_DIR = process.env.EVIDENCE_OUT || path.resolve('./artifacts');
const SCREENSHOT_DIR = path.join(OUT_DIR, 'screenshots');

test.beforeAll(async () => {
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
});

test('Level 1 focused proof (#1915): saving AI tagging keeps the language German', async ({ page }) => {
  const TOTAL_STEPS = 4;
  const session = createProofSession(page, { outDir: OUT_DIR, screenshotDir: SCREENSHOT_DIR });
  const aiHeading = page.getByText('KI Einstellungen', { exact: true });
  const generate = radio(page, 'Tags automatisch generieren');

  await page.goto('/login');
  await expect(page.getByTestId('login-form')).toBeVisible();
  session.markReady();

  // Step 1/4: log in, the account's language is German
  await session.beginStep(1, TOTAL_STEPS, 'Log in: account language is German');
  await humanType(page, page.getByTestId('username-input'), USER.username);
  await humanType(page, page.getByTestId('password-input'), USER.password, { charDelayMs: 20 });
  await highlightAndClick(page, page.getByTestId('submit-login-button'));
  await page.waitForURL('**/dashboard');
  await page.goto('/settings/preference');
  await expect(aiHeading).toBeVisible();
  await expect(radio(page, 'Deaktiviert')).toBeChecked();
  expect((await storedUser(page)).locale).toBe('de');
  await highlightLocator(page, aiHeading);
  await session.finishStep({
    screenshotFile: '01-settings-german.png',
    assertion: 'Seeded user (locale "de") sees Settings → Preference in German: "KI Einstellungen", AI tagging "Deaktiviert"',
  });

  // Step 2/4: change the AI tagging method and save only that section
  await session.beginStep(2, TOTAL_STEPS, 'Change AI tagging and save');
  await highlightAndClick(page, page.locator('label').filter({ hasText: 'Tags automatisch generieren' }));
  await expect(generate).toBeChecked();
  const save = page.getByRole('button', { name: 'Änderungen speichern' }).first();
  await highlightAndClick(page, save);
  await expect(page.getByText('Einstellungen übernommen!')).toBeVisible();
  // Nothing left to save in this section once the server took it
  await expect(save).toBeDisabled();
  await highlightLocator(page, page.locator('label').filter({ hasText: 'Tags automatisch generieren' }));
  await session.finishStep({
    screenshotFile: '02-ai-tagging-saved.png',
    assertion: 'AI tagging set to "Tags automatisch generieren" and saved: the test saw the toast "Einstellungen übernommen!", the section\'s save button is disabled again, the page is still German',
  });

  // Step 3/4: reload, the page is still German and the server kept both values
  await session.beginStep(3, TOTAL_STEPS, 'Reload: still German, AI tagging saved');
  await page.reload();
  await expect(aiHeading).toBeVisible();
  await expect(generate).toBeChecked();
  const user = await storedUser(page);
  expect(user.locale).toBe('de');
  expect(user.aiTaggingMethod).toBe('GENERATE');
  await highlightLocator(page, aiHeading);
  await highlightLocator(page, page.locator('label').filter({ hasText: 'Tags automatisch generieren' }));
  await session.finishStep({
    screenshotFile: '03-reload-still-german.png',
    assertion: 'After a reload the page is German and the server returns locale "de" with aiTaggingMethod "GENERATE" (before the fix: locale "en", English UI)',
  });

  // Step 4/4: the account page shows the language unchanged
  await session.beginStep(4, TOTAL_STEPS, 'Account settings: language still Deutsch');
  await page.goto('/settings/account');
  const language = page.locator('select').filter({ has: page.locator('option[value="de"]') });
  await expect(language).toHaveValue('de');
  await highlightLocator(page, language);
  await session.finishStep({
    screenshotFile: '04-account-language-de.png',
    assertion: 'Settings → Account still has the language "de" selected',
    holdEndMs: 2200,
  });

  await session.saveMetadata();
});
