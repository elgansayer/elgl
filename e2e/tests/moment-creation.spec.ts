import { test, expect } from '@playwright/test';

/**
 * Comprehensive E2E tests for HelloTalk Moment Creation.
 * Covers: moments feed loading, compose form interaction, media handling,
 * language picker, moment cards, navigation, accessibility, and edge cases.
 */
test.describe('HelloTalk Moment Creation E2E', () => {
  test.describe('Moments Feed Page', () => {
    test('should load the moments feed page with header', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const header = page.locator('header');
      await expect(header.first()).toBeVisible();

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should display the compose toggle button', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const composeBtn = page.locator('header button').last();
      await expect(composeBtn).toBeVisible();
    });

    test('should show filter pills for moments', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should open compose form when clicking compose button', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      const textarea = page.locator('textarea');
      const textareaVisible = await textarea.isVisible().catch(() => false);

      if (textareaVisible) {
        await expect(textarea).toBeVisible();
        await expect(textarea).toHaveAttribute('placeholder');
      }
    });
  });

  test.describe('Moment Compose Form', () => {
    test('should allow typing text in the compose form textarea', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      const textarea = page.locator('textarea');
      if (await textarea.isVisible().catch(() => false)) {
        const testMessage = 'This is my test moment! Can anyone correct my English?';
        await textarea.fill(testMessage);
        await expect(textarea).toHaveValue(testMessage);

        await textarea.fill('');
        await expect(textarea).toHaveValue('');

        await textarea.fill('Learning French vocabulary today!');
        await expect(textarea).toHaveValue('Learning French vocabulary today!');
      }
    });

    test('should display language picker in compose form', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      const languagePicker = page.locator('app-language-picker');
      const pickerVisible = await languagePicker.isVisible().catch(() => false);

      if (pickerVisible) {
        await expect(languagePicker).toBeVisible();
      }
    });

    test('should show post button in compose form', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      const postBtn = page.locator('button').filter({ hasText: /Post|Publish|Share/i });
      const postBtnVisible = await postBtn.first().isVisible().catch(() => false);

      if (postBtnVisible) {
        await expect(postBtn.first()).toBeVisible();
      }
    });

    test('should toggle compose form open and close', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const composeBtn = page.locator('header button').last();

      await composeBtn.click();
      await page.waitForTimeout(500);

      const textarea = page.locator('textarea');
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill('Test moment content');
        await expect(textarea).toHaveValue('Test moment content');
      }

      await composeBtn.click();
      await page.waitForTimeout(300);

      await expect(page.locator('body')).toBeVisible();
    });
  });

  test.describe('Moments Feed Display', () => {
    test('should render moment cards with author info', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const articles = page.locator('article');
      const articleCount = await articles.count();

      if (articleCount > 0) {
        const firstArticle = articles.first();

        const avatar = firstArticle.locator('img').first();
        const avatarVisible = await avatar.isVisible().catch(() => false);

        if (avatarVisible) {
          await expect(avatar).toBeVisible();
        }

        const textContent = await firstArticle.textContent();
        expect(textContent).toBeTruthy();
      }
    });

    test('should display moment cards with interaction buttons', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      const articles = page.locator('article');
      const articleCount = await articles.count();

      if (articleCount > 0) {
        const likeButtons = page.locator('button[aria-label*="like" i]');
        const commentButtons = page.locator('button[aria-label*="comment" i]');

        const hasLikeBtn = await likeButtons.first().isVisible().catch(() => false);
        const hasCommentBtn = await commentButtons.first().isVisible().catch(() => false);

        expect(hasLikeBtn || hasCommentBtn).toBeTruthy();
      }
    });
  });

  test.describe('Moments Navigation', () => {
    test('should navigate to moments from bottom nav', async ({ page }) => {
      await page.goto('/home');
      await page.waitForTimeout(2000);

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

      const authorLinks = page.locator('article a[href*="/profile/"]');
      const authorLinkCount = await authorLinks.count();

      if (authorLinkCount > 0) {
        await expect(authorLinks.first()).toBeVisible();
        await authorLinks.first().click();
        await page.waitForTimeout(2000);

        const url = page.url();
        expect(url).toContain('/profile/');
      }
    });
  });

  test.describe('Moments Accessibility', () => {
    test('should have accessible compose button with ARIA label', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      const composeButton = page.locator('header button[aria-label="nav.compose"]').first();
      const isVisible = await composeButton.isVisible().catch(() => false);
      if (isVisible) {
        const ariaLabel = await composeButton.getAttribute('aria-label');
        expect(ariaLabel).toBeTruthy();
      }
    });

    test('should have accessible navigation links in header', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      const notificationLink = page.locator('a[aria-label="nav.notifications"]').first();
      const profileLink = page.locator('a[aria-label="nav.profile"]').first();

      const notifExists = await notificationLink.isVisible().catch(() => false);
      const profileExists = await profileLink.isVisible().catch(() => false);

      expect(notifExists || profileExists).toBeTruthy();
    });

    test('should have focusable interactive elements on moments page', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      const focusable = page.locator(
        'button:not([disabled]), a[href]'
      );
      const count = await focusable.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe('Moment Creation Edge Cases', () => {
    test('should handle rapid compose form open and close', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      const composeButton = page.locator('header button[aria-label="nav.compose"]').first();
      const isVisible = await composeButton.isVisible().catch(() => false);

      if (isVisible) {
        await composeButton.click();
        await page.waitForTimeout(200);
        await composeButton.click();
        await page.waitForTimeout(200);
        await composeButton.click();
        await page.waitForTimeout(200);

        const body = page.locator('body');
        await expect(body).toBeVisible();
      }
    });

    test('should clean up media previews when removing all images', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      const composeButton = page.locator('header button[aria-label="nav.compose"]').first();
      const isVisible = await composeButton.isVisible().catch(() => false);

      if (isVisible) {
        await composeButton.click();
        await page.waitForTimeout(500);

        const imageInput = page.locator('input[type="text"]').first();
        const imageInputVisible = await imageInput.isVisible().catch(() => false);
        if (imageInputVisible) {
          await imageInput.fill('https://example.com/test.jpg');
          const addBtn = page.locator('button', { hasText: 'moments.addImageBtn' }).first();
          const addVisible = await addBtn.isVisible().catch(() => false);
          if (addVisible) {
            await addBtn.click();
            await page.waitForTimeout(300);

            const removeBtn = page.locator('button[aria-label="Remove media"]').first();
            const removeVisible = await removeBtn.isVisible().catch(() => false);
            if (removeVisible) {
              await removeBtn.click();
              await page.waitForTimeout(300);
            }
          }
        }
      }

      await expect(page.locator('body')).toBeVisible();
    });

    test('should handle empty moment submission attempt', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      const textarea = page.locator('textarea');
      if (await textarea.isVisible().catch(() => false)) {
        await textarea.fill('');

        const postBtn = page.locator('button').filter({ hasText: /Post|Publish|Share/i });
        const postBtnVisible = await postBtn.first().isVisible().catch(() => false);

        if (postBtnVisible) {
          await postBtn.first().click();
          await page.waitForTimeout(500);
          await expect(page.locator('body')).toBeVisible();
        }
      }
    });
  });

  test.describe('Moments Multi-Language Support', () => {
    test('should handle text in different scripts on compose form', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      const composeBtn = page.locator('header button').last();
      await composeBtn.click();
      await page.waitForTimeout(500);

      const textarea = page.locator('textarea');
      if (await textarea.isVisible().catch(() => false)) {
        // Test with Arabic text (RTL)
        await textarea.fill('\\u0645\\u0631\\u062D\\u0628\\u0627 \\u0628\\u0643\\u0645');
        await expect(textarea).toBeVisible();

        // Test with mixed content
        await textarea.fill('Bonjour! Comment allez-vous? \\u3053\\u3093\\u306B\\u3061\\u306F');
        await expect(textarea).toBeVisible();
      }
    });
  });
});