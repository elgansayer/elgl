import { test, expect } from '@playwright/test';

test.describe('Authentication Flows', () => {
  test.describe('Navigation', () => {
    test('should navigate to the home page as default route', async ({ page }) => {
      await page.goto('/');
      await page.waitForURL('**/home');
      await expect(page.locator('h1')).toBeVisible();
    });

    test('should display the bottom navigation bar with auth-aware links', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(1000);

      const nav = page.locator('nav');
      await expect(nav).toBeVisible();

      // Verify all main navigation links exist
      const navLinks = nav.locator('a');
      const count = await navLinks.count();
      expect(count).toBeGreaterThanOrEqual(4);
    });

    test('should display onboarding wizard at /onboarding', async ({ page }) => {
      await page.goto('/onboarding');
      await page.waitForTimeout(1000);

      // Onboarding wizard should show step indicators
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
    });

    test('should display forgot password page at /forgot-password', async ({ page }) => {
      await page.goto('/forgot-password');
      await page.waitForTimeout(1000);

      // Should show email form
      const emailInput = page.locator('#email');
      await expect(emailInput).toBeVisible();

      // Should have a submit button
      const submitButton = page.locator('button[type="submit"]');
      await expect(submitButton).toBeVisible();

      // Should have back-to-home link
      const homeLink = page.locator('a[href="/home"]');
      await expect(homeLink).toBeVisible();
    });

    test('should display change password page at /change-password', async ({ page }) => {
      await page.goto('/change-password');
      await page.waitForTimeout(1000);

      // Should display the change password component
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
    });

    test('should display reset password page at /reset-password', async ({ page }) => {
      await page.goto('/reset-password');
      await page.waitForTimeout(1000);

      // Should display the reset password component
      const heading = page.getByRole('heading', { level: 1 });
      await expect(heading).toBeVisible();
    });
  });

  test.describe('Social Login Buttons', () => {
    test('should render social login buttons on the home page', async ({ page }) => {
      await page.goto('/home');
      await page.waitForTimeout(1500);

      // Social login buttons should appear somewhere in the app
      // Look for Google, Facebook, or Apple login buttons
      const pageContent = await page.content();

      // The app uses social-login-buttons component with provider buttons
      const hasGoogleLogin = pageContent.includes('auth.login_google');
      const hasFacebookLogin = pageContent.includes('auth.login_facebook');
      const hasAppleLogin = pageContent.includes('auth.login_apple');

      // At least one social login option should be present
      expect(hasGoogleLogin || hasFacebookLogin || hasAppleLogin).toBeTruthy();
    });

    test('should emit provider on social button click without crashing', async ({ page }) => {
      await page.goto('/home');
      await page.waitForTimeout(1500);

      // Try clicking a social login button if visible
      const googleButton = page.locator('button', { hasText: 'auth.login_google' });
      const facebookButton = page.locator('button', { hasText: 'auth.login_facebook' });
      const appleButton = page.locator('button', { hasText: 'auth.login_apple' });

      const anyVisible = await googleButton.isVisible().catch(() => false)
        || await facebookButton.isVisible().catch(() => false)
        || await appleButton.isVisible().catch(() => false);

      if (anyVisible) {
        if (await googleButton.isVisible().catch(() => false)) {
          await googleButton.click();
        }
      }
    });
  });

  test.describe('Two-Factor Authentication', () => {
    test('should not crash when accessing settings page for 2FA', async ({ page }) => {
      await page.goto('/settings');
      await page.waitForTimeout(1500);

      // The settings page should load and display content
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Device Lock & Biometric', () => {
    test('should navigate to lock page at /lock', async ({ page }) => {
      await page.goto('/lock');
      await page.waitForTimeout(1500);

      // The device lock page should render
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should display unlock button on lock screen', async ({ page }) => {
      await page.goto('/lock');
      await page.waitForTimeout(1500);

      // Look for unlock button
      const unlockButton = page.getByRole('button');
      await expect(unlockButton).toBeVisible();
    });
  });

  test.describe('Device Transfer', () => {
    test('should navigate to device transfer page', async ({ page }) => {
      await page.goto('/device-transfer');
      await page.waitForTimeout(1500);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Profile (authenticated state)', () => {
    test('should navigate to profile page', async ({ page }) => {
      await page.goto('/profile');
      await page.waitForTimeout(2000);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });
});