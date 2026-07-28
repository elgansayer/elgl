import { test, expect } from '@playwright/test';

test.describe('Adversarial Chat and Video Tests', () => {
  test('rapidly toggle video and spam chat with massive payloads', async ({ page }) => {
    // Mock the initial chat room load
    await page.route('**/chat/rooms/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'room_chaos_video_1',
          title: 'Chaos Video Room',
          is_online: true,
        }),
      });
    });

    await page.goto('/chat/room_chaos_video_1');

    // Wait for the chat input to be visible
    const chatInput = page
      .locator('textarea[name="chat-input"], input[name="chat-input"], [contenteditable="true"]')
      .first();
    const sendButton = page.locator('button[aria-label="Send"], button:has-text("Send")').first();
    const videoToggle = page
      .locator('button[aria-label="Toggle Video"], button:has-text("Video")')
      .first();

    // 1. Spam the video toggle button rapidly
    if (await videoToggle.isVisible()) {
      for (let i = 0; i < 20; i++) {
        await videoToggle.click();
      }
    }

    // 2. Inject a massive string into the chat
    if ((await chatInput.isVisible()) && (await sendButton.isVisible())) {
      const massiveString = 'A'.repeat(50000); // 50k characters
      await chatInput.fill(massiveString);
      await sendButton.click();

      // 3. Send rapid-fire empty or special character messages (Zalgo, RTL overrides, XSS)
      const specialChars = [
        '\0',
        '\n\n\n',
        '<script>alert(1)</script>',
        '👍🏽',
        'జ్ఞ‌ా',
        'Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢Lͨͧͽ̵̟̜͍͔̯ͯ̃ͯͪ͊ͧ͟͞G̦̝̑ͨ͊̋ͯͦ͂͆̀͢Ǫ̵̹̻̝̳͂̌̌͘!̵̡̠̰͕̿̋ͥͥ̂ͣ̐́́͞',
        '\u202E‮this is right to left text',
        '{"type": "fake_json_payload"}',
      ];

      for (const chars of specialChars) {
        await chatInput.fill(chars);
        await sendButton.click();
      }
    }

    // 4. Simulate network instability (offline/online toggling) while sending
    await page.context().setOffline(true);
    if (await chatInput.isVisible()) {
      await chatInput.fill('Message sent while offline');
      await sendButton.click();
    }

    // Rapidly toggle network state
    for (let i = 0; i < 5; i++) {
      await page.context().setOffline(false);
      await page.context().setOffline(true);
    }
    await page.context().setOffline(false);

    // 5. Verify the page hasn't crashed (basic check)
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Ensure no generic error overlays are present
    const errorOverlay = page.locator('.error-overlay, .crash-screen, .error-boundary');
    await expect(errorOverlay).toHaveCount(0);
  });
});
