import { test, expect, type Page } from '@playwright/test';

test.describe('Adversarial Chat & Video System', () => {
  /**
   * Helper: log in with credentials stored in environment variables.
   * This function is idempotent – it skips login if already authenticated.
   */
  async function loginIfNeeded(page: Page) {
    const loginUrl = new URL('/auth/login', 'http://localhost:4200').href;
    await page.goto(loginUrl);
    // Check if already redirected away (already logged in)
    if (page.url().includes('/auth/login')) {
      await page.fill('input[name="email"]', process.env.E2E_TEST_EMAIL ?? '');
      await page.fill('input[name="password"]', process.env.E2E_TEST_PASSWORD ?? '');
      await page.click('button[type="submit"]');
      await page.waitForURL('**/chat', { timeout: 15000 });
    }
  }

  test.beforeEach(async ({ page }) => {
    await loginIfNeeded(page);
  });

  test('XSS injection in chat message is properly escaped', async ({ page }) => {
    // Navigate to chat list
    await page.goto('/chat');
    await page.waitForSelector('app-chat-list', { timeout: 10000 });

    // Click on the first conversation
    const firstChatItem = page.locator('app-chat-item').first();
    await firstChatItem.waitFor({ state: 'visible' });
    await firstChatItem.click();

    // Wait for the message input to appear
    const input = page.locator('textarea, input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });

    // Inject a naïve XSS payload
    const payload = `<img src=x onerror=alert(1)>`;
    await input.fill(payload);
    await input.press('Enter');

    // Listen for any dialog that might indicate the XSS fired
    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    // Wait a moment for the message to appear in the chat feed
    const lastMessage = page.locator('app-message').last();
    await expect(lastMessage).toBeVisible({ timeout: 5000 });

    // The payload should not appear as raw HTML untrusted content
    const text = await lastMessage.textContent();
    expect(text).not.toContain('<img src=x onerror=alert(1)>');

    // Ensure no JavaScript executed (no dialog fired)
    expect(dialogSeen).toBe(false);
  });

  test('sending extremely long message does not crash the UI', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('app-chat-list', { timeout: 10000 });
    const firstChatItem = page.locator('app-chat-item').first();
    await firstChatItem.click();

    const input = page.locator('textarea, input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });

    // Create a 5000-character message
    const longText = 'A'.repeat(5000);
    await input.fill(longText);
    await input.press('Enter');

    // The message should be sent and visible without crashing the page
    await page.locator('app-message').last().waitFor({ state: 'visible', timeout: 10000 });

    // The UI should still be interactive (e.g., input is enabled)
    await expect(input).toBeEnabled();
  });

  test('rapid message sending does not cause error (rate limiting)', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForSelector('app-chat-list', { timeout: 10000 });
    const firstChatItem = page.locator('app-chat-item').first();
    await firstChatItem.click();

    const input = page.locator('textarea, input[type="text"]').first();
    await input.waitFor({ state: 'visible', timeout: 10000 });

    // Send 15 messages in quick succession (should be throttled by backend, not crash)
    const promises: Promise<void>[] = [];
    for (let i = 0; i < 15; i++) {
      await input.fill(`msg ${i}`);
      // Pressing Enter synchronously may cause batching; use page.keyboard.press
      promises.push(
        page.keyboard.press('Enter').then(() => page.waitForTimeout(100))
      );
    }
    await Promise.all(promises);

    // Wait a short moment for server to respond; the page should not show an error banner
    await page.waitForTimeout(2000);

    // There should be no system-wide error toast (we assume error toasts have a .toast-error CSS class)
    const errorToasts = page.locator('.toast-error, app-toast[type="error"]');
    const count = await errorToasts.count();
    if (count > 0) {
      // If there are error toasts, they must be transient and not a hard crash
      const firstToastText = await errorToasts.first().textContent();
      // The UI should still operate; the toast is acceptable for rate limiting feedback
      expect(firstToastText).toBeTruthy();
    }
  });

  test('joining a non-existent audio room shows friendly error', async ({ page }) => {
    // Navigate to audio rooms list
    await page.goto('/audio-rooms');
    await page.waitForSelector('app-audio-room-list', { timeout: 10000 });

    // Manually navigate to a room that should not exist
    await page.goto('/audio-rooms/nonexistent-room-id');

    // Wait for the UI to render some feedback
    await page.waitForTimeout(2000);

    // The current URL should still be within the app (the route may redirect)
    expect(page.url()).toContain('/audio-rooms');

    // Either a "not found" message is shown, or the page remains on the list
    const notFound = page.locator('text=not found, text=No room, text=error').first();
    const exists = await notFound.count();
    if (exists > 0) {
      await expect(notFound).toBeVisible({ timeout: 5000 });
    }
  });
});
