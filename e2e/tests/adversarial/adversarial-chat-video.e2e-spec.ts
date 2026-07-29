import { test, expect } from '@playwright/test';

test.describe('Adversarial Chat/Video Break', () => {
  test('should not crash with malicious XSS injection in chat input', async ({ page }) => {
    // Navigate to a chat conversation (the app should handle unknown users gracefully)
    await page.goto('/chat/unknown-user-id');

    // Locate the chat input field (assumes a data-testid attribute)
    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Attempt to inject a script via the input
    await chatInput.fill('<script>alert("xss")</script>');
    await chatInput.press('Enter');

    // Wait for the message to be processed (or sanitised)
    await page.waitForTimeout(1000);

    // The browser should never show a JavaScript alert from our injection
    page.on('dialog', (dialog) => {
      // If a dialog appears, the XSS attack succeeded – fail the test
      dialog.dismiss();
      throw new Error(`Unexpected ${dialog.type()} dialog – XSS injection likely worked`);
    });

    // Ensure the message list is still visible and the page isn't broken
    const messagesContainer = page.locator('[data-testid="chat-messages"]');
    await expect(messagesContainer).toBeVisible();
  });

  test('should not crash when flooding many rapid messages', async ({ page }) => {
    await page.goto('/chat/unknown-user-id');

    const chatInput = page.locator('[data-testid="chat-input"]');
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // Rapidly send 50 messages
    for (let i = 0; i < 50; i++) {
      await chatInput.fill(`Flood message number ${i}`);
      await chatInput.press('Enter');
    }

    // Allow UI to catch up
    await page.waitForTimeout(2000);

    // Verify that at least some messages are rendered
    const messageCount = await page.locator('[data-testid="chat-messages"] > *').count();
    expect(messageCount).toBeGreaterThan(0);
  });

  test('should deny access to a video room without a valid token', async ({ page }) => {
    // Attempt to join a non‑existent room with an empty token
    const response = await page.goto('/video-rooms/join-room?roomId=invalid&token=', {
      waitUntil: 'networkidle',
    });

    // The server should redirect to login or show an access-denied message
    expect(page.url()).toMatch(/(login|error|auth)/i);
    expect(response?.status()).toBeLessThan(500); // no server crash
  });
});
