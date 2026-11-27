import { expect } from '../scripts/sandbox.mjs';

// Seeded by factory/mocks/ollama/seed.sql (sandbox only)
export const USER = { username: 'tester', password: 'factory-local-only' };

// Fast login for regression specs (the proof types it visibly instead)
export async function login(page) {
  await page.goto('/login');
  await page.getByTestId('username-input').fill(USER.username);
  await page.getByTestId('password-input').fill(USER.password);
  await page.getByTestId('submit-login-button').click();
  await page.waitForURL('**/dashboard');
}

// The account as the server stores it, read with the page's session
export async function storedUser(page) {
  const res = await page.request.get('/api/v1/users/me');
  expect(res.ok()).toBeTruthy();
  return (await res.json()).response;
}

export const radio = (page, label) =>
  page.locator('label').filter({ hasText: label }).locator('input[type="radio"]');
