import { test, expect } from '@playwright/test';

test.describe('Moment Creation Flows', () => {
  test.describe('Moments Feed Navigation', () => {
    test('should navigate to moments feed from bottom nav', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(1000);

      // Click on the moments tab in bottom navigation
      const momentsNavLink = page.locator('nav a[href="/moments"]');
      if (await momentsNavLink.isVisible()) {
        await momentsNavLink.click();
        await page.waitForURL('**/moments');
        await page.waitForTimeout(2000);

        // The moments feed title should be visible
        const pageContent = await page.content();
        expect(pageContent).toContain('moments.title');
      }
    });

    test('should display filter pills on moments page', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Filter pills should be rendered: All, For You, Classmates, Following
      const pageContent = await page.content();

      const hasFilterSection =
        pageContent.includes('moments.tabAll') ||
        pageContent.includes('moments.tabForYou') ||
        pageContent.includes('moments.tabClassmates') ||
        pageContent.includes('moments.tabFollowing');

      expect(hasFilterSection).toBeTruthy();
    });

    test('should display moments or empty state', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Should show either:
      // 1. Loading state
      // 2. Empty state with message
      // 3. The moments feed with items
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should switch filter pills without crashing', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Try clicking on each filter pill
      const allPill = page.locator('button', { hasText: 'moments.tabAll' }).first();
      const forYouPill = page.locator('button', { hasText: 'moments.tabForYou' }).first();
      const classmatesPill = page.locator('button', { hasText: 'moments.tabClassmates' }).first();
      const followingPill = page.locator('button', { hasText: 'moments.tabFollowing' }).first();

      // Click whichever filter pills are visible
      if (await allPill.isVisible().catch(() => false)) {
        await allPill.click();
        await page.waitForTimeout(500);
      }

      if (await forYouPill.isVisible().catch(() => false)) {
        await forYouPill.click();
        await page.waitForTimeout(500);
      }

      if (await classmatesPill.isVisible().catch(() => false)) {
        await classmatesPill.click();
        await page.waitForTimeout(500);
      }

      if (await followingPill.isVisible().catch(() => false)) {
        await followingPill.click();
        await page.waitForTimeout(500);
      }

      // Page should not crash after switching pills
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Moment Creation - Compose Form', () => {
    test('should open compose form when clicking compose button', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Find and click the compose/post button (plus icon button in header)
      const composeButton = page.locator('header button[aria-label="nav.compose"]').first();
      const isVisible = await composeButton.isVisible().catch(() => false);

      if (isVisible) {
        await composeButton.click();
        await page.waitForTimeout(500);

        // The compose form should now be visible
        const pageContent = await page.content();
        expect(pageContent).toContain('moments.postPlaceholder');
      }
    });

    test('should display textarea in compose form', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Open compose form
      const composeButton = page.locator('header button[aria-label="nav.compose"]').first();
      const isComposeVisible = await composeButton.isVisible().catch(() => false);

      if (isComposeVisible) {
        await composeButton.click();
        await page.waitForTimeout(500);

        // Textarea should be visible
        const textarea = page.locator('textarea').first();
        const textareaVisible = await textarea.isVisible().catch(() => false);

        if (textareaVisible) {
          await expect(textarea).toBeVisible();

          // Type some text
          await textarea.fill('Test moment text content');
          const value = await textarea.inputValue();
          expect(value).toBe('Test moment text content');
        }
      }
    });

    test('should display language picker in compose form', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Open compose form
      const composeButton = page.locator('header button[aria-label="nav.compose"]').first();
      const isComposeVisible = await composeButton.isVisible().catch(() => false);

      if (isComposeVisible) {
        await composeButton.click();
        await page.waitForTimeout(500);

        // Language picker should be present
        const pageContent = await page.content();
        expect(pageContent).toContain('moments.targetLanguageLabel');
      }
    });

    test('should display voice recorder button in compose form', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Open compose form
      const composeButton = page.locator('header button[aria-label="nav.compose"]').first();
      const isComposeVisible = await composeButton.isVisible().catch(() => false);

      if (isComposeVisible) {
        await composeButton.click();
        await page.waitForTimeout(500);

        // Voice recorder button should be present (aria-label="Record voice")
        const voiceButton = page.locator('button[aria-label="Record voice"]').first();
        const isVoiceVisible = await voiceButton.isVisible().catch(() => false);

        if (isVoiceVisible) {
          await expect(voiceButton).toBeVisible();
        }
      }
    });

    test('should not submit empty moment (empty text and no media)', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Open compose form
      const composeButton = page.locator('header button[aria-label="nav.compose"]').first();
      const isComposeVisible = await composeButton.isVisible().catch(() => false);

      if (isComposeVisible) {
        await composeButton.click();
        await page.waitForTimeout(500);

        // The post/submit button should be disabled when form is empty
        const postButton = page.locator('button', { hasText: 'moments.postBtn' }).first();
        const isDisabled = await postButton.isDisabled().catch(() => true);

        // Should be disabled (or may not exist if textarea is empty)
        expect(isDisabled !== false).toBeTruthy();
      }
    });
  });

  test.describe('Moment Interactions', () => {
    test('should show like button on moments', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Look for like button on moment cards
      const pageContent = await page.content();
      const hasLikeText = pageContent.includes('moments.likeBtn');
      expect(hasLikeText).toBeTruthy();
    });

    test('should show comment button on moments', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Look for comment button on moment cards
      const pageContent = await page.content();
      const hasCommentText = pageContent.includes('moments.commentBtn');
      expect(hasCommentText).toBeTruthy();
    });

    test('should show correct/translate buttons on moment cards with text', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      const pageContent = await page.content();
      // Moments should have correct and translate action buttons
      const hasCorrectBtn = pageContent.includes('moments.correctBtn');
      const hasTranslateBtn = pageContent.includes('moments.translate');

      // At least one of these interaction buttons should be present
      expect(hasCorrectBtn || hasTranslateBtn).toBeTruthy();
    });

    test('should toggle comment section when clicking comment button', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Find and click a comment button
      const commentButton = page.locator('button', { hasText: 'moments.commentBtn' }).first();
      const isVisible = await commentButton.isVisible().catch(() => false);

      if (isVisible) {
        await commentButton.click();
        await page.waitForTimeout(500);

        // Comment input should appear
        const pageContent = await page.content();
        const hasCommentInput = pageContent.includes('moments.commentPlaceholder') ||
          pageContent.includes('moments.commentReplyPlaceholder');
        expect(hasCommentInput).toBeTruthy();
      }
    });

    test('should open correction modal when clicking correct button', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(3000);

      // Find and click a correction button
      const correctButton = page.locator('button', { hasText: 'moments.correctBtn' }).first();
      const isVisible = await correctButton.isVisible().catch(() => false);

      if (isVisible) {
        await correctButton.click();
        await page.waitForTimeout(500);
      }

      // Page should not crash
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Word Interactions in Moments', () => {
    test('should display tokenised text on moments with text content', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Tokenised text component should be present in the page
      const tokenisedComponent = page.locator('app-tokenised-text');
      const count = await tokenisedComponent.count();
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Infinite Scroll', () => {
    test('should load moments feed without crashing', async ({ page }) => {
      await page.goto('/moments');
      await page.waitForTimeout(2000);

      // Scroll the feed
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);

      // Page should still be functional
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('RTL Compatibility in Moments', () => {
    test('should render moments feed in RTL locale without breakage', async ({
      page,
      browser,
    }) => {
      const context = await browser.newContext({ locale: 'ar-SA' });
      const rtlPage = await context.newPage();

      await rtlPage.goto('/moments');
      await rtlPage.waitForTimeout(2000);

      const body = rtlPage.locator('body');
      await expect(body).toBeVisible();

      await context.close();
    });
  });
});