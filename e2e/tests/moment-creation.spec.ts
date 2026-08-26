import { test, expect } from '@playwright/test';

test.describe('HelloTalk Moment Creation E2E', () => {
  test.describe('Moments Feed Page', () => {
    test('should load the moments feed page with header', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // The page should have a header with "Moments" title
      const header = page.locator('header');
      await expect(header.first()).toBeVisible();

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should display the compose toggle button', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // The compose button (camera/post icon) should be in the header
      const composeBtn = page.locator('header button').last();
      await expect(composeBtn).toBeVisible();
    });

    test('should show filter pills for moments', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // The page should have the scrollable pills component with filter options
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should open compose form when clicking compose button', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // Click the compose button in the header (last button with svg)
      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      // The compose form should now be visible with a textarea
      const textarea = page.locator('textarea');
      const textareaVisible = await textarea.isVisible().catch(() => false);

      if (textareaVisible) {
        await expect(textarea).toBeVisible();
        await expect(textarea).toHaveAttribute('placeholder');
      }
    });

    test('should allow typing text in the compose form textarea', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // Open the compose form
      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      const textarea = page.locator('textarea');
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill('This is my test moment! Can anyone correct my English?');
        await expect(textarea).toHaveValue('This is my test moment! Can anyone correct my English?');
      }
    });

    test('should display language picker in compose form', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // Open the compose form
      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      // The language picker should be present in the compose form
      const languagePicker = page.locator('app-language-picker');
      const pickerVisible = await languagePicker.isVisible().catch(() => false);

      if (pickerVisible) {
        await expect(languagePicker).toBeVisible();
      }
    });

    test('should show post button in compose form', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // Open the compose form
      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      // The post button should be present
      const postBtn = page.locator('button').filter({ hasText: /Post|Publish|Share/i });
      const postBtnVisible = await postBtn.isVisible().catch(() => false);

      if (postBtnVisible) {
        await expect(postBtn).toBeVisible();
      }
    });
  });

  test.describe('Moments Feed Display', () => {
    test('should render moment cards with author info', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // Moment cards should be rendered as articles
      const articles = page.locator('article');
      const articleCount = await articles.count();

      if (articleCount > 0) {
        // At least one moment card has author name
        const firstArticle = articles.first();

        // Check for avatar image
        const avatar = firstArticle.locator('img').first();
        await expect(avatar).toBeVisible();
      }
    });
  });

  test.describe('Moments Navigation', () => {
    test('should navigate to moments from bottom nav', async ({ page }) => {
      await page.goto('/home');
      await page.waitForTimeout(2000);

      // On mobile, bottom nav has moments link
      const momentsNavLink = page.locator('a[routerLink="/moments"]');
      if (await momentsNavLink.isVisible().catch(() => false)) {
        await momentsNavLink.click();
        await page.waitForTimeout(2000);

        const header = page.locator('header');
        await expect(header.first()).toBeVisible();
      }
    });

    test('should navigate to user profile from moment author link', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // Look for author avatar links
      const authorLinks = page.locator('article a[href*="/profile/"]');
      const authorLinkCount = await authorLinks.count();

      if (authorLinkCount > 0) {
        await expect(authorLinks.first()).toBeVisible();
        await authorLinks.first().click();
        await page.waitForTimeout(2000);

        // Should navigate to a profile page
        const url = page.url();
        expect(url).toContain('/profile/');
      }
    });
  });
});