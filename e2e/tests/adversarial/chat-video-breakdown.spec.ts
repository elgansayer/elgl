import { test, expect } from '@playwright/test';

test.describe('Adversarial Chat / Video System Breakage', () => {

  test('send empty message does not break UI', async ({ page }) => {
    // navigate to a chat page – the specific URL may need adjustment
    await page.goto('/chat?user=testuser');
    const input = page.locator('[data-testid="chat-message-input"], textarea, .chat-input');
    await input.fill('');
    await page.keyboard.press('Enter');
    // wait a moment to let any error toast appear
    await page.waitForTimeout(2000);
    // verify the chat input is still present and the UI is not frozen
    await expect(input).toBeVisible();
  });

  test('send very long message (50 000 chars) not crash', async ({ page }) => {
    await page.goto('/chat?user=testuser');
    const input = page.locator('[data-testid="chat-message-input"], textarea, .chat-input');
    const longText = 'a'.repeat(50000);
    await input.fill(longText);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000);
    // the last sent bubble should exist and its text should be <= 50000 characters
    const sentBubbles = page.locator('.message-sent, .own-message');
    const lastBubble = sentBubbles.last();
    const text = await lastBubble.textContent();
    expect(text.length).toBeLessThanOrEqual(50000);
  });

  test('send dozens rapid messages', async ({ page }) => {
    await page.goto('/chat?user=testuser');
    const input = page.locator('[data-testid="chat-message-input"], textarea, .chat-input');
    const messageCount = 50;
    for (let i = 0; i < messageCount; i++) {
      await input.fill(`message ${i}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(80); // slight throttle to mimic real usage
    }
    // expect at least 50 messages rendered
    const messages = page.locator('.message-bubble, .chat-message');
    const count = await messages.count();
    expect(count).toBeGreaterThanOrEqual(messageCount);
  });

  test('attempt to join a video room without permission', async ({ page }) => {
    await page.goto('/audio-rooms');
    // click the first room card that appears
    const roomCard = page.locator('[data-testid="room-card"], .room-card').first();
    await roomCard.click();
    // an access‑denied dialog or toast should appear
    const denial = page.locator('text=Access denied').or(page.locator('text=unauthorised'));
    await expect(denial).toBeVisible({ timeout: 10000 });
  });

  test('simulate network offline while sending a message', async ({ page }) => {
    await page.goto('/chat?user=testuser');
    const input = page.locator('[data-testid="chat-message-input"], textarea, .chat-input');
    // go offline
    await page.context().setOffline(true);
    await input.fill('offline message');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1500);
    // restore connection
    await page.context().setOffline(false);
    // the sent message should eventually appear after reconnect
    const sentBubble = page.locator('.message-sent, .own-message').last();
    await expect(sentBubble).toContainText('offline message', { timeout: 15000 });
  });

  test('upload a non‑image file to moment creation', async ({ page }) => {
    await page.goto('/moments');
    // locate the file picker – moment creation typically has an input[type="file"]
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'malicious.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('hello'),
    });
    // the UI should show a validation message
    const validationMessage = page.locator('text=only images are allowed')
      .or(page.locator('text=unsupported file type'));
    await expect(validationMessage).toBeVisible({ timeout: 5000 });
  });
});
