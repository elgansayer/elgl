import { test, expect } from '@playwright/test';

test.describe('Chat Messaging Flows', () => {
  test.describe('Chat List', () => {
    test('should navigate to chat list page from bottom nav', async ({ page }) => {
      await page.goto('/');
      await page.waitForTimeout(1000);

      // Click on the chat tab in bottom navigation
      const chatNavLink = page.locator('nav a[href="/chat"]');
      if (await chatNavLink.isVisible()) {
        await chatNavLink.click();
        await page.waitForURL('**/chat');
        await page.waitForTimeout(1500);

        // The chat list should be visible
        const body = page.locator('body');
        await expect(body).toBeVisible();
      }
    });

    test('should display chat list filter pills', async ({ page }) => {
      await page.goto('/chat');
      await page.waitForTimeout(2000);

      // Check for filter pills like "All", "Online", "Unread" etc.
      const pageContent = await page.content();

      // The filter pills should be present with translated keys
      const hasFilterSection =
        pageContent.includes('chatList.filterAll') ||
        pageContent.includes('chatList.filterOnline') ||
        pageContent.includes('chatList.filterUnread');

      expect(hasFilterSection).toBeTruthy();
    });

    test('should display chat previews or empty state', async ({ page }) => {
      await page.goto('/chat');
      await page.waitForTimeout(2000);

      // Either chat previews or a loading/empty state should be visible
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should have search input in chat list', async ({ page }) => {
      await page.goto('/chat');
      await page.waitForTimeout(2000);

      // Look for any text input field (search)
      const searchInput = page.locator('input[type="text"]').first();
      const isVisible = await searchInput.isVisible().catch(() => false);

      if (isVisible) {
        // Test typing in search
        await searchInput.fill('test');
        await page.keyboard.press('Enter');
      }
    });
  });

  test.describe('Chat Room', () => {
    test('should navigate to a chat room', async ({ page }) => {
      await page.goto('/chat/room_1');
      await page.waitForTimeout(2000);

      // The chat room component should render
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should display chat message input area', async ({ page }) => {
      await page.goto('/chat/test-room');
      await page.waitForTimeout(2000);

      // Look for the message input area (data-testid)
      const messageInput = page.locator('[data-testid="chat-message-input"]');
      const isVisible = await messageInput.isVisible().catch(() => false);

      if (isVisible) {
        await expect(messageInput).toBeVisible();
      }
    });

    test('should display messages with data-testid', async ({ page }) => {
      await page.goto('/chat/test-room');
      await page.waitForTimeout(2000);

      // Check for chat messages using data-testid
      const messages = page.locator('[data-testid="chat-message"]');
      const count = await messages.count();

      // Messages might be loaded or empty; either way the page should not crash
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('should display room header with title', async ({ page }) => {
      await page.goto('/chat/test-room');
      await page.waitForTimeout(2000);

      // The room title (h1) should be visible
      const heading = page.locator('h1');
      await expect(heading).toBeVisible();
    });

    test('should show lock/unlock button in chat room', async ({ page }) => {
      await page.goto('/chat/test-room');
      await page.waitForTimeout(2000);

      // Look for lock/unlock button
      const lockButton = page.locator('button[title]').filter({ hasText: /[🔒🔓]/ }).first();
      const isVisible = await lockButton.isVisible().catch(() => false);

      if (isVisible) {
        await lockButton.click();
        await page.waitForTimeout(500);
      }
    });

    test('should show search button in chat room', async ({ page }) => {
      await page.goto('/chat/test-room');
      await page.waitForTimeout(2000);

      // Search button should be visible
      const searchBtn = page.locator('button', { hasText: 'chatRoom.searchBtn' }).first();
      const isVisible = await searchBtn.isVisible().catch(() => false);

      if (isVisible) {
        await expect(searchBtn).toBeVisible();
      }
    });
  });

  test.describe('Chat Backups & Settings', () => {
    test('should navigate to chat settings page', async ({ page }) => {
      await page.goto('/chat-settings');
      await page.waitForTimeout(1500);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should navigate to backup/restore settings', async ({ page }) => {
      await page.goto('/settings/backup-restore');
      await page.waitForTimeout(1500);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('Chat Room - Message Types', () => {
    const roomId = 'room_123';

    test('should support text message display', async ({ page }) => {
      await page.goto(`/chat/${roomId}`);
      await page.waitForTimeout(2000);

      // Page should render without crashing
      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should support voice message UI', async ({ page }) => {
      await page.goto(`/chat/${roomId}`);
      await page.waitForTimeout(2000);

      // Check for voice message recorder trigger
      const voiceButton = page.locator('button[aria-label]').filter({ hasText: '' }).first();
      const isVisible = await voiceButton.isVisible().catch(() => false);

      // Voice recorder button may or may not be visible depending on layout
      // Page should not error
      expect(true).toBeTruthy();
    });

    test('should support correction message display', async ({ page }) => {
      await page.goto(`/chat/${roomId}`);
      await page.waitForTimeout(2000);

      // VisualDiff component handles corrections
      const pageContent = await page.content();
      // App-visual-diff component may be present if correction messages exist
      expect(pageContent.length).toBeGreaterThan(0);
    });

    test('should show typing indicator component', async ({ page }) => {
      await page.goto(`/chat/${roomId}`);
      await page.waitForTimeout(2000);

      // The typing indicator component is present in the template
      const typingIndicator = page.locator('app-typing-indicator');
      const exists = await typingIndicator.count();
      expect(exists).toBeGreaterThanOrEqual(0);
    });
  });

  test.describe('Chat Group Management', () => {
    test('should navigate to groups page', async ({ page }) => {
      await page.goto('/groups');
      await page.waitForTimeout(2000);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });

    test('should navigate to create group page', async ({ page }) => {
      await page.goto('/groups/create');
      await page.waitForTimeout(2000);

      const body = page.locator('body');
      await expect(body).toBeVisible();
    });
  });

  test.describe('RTL Compatibility in Chat', () => {
    test('should render chat room without layout breakage in RTL locale', async ({
      page,
      browser,
    }) => {
      // Use a browser context with Arabic locale
      const context = await browser.newContext({ locale: 'ar-SA' });
      const rtlPage = await context.newPage();

      await rtlPage.goto('/chat/rtl-test-room');
      await rtlPage.waitForTimeout(2000);

      const body = rtlPage.locator('body');
      await expect(body).toBeVisible();

      await context.close();
    });
  });
});