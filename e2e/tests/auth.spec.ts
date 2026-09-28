import { test, expect } from '@playwright/test';

const resetEmail = 'e2e-reset@example.test';
const resetToken = 'e2e-reset-token';
const newPassword = 'CorrectHorseBatteryStaple42!';

test.describe('HelloTalk Authentication E2E', () => {
  test('submits a password-reset request through the real form boundary', async ({ page }) => {
    let resetPayload: unknown;

    await page.route('**/api/auth/request-password-reset', async (route) => {
      resetPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 202,
        contentType: 'application/json',
        body: JSON.stringify({ accepted: true }),
      });
    });

    await page.goto('/forgot-password');

    const emailInput = page.locator('#email');
    const submitButton = page.locator('form button[type="submit"]');

    await expect(emailInput).toBeVisible();
    await expect(submitButton).toBeDisabled();

    await emailInput.fill(resetEmail);
    await expect(submitButton).toBeEnabled();

    const resetRequest = page.waitForRequest(
      (request) =>
        request.method() === 'POST' && request.url().includes('/api/auth/request-password-reset'),
    );
    await submitButton.click();
    await resetRequest;

    expect(resetPayload).toEqual({ email: resetEmail });
    await expect(page.locator('form .text-success')).toBeVisible();
  });

  test('submits the reset token and password before navigating home', async ({ page }) => {
    let passwordPayload: unknown;

    await page.route('**/api/auth/reset-password', async (route) => {
      passwordPayload = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await page.goto(`/forgot-password?token=${resetToken}`);

    const passwordInput = page.locator('#newPassword');
    const submitButton = page.locator('form button[type="submit"]');

    await expect(passwordInput).toBeVisible();
    await expect(submitButton).toBeDisabled();

    await passwordInput.fill(newPassword);
    await expect(submitButton).toBeEnabled();

    const resetRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().includes('/api/auth/reset-password'),
    );
    await submitButton.click();
    await resetRequest;

    expect(passwordPayload).toEqual({ token: resetToken, newPassword });
    await page.waitForURL('**/home');
  });

  test('keeps onboarding language selection keyboard-operable', async ({ page }) => {
    await page.goto('/onboarding');

    const nativeLangSelect = page.locator('#native-lang');
    await expect(nativeLangSelect).toBeVisible();

    await nativeLangSelect.selectOption({ index: 1 });
    await expect(nativeLangSelect).not.toHaveValue('');
  });
});
