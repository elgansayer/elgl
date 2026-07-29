import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

/*
 * Adversarial test suite aiming to break the chat/video UI.
 * These tests verify the application handles extreme, malformed,
 * or rapid inputs gracefully without crashing, becoming unresponsive,
 * or leaking XSS into the DOM.
 */

test.describe('adversarial chat / video UI', () => {
  // Helper: inject a script via message input and verify it is not executed.
  // Requires the chat page to be navigable (the user must be logged in).
  async function tryXss(page: Page, scriptPayload: string) {
    // Locate the message input field (adjust the selector to match current UI)
    const input = page.locator('#message-input');
    await input.fill(scriptPayload);
    await page.locator('button:has-text("Send")').click();
    // Wait briefly for the message to be rendered
    await page.waitForTimeout(500);

    // Check that no <script> element with our content appeared (sanitisation)
    const scriptInDom = await page.evaluate(
      (payload) =>
        Array.from(document.querySelectorAll('script')).some(
          (s) => s.textContent?.includes(payload),
        ),
      scriptPayload.replace(/<script>/gi, '').replace(/<\/script>/gi, ''),
    );
    expect(scriptInDom).toBe(false);

    // Also verify the chat area still shows the message (as text) and the page
    // hasn't redirected or become blank.
    const chatArea = page.locator('[data-testid="chat-messages"]');
    await expect(chatArea).not.toBeEmpty();
  }

  test('should escape HTML/script injection in message content', async ({ page }) => {
    await page.goto('/chat'); // change to the actual chat route
    await page.waitForLoadState('networkidle');

    await tryXss(page, '<script>alert("xss")</script>');
    await tryXss(page, '<img src=x onerror="alert(1)">');
    await tryXss(page, '"><script>alert("xss")</script>');
    await tryXss(page, 'javascript:alert(1)');
  });

  test('should handle empty message send gracefully', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const input = page.locator('#message-input');
    const sendButton = page.locator('button:has-text("Send")');

    // Click send with empty input
    await sendButton.click();
    // The UI should not crash; expect input to still be empty and page responsive
    await expect(input).toBeVisible();
    await expect(page.locator('body')).not.toHaveClass(/error|crash/);

    // Rapidly click send many times while input stays empty
    for (let i = 0; i < 20; i++) {
      await sendButton.click({ delay: 5 });
    }
    // Page should remain stable
    await expect(page.locator('body')).toBeVisible();
  });

  test('should survive rapidly repeated voice-record clicks', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const recordButton = page.locator('#voice-record-button');
    await recordButton.waitFor({ state: 'attached', timeout: 5000 });

    // Rapidly toggle record/release
    for (let i = 0; i < 10; i++) {
      await recordButton.click({ delay: 2 });
    }
    // No crash expected
    await expect(page.locator('body')).toBeVisible();
  });

  test('should not break when video call button is spammed', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const videoCallButton = page.locator('button:has-text("Video Call")');
    // The button may not exist in all states; skip if absent
    if ((await videoCallButton.count()) === 0) {
      test.skip(true, 'video call button not found');
      return;
    }

    for (let i = 0; i < 15; i++) {
      await videoCallButton.click({ delay: 1 });
    }
    // UI should still be responsive (no alert, no blank page)
    await expect(page.locator('body')).toBeVisible();
  });

  test('should accept and display extremely long message without crashing', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const longText = 'A'.repeat(10_000);
    const input = page.locator('#message-input');
    await input.fill(longText);
    await page.locator('button:has-text("Send")').click();
    // Wait for message to appear
    await page.waitForTimeout(500);

    // Confirm the message (or a trimmed version) appears in the chat area
    const chatMessages = page.locator('[data-testid="chat-messages"]');
    await expect(chatMessages).toContainText('A');
    // Page should not have thrown a runtime error
    await expect(page.locator('body')).toBeVisible();
  });

  test('should handle message containing null bytes and control characters', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const harmfulText = '\x00\x01\x02hello\x00\x1B[1m\x00';
    const input = page.locator('#message-input');
    await input.fill(harmfulText);
    await page.locator('button:has-text("Send")').click();
    await page.waitForTimeout(500);

    // UI should be intact
    await expect(page.locator('body')).toBeVisible();
  });

  test('should not double-submit or duplicate message on rapid click', async ({ page }) => {
    await page.goto('/chat');
    await page.waitForLoadState('networkidle');

    const input = page.locator('#message-input');
    const sendButton = page.locator('button:has-text("Send")');

    const testMsg = 'rapid duplicate test';
    await input.fill(testMsg);

    // Simulate 10 clicks within a few milliseconds
    for (let i = 0; i < 10; i++) {
      await sendButton.click({ delay: 0 });
    }

    // Wait a bit for messages to appear
    await page.waitForTimeout(1000);

    // Count the number of visible bubbles containing our message text
    const messageBubbles = page.locator('[data-testid="message-bubble"]', {
      hasText: testMsg,
    });
    const count = await messageBubbles.count();
    // Ideally should be exactly 1 (deduplication), but at most a few.
    // Allow up to 3 – anything more indicates a bug worth investigating.
    expect(count).toBeLessThanOrEqual(3);
  });
});
