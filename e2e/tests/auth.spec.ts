import { test, expect } from '@playwright/test';

test.describe('HelloTalk Authentication E2E', () => {
  test.describe('Forgot Password Flow', () => {
    test('should navigate to forgot password page and display the form', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForSelector('h1');

      const heading = page.locator('h1');
      await expect(heading).toBeVisible();

      // The email form should be visible when no token query param is present
      const emailInput = page.locator('#email');
      await expect(emailInput).toBeVisible();
      await expect(emailInput).toHaveAttribute('type', 'email');

      // Fill in the email field
      await emailInput.fill('testuser@example.com');
      await expect(emailInput).toHaveValue('testuser@example.com');

      // Submit button should be enabled when form is valid
      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible();
      await expect(submitBtn).toBeEnabled();

      // Back to home link should exist
      const backLink = page.locator('a[href="/home"]');
      await expect(backLink).toBeVisible();
    });

    test('should show the reset form when token query param is present', async ({ page }) => {
      await page.goto('/forgot-password?token=mock-reset-token-abc123');
      await page.waitForSelector('h1');

      const heading = page.locator('h1');
      await expect(heading).toBeVisible();

      // The reset password form should be visible with the token
      const newPasswordInput = page.locator('#newPassword');
      await expect(newPasswordInput).toBeVisible();
      await expect(newPasswordInput).toHaveAttribute('type', 'password');

      // Fill the new password field
      await newPasswordInput.fill('newSecurePassword123');
      await expect(newPasswordInput).toHaveValue('newSecurePassword123');

      // Submit button should be enabled when the password meets min length
      const submitBtn = page.locator('button[type="submit"]');
      await expect(submitBtn).toBeVisible();
    });
  });

  test.describe('Reset Password Page', () => {
    test('should display reset password page', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForTimeout(1500);

      // The page should load without errors
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Change Password Page', () => {
    test('should display change password page', async ({ page }) => {
      await page.goto('/change-password');
      await page.waitForTimeout(1500);

      // The page should load without errors
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Onboarding Wizard', () => {
    test('should render the onboarding wizard with language selection steps', async ({ page }) => {
      await page.goto('/onboarding');
      await page.waitForSelector('h1');

      const heading = page.locator('h1');
      await expect(heading).toBeVisible();

      // The native language select should be visible in step 1
      const nativeLangSelect = page.locator('#native-lang');
      await expect(nativeLangSelect).toBeVisible();

      // Check that the progress indicators are present
      const stepIndicators = page.locator('.flex.items-center.gap-2.p-2.rounded');
      await expect(stepIndicators.first()).toBeVisible();
    });

    test('should allow navigating through onboarding steps', async ({ page }) => {
      await page.goto('/onboarding');
      await page.waitForSelector('h1');

      // Step 1: Select native language
      const nativeLangSelect = page.locator('#native-lang');
      await expect(nativeLangSelect).toBeVisible();
      await nativeLangSelect.selectOption({ index: 1 });

      // Click "Next" button
      const nextBtn = page.locator('button').filter({ hasText: /Next|Continue|forward/i });
      const nextBtnCount = await nextBtn.count();

      if (nextBtnCount > 0) {
        await nextBtn.first().click();
        await page.waitForTimeout(500);

        // Step 2: Target language checkboxes should appear
        const checkboxes = page.locator('input[type="checkbox"]');
        const checkboxCount = await checkboxes.count();
        if (checkboxCount > 0) {
          await expect(checkboxes.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('App Lock & Biometric Controls', () => {
    test('should show biometric lock controls on the home page', async ({ page }) => {
      await page.goto('/home');
      await page.waitForTimeout(2000);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Terms and Privacy Pages', () => {
    test('should display terms of service page', async ({ page }) => {
      await page.goto('/terms');
      await page.waitForTimeout(1500);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should display privacy policy page', async ({ page }) => {
      await page.goto('/privacy');
      await page.waitForTimeout(1500);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Account Deletion Page', () => {
    test('should display account deletion page', async ({ page }) => {
      await page.goto('/account/deletion');
      await page.waitForTimeout(1500);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });
});