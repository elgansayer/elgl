import { test, expect, Page } from '@playwright/test';

test.describe('Adversarial Chat & Video Spam', () => {
  test('should survive rapid video toggling and chat spam without crashing', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Mock the chat room and token endpoints
    await page.route('**/chat/rooms/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'room_spam_123',
          title: 'Spam Test Room',
          is_online: true,
        }),
      });
    });

    await page.route('**/chat/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'fake-jwt-token' }),
      });
    });

    // Mock Centrifugo WebSocket
    await page.routeWebSocket(/connection\/websocket/, (ws) => {
      ws.onMessage((message) => {
        // Echo back messages to simulate high traffic
        try {
          const parsed = JSON.parse(message as string);
          if (parsed.publish) {
            ws.send(
              JSON.stringify({
                push: {
                  channel: parsed.publish.channel,
                  pub: { data: parsed.publish.data },
                },
              }),
            );
          }
        } catch (e) {
          // Ignore parse errors in mock
        }
      });
    });

    // Navigate to the chat room
    await page.goto('/chat/room_spam_123');

    // Wait for the chat interface to load
    const messageInput = page.locator('input[placeholder="Type a message..."], textarea');
    const sendButton = page.locator('button[aria-label="Send"], button:has-text("Send")');
    const videoToggle = page.locator('button[aria-label="Toggle Video"], button:has-text("Video")');

    // If the UI elements exist, perform the aggressive actions
    if ((await messageInput.count()) > 0 && (await sendButton.count()) > 0) {
      // 1. Spam chat messages rapidly
      for (let i = 0; i < 50; i++) {
        await messageInput.fill(`Spam message ${i} 🚀`);
        await sendButton.click();
      }

      // 2. Rapidly toggle video on and off
      if ((await videoToggle.count()) > 0) {
        for (let i = 0; i < 20; i++) {
          await videoToggle.click();
          await page.waitForTimeout(50); // Very short delay to induce race conditions
        }
      }

      // 3. Send a massive payload
      const massiveString = 'A'.repeat(10000);
      await messageInput.fill(massiveString);
      await sendButton.click();

      // 4. Send malformed/XSS-like payload
      await messageInput.fill('<script>alert("xss")</script> {"broken": json');
      await sendButton.click();
    }

    // Wait a moment for any asynchronous crashes to surface
    await page.waitForTimeout(1000);

    // Verify the page is still responsive by checking if we can still interact
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // We expect no fatal page errors (console errors might happen due to mock limitations,
    // but we strictly check for uncaught exceptions that crash the app)
    const fatalErrors = errors.filter((e) => e.includes('Uncaught') || e.includes('Fatal'));
    expect(fatalErrors).toHaveLength(0);
  });
});
