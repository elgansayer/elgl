import { test, expect } from '@playwright/test';

test.describe('Chat UI Stress and Edge Case Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a test chat room. Adjust the URL to match your local routing.
    await page.goto('http://localhost:4200/chat/room_chaos_999');
  });

  test('should handle rapid message submission without crashing or duplicating state', async ({ page }) => {
    // Adjust selectors based on your actual Angular component templates
    const chatInput = page.locator('textarea, input[type="text"]').first();
    const sendButton = page.locator('button[aria-label="Send"], [data-testid="send-button"]').first();

    await chatInput.waitFor({ state: 'visible' });

    // Fire 50 messages in rapid succession to test signal reactivity and Centrifugo queueing
    for (let i = 0; i < 50; i++) {
      await chatInput.fill(`Rapid fire message ${i}`);
      await sendButton.click();
    }

    // Verify the UI remains responsive and the last message is rendered
    const messages = page.locator('.chat-message, [data-testid="chat-message"]');
    await expect(messages.last()).toContainText('Rapid fire message 49', { timeout: 15000 });
  });

  test('should handle extremely long text payloads gracefully', async ({ page }) => {
    const chatInput = page.locator('textarea, input[type="text"]').first();
    const sendButton = page.locator('button[aria-label="Send"], [data-testid="send-button"]').first();

    await chatInput.waitFor({ state: 'visible' });

    // Generate a 50,000 character string to test virtual scrolling and segmenter performance
    const longString = 'A'.repeat(50000);
    await chatInput.fill(longString);
    await sendButton.click();

    // Verify the page does not crash and the message is added to the DOM
    const messages = page.locator('.chat-message, [data-testid="chat-message"]');
    await expect(messages.last()).toBeVisible({ timeout: 10000 });
  });

  test('should handle rapid toggling of the long-press context menu', async ({ page }) => {
    // Ensure at least one message exists to interact with
    const chatInput = page.locator('textarea, input[type="text"]').first();
    const sendButton = page.locator('button[aria-label="Send"], [data-testid="send-button"]').first();
    
    await chatInput.fill('Context menu test message');
    await sendButton.click();

    const lastMessage = page.locator('.chat-message, [data-testid="chat-message"]').last();
    await lastMessage.waitFor({ state: 'visible' });

    // Simulate rapid right-clicks / long presses to test the context menu signal state
    for (let i = 0; i < 20; i++) {
      await lastMessage.click({ button: 'right' });
      // Click away to close
      await page.mouse.click(0, 0);
    }

    // Verify the context menu can still open and close normally after spamming
    await lastMessage.click({ button: 'right' });
    const contextMenu = page.locator('.context-menu-popup');
    await expect(contextMenu).toBeVisible();
    
    await page.mouse.click(0, 0);
    await expect(contextMenu).toBeHidden();
  });
});
