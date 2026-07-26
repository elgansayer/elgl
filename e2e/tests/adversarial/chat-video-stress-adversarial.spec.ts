import { test, expect, Page } from '@playwright/test';

test.describe('Adversarial Chat & Video Stress Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock the initial chat room load to prevent actual backend calls during stress test
    await page.route('**/chat/rooms/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'room_stress_999',
          title: 'Stress Test Room',
          is_online: true,
          participants: []
        }),
      });
    });

    // Mock Centrifugo token endpoint
    await page.route('**/chat/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'fake-stress-token' }),
      });
    });

    // Navigate to a hypothetical chat/video room
    await page.goto('/chat/room_stress_999');
  });

  test('should survive rapid video toggling and massive chat payload spam', async ({ page }) => {
    // 1. Wait for the chat interface to load
    const chatInput = page.locator('textarea[placeholder*="message" i], input[placeholder*="message" i]').first();
    const sendButton = page.locator('button[aria-label*="send" i], button:has-text("Send")').first();
    
    // Wait for input to be ready, if it doesn't exist the test will fail here (which is good for E2E)
    await expect(chatInput).toBeVisible({ timeout: 10000 });

    // 2. Rapidly toggle video/audio buttons if they exist in the DOM
    // We use a soft assertion/try-catch because the exact selectors depend on the UI state
    const videoToggle = page.locator('button[aria-label*="video" i]').first();
    const audioToggle = page.locator('button[aria-label*="audio" i], button[aria-label*="mic" i]').first();

    if (await videoToggle.isVisible()) {
      for (let i = 0; i < 20; i++) {
        await videoToggle.click();
        // Minimal delay to simulate frantic clicking
        await page.waitForTimeout(10); 
      }
    }

    if (await audioToggle.isVisible()) {
      for (let i = 0; i < 20; i++) {
        await audioToggle.click();
        await page.waitForTimeout(10);
      }
    }

    // 3. Generate a massive, malicious payload
    // Includes RTL override characters, emojis, Zalgo text, and massive length
    const zalgo = 'T̵h̵i̵s̵ ̵i̵s̵ ̵Z̵a̵l̵g̵o̵ ̵t̵e̵x̵t̵';
    const rtlOverride = '\u202E'; // Right-to-Left Override
    const massiveString = 'A'.repeat(50000);
    const maliciousPayload = `${rtlOverride}${zalgo} 😈 ${massiveString}`;

    // 4. Spam the chat input
    await chatInput.fill(maliciousPayload);
    
    if (await sendButton.isVisible()) {
      // Click send multiple times rapidly
      for (let i = 0; i < 5; i++) {
        await sendButton.click();
      }
    } else {
      // Fallback to Enter key
      for (let i = 0; i < 5; i++) {
        await chatInput.press('Enter');
      }
    }

    // 5. Assertions: The UI should not have crashed (e.g., no Angular error overlay, input still usable)
    // Check that the app root is still visible and hasn't been replaced by a fatal error screen
    const appRoot = page.locator('app-root');
    await expect(appRoot).toBeVisible();

    // The chat input should still be in the DOM and interactive, proving the app didn't freeze
    await expect(chatInput).toBeVisible();
    await expect(chatInput).toBeEnabled();

    // Check for absence of common error boundary text
    const errorText = page.locator('text="An unexpected error occurred"');
    await expect(errorText).toHaveCount(0);
  });
});
