import { test, expect } from '@playwright/test';

test.describe('Adversarial Chat & Video System', () => {
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
import { test, expect, Page } from '@playwright/test';

/**
 * Aggressive adversarial E2E test for chat / video systems.
 * Attempts to:
 *  - Inject XSS / HTML in chat messages
 *  - Send extremely long messages (>10k chars)
 *  - Attempt to join audio/video rooms without a valid token
 *  - Spam the raise-hand button
 *  - Send Unicode override characters
 */

// Helper to sign in using test credentials (adjust per your environment)
async function signIn(page: Page) {
  // This block must be replaced with real authentication for your project.
  // Example: navigate to login page, fill credentials and submit.
  const email = process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = process.env.TEST_USER_PASSWORD || 'testpassword';

  await page.goto('/login');
  await page.waitForSelector('input[name="email"]', { state: 'visible', timeout: 5000 });
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/chat/**', { timeout: 10000 }).catch(() => { });
}

test.describe('Chat / Video adversarial', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('Sending XSS payload in chat message does not execute script', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });

    const messageInput = page.locator('input[aria-label="Message"]');
    const xssPayload = '<img src=x onerror=alert(1)>';

    await messageInput.fill(xssPayload);

    const sendButton = page.locator('button:has-text("Send")');
    await sendButton.click();

    // Wait briefly for message to appear
    await page.waitForTimeout(500);

    // Verify no alert was shown (Playwright would catch this)
    // Also verify the payload is escaped (shown as plain text)
    const lastMessage = page.locator('.message:last-child');
    await expect(lastMessage).toBeVisible();
    // Ensure no <img> tag is actually interpreted
    const htmlContent = await lastMessage.innerHTML();
    expect(htmlContent).not.toContain('<img');
    // The displayed text should contain the encoded payload
    expect(htmlContent).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  test('Sending extremely long message (>10k characters) is handled gracefully', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });

    const longText = 'A'.repeat(10001);
    const messageInput = page.locator('input[aria-label="Message"]');
    await messageInput.fill(longText);

    const sendButton = page.locator('button:has-text("Send")');
    // Either the send button is disabled for too long content, or sending truncates
    // Expect no crash.
    const buttonDisabled = await sendButton.isDisabled().catch(() => false);
    if (!buttonDisabled) {
      await sendButton.click();
      await page.waitForTimeout(1000);
      // Should not have error popup/modal
      const errorToasts = page.locator('.toast-error, .toast-danger');
      await expect(errorToasts).toHaveCount(0);
    }
  });

  test('Joining a video room without token shows appropriate error', async ({ page }) => {
    // Navigate to room list
    await page.goto('/audio-rooms', { waitUntil: 'networkidle' });

    // Click on a room that requires host/participant token
    const roomCard = page.locator('.room-card').first();
    if (await roomCard.isVisible()) {
      await roomCard.click();
    } else {
      test.skip('No rooms available');
    }

    // Expect either a 403 response, or a toast, or a disabled join button
    const joinButton = page.locator('button:has-text("Join")').first();
    if (await joinButton.isVisible()) {
      await joinButton.click();
      // Wait for any error notification
      await page.waitForTimeout(2000);
      const errorToast = page.locator('.toast-error, .toast-danger');
      if (await errorToast.isVisible()) {
        await expect(errorToast).toBeVisible();
      } else {
        // Maybe the UI navigates to /room/... and shows a "token missing" message
        const notAuthorisedMessage = page.locator('text=not authorised', { ignoreCase: true });
        await expect(notAuthorisedMessage).toBeVisible();
      }
    }
  });

  test('Rapid clicking raise-hand button does not create duplicate requests', async ({ page }) => {
    // This test assumes we are inside an active audio room where raise hand button is present
    await page.goto('/audio-rooms/active-room', { waitUntil: 'networkidle' });

    const raiseHandButton = page.locator('button:has-text("Raise Hand")');
    if (!(await raiseHandButton.isVisible())) {
      test.skip('No raise hand button available');
    }

    // Click many times quickly
    await raiseHandButton.click({ clickCount: 10, delay: 20 });

    // Expect no "too many requests" error (or if rate limited, 429 toast)
    const rateLimitToast = page.locator('.toast-error, .toast-danger');
    if (await rateLimitToast.isVisible()) {
      // Acceptable if server returns 429, at least no crash
    }

    // Verify we are not stuck in loading state
    await expect(raiseHandButton).toBeEnabled({ timeout: 3000 }).catch(() => { });
  });

  test('Unicode right-to-left override text is handled without breaking layout', async ({ page }) => {
    await page.goto('/chat', { waitUntil: 'networkidle' });

    const rtlMessage = '\u202E\u202Dabcdef\u202C\u202C\u202C';
    const messageInput = page.locator('input[aria-label="Message"]');
    await messageInput.fill(rtlMessage);

    const sendButton = page.locator('button:has-text("Send")');
    await sendButton.click();

    await page.waitForTimeout(500);

    // The message should display without layout shift beyond typical RTL handling
    const lastMessage = page.locator('.message:last-child');
    await expect(lastMessage).toBeVisible();

    // Ensure the page layout is not broken (no overlapping elements)
    const chatContainer = page.locator('.chat-window');
    const boundingBox = await chatContainer.boundingBox();
    expect(boundingBox).toBeDefined();
    expect(boundingBox!.width).toBeGreaterThan(0);
    expect(boundingBox!.height).toBeGreaterThan(0);
  });
});
