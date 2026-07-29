import { test, expect, type Page } from '@playwright/test';

/*
  Adversarial (aggressive) E2E tests for the chat and video subsystems.
  These try to break the UI with:
    - XSS injection
    - extremely long messages
    - whitespace-only messages
    - rapid-fire sends
    - rapid navigation between chat and video rooms
    - right-to-left / multilingual characters (Arabic)
    - null-byte injection
  All tests assume the frontend is running on http://localhost:4200.
  Adjust selectors to match your actual component data-testid attributes.
*/

const BASE_URL = 'http://localhost:4200';

test.describe('Adversarial chat and video tests', () => {
  /* ------------------------------------------------------------------ */
  /*  1. XSS INJECTION                                                  */
  /* ------------------------------------------------------------------ */
  test('inject XSS into text message', async ({ page }) => {
    const xssPayload = '<script>alert("XSS")</script>';
    const input = page.locator('[data-testid="chat-message-input"]');
    await input.fill(xssPayload);
    await page.keyboard.press('Enter');

    // If an alert() fires, the test fails immediately
    page.on('dialog', async (dialog) => {
      await dialog.dismiss();
      throw new Error('XSS alert dialog appeared – vulnerability found!');
    });

    // Wait for the message to appear in the log
    const message = page.locator('[data-testid="chat-message"]').last();
    await expect(message).toContainText(xssPayload, { timeout: 10_000 });
  });

  /* ------------------------------------------------------------------ */
  /*  2. EXTREMELY LONG MESSAGE                                         */
  /* ------------------------------------------------------------------ */
  test('send extremely long message should not freeze UI', async ({ page }) => {
    const longMessage = 'A'.repeat(100_000);
    const input = page.locator('[data-testid="chat-message-input"]');
    const startTime = Date.now();
    await input.fill(longMessage);
    await page.keyboard.press('Enter');
    const endTime = Date.now();

    // UI must respond within 5 seconds
    expect(endTime - startTime).toBeLessThan(5000);

    // Ensure the chat is still usable (no crash)
    const messages = page.locator('[data-testid="chat-message"]');
    await expect(messages.first()).toBeVisible({ timeout: 10_000 });
  });

  /* ------------------------------------------------------------------ */
  /*  3. WHITESPACE-ONLY MESSAGE                                        */
  /* ------------------------------------------------------------------ */
  test('send message containing only whitespace', async ({ page }) => {
    const input = page.locator('[data-testid="chat-message-input"]');
    await input.fill('   ');
    await page.keyboard.press('Enter');

    // No new message should be created for whitespace-only content
    const messages = page.locator('[data-testid="chat-message"]');
    const countBefore = await messages.count();
    // Small wait for any potential (broken) insertion
    await page.waitForTimeout(500);
    const countAfter = await messages.count();
    expect(countAfter).toBe(countBefore);
  });

  /* ------------------------------------------------------------------ */
  /*  4. RAPID-FIRE SENDS                                               */
  /* ------------------------------------------------------------------ */
  test('rapid sends should not create duplicate or lost messages', async ({ page }) => {
    const input = page.locator('[data-testid="chat-message-input"]');
    for (let i = 0; i < 10; i++) {
      await input.fill(`message ${i}`);
      await page.keyboard.press('Enter');
    }

    await page.waitForTimeout(1000);
    const messages = page.locator('[data-testid="chat-message"]');
    const count = await messages.count();
    // Expect exactly 10 new messages (assuming chat was empty before this test)
    expect(count).toBe(10);
  });

  /* ------------------------------------------------------------------ */
  /*  5. RAPIDLY TOGGLE VIDEO ROOM WHILE MESSAGING                      */
  /* ------------------------------------------------------------------ */
  test('rapidly toggle video room while messaging should not break', async ({ page }) => {
    // Enter a video room (URL structure assumed)
    await page.goto(`${BASE_URL}/video/room123`);
    const joinBtn = page.locator('[data-testid="join-room"]');
    if (await joinBtn.isVisible()) {
      await joinBtn.click();
    }

    // Immediately navigate back to chat
    await page.goto(`${BASE_URL}/chat`);

    // Send a normal message
    const input = page.locator('[data-testid="chat-message-input"]');
    await input.fill('hello after cycle');
    await page.keyboard.press('Enter');

    const messages = page.locator('[data-testid="chat-message"]');
    await expect(messages.last()).toContainText('hello after cycle');
  });

  /* ------------------------------------------------------------------ */
  /*  6. RIGHT-TO-LEFT (RTL) CHARACTERS                                 */
  /* ------------------------------------------------------------------ */
  test('send message with right-to-left unicode characters', async ({ page }) => {
    const rtlText = 'مرحبا بالعالم'; // Arabic: “Hello world”
    const input = page.locator('[data-testid="chat-message-input"]');
    await input.fill(rtlText);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);
    const message = page.locator('[data-testid="chat-message"]').last();
    await expect(message).toContainText(rtlText);
  });

  /* ------------------------------------------------------------------ */
  /*  7. NULL-BYTE INJECTION                                            */
  /* ------------------------------------------------------------------ */
  test('send message containing null byte', async ({ page }) => {
    const nullByteMessage = 'test\u0000injection';
    const input = page.locator('[data-testid="chat-message-input"]');
    await input.fill(nullByteMessage);
    await page.keyboard.press('Enter');

    await page.waitForTimeout(500);
    const messages = page.locator('[data-testid="chat-message"]');
    // The null byte should be stripped or handled – the UI must not crash
    await expect(messages.last()).toContainText('test');
  });
});
