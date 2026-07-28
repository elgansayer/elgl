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
          participants: [
            { id: 'user_1', name: 'Attacker' },
            { id: 'user_2', name: 'Victim' },
          ],
        }),
      });
    });

    // Mock Centrifugo token endpoint
    await page.route('**/chat/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'fake_stress_token' }),
      });
    });

    // Mock message sending endpoint
    await page.route('**/chat/messages', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: `msg_${Date.now()}` }),
      });
    });

    // Navigate to the chat room
    await page.goto('/chat/room_stress_999');
  });

  test('should survive rapid video/audio toggling while receiving massive chat payloads', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => {
      pageErrors.push(error);
    });

    // 1. Rapidly toggle video and audio buttons to test for race conditions in LiveKit/WebRTC state
    const videoToggle = page
      .locator('button[aria-label="Toggle Video"], button:has-text("Video")')
      .first();
    const audioToggle = page
      .locator('button[aria-label="Toggle Audio"], button:has-text("Audio")')
      .first();

    // If the buttons exist in the UI, spam them
    if ((await videoToggle.isVisible()) && (await audioToggle.isVisible())) {
      for (let i = 0; i < 50; i++) {
        await videoToggle.click({ force: true });
        await audioToggle.click({ force: true });
      }
    }

    // 2. Inject massive and malicious chat payloads
    const chatInput = page
      .locator('textarea[placeholder*="message" i], input[placeholder*="message" i]')
      .first();
    const sendButton = page.locator('button[aria-label="Send"], button:has-text("Send")').first();

    if (await chatInput.isVisible()) {
      const maliciousPayloads = [
        'A'.repeat(50000), // Massive string
        'إختبار النص العربي مع RTL \u202E \u202D \u202C', // RTL override characters
        '<script>alert("xss")</script><img src=x onerror=alert(1)>', // Basic XSS
        '👩‍👩‍👧‍👦'.repeat(1000), // Heavy ZWJ emoji payload
        '{"type": "crash", "payload": null}', // Fake JSON structure
      ];

      for (const payload of maliciousPayloads) {
        await chatInput.fill(payload);
        await sendButton.click({ force: true });
      }
    }

    // 3. Verify the UI hasn't crashed (e.g., white screen of death)
    // The root app element should still be visible and not throw unhandled Angular exceptions
    const appRoot = page.locator('app-root');
    await expect(appRoot).toBeVisible();

    // Ensure no error dialogs or crash overlays are present
    const errorOverlay = page.locator('.error-overlay, .crash-screen');
    await expect(errorOverlay).toHaveCount(0);

    // Ensure no unhandled exceptions were thrown on the page
    expect(pageErrors).toEqual([]);
  });
});
