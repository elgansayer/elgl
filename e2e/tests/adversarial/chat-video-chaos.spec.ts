import { test, expect } from '@playwright/test';

test.describe('Adversarial Chat & Video Chaos', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication and necessary tokens to bypass login
    await page.route('**/auth/session', (route) => 
      route.fulfill({ status: 200, json: { user: { id: 'chaos-tester-1', is_vip: true } } })
    );
    await page.route('**/chat/token', (route) => 
      route.fulfill({ status: 200, json: { token: 'fake-chaos-token' } })
    );
    // Mock Centrifugo WebSocket connection to prevent actual network hangs during spam
    await page.routeWebSocket(/connection\/websocket/, (ws) => {
      ws.onMessage((message) => {
        // Echo back a fake acknowledgment to keep the UI happy
        ws.send(JSON.stringify({ id: 1, type: 1 }));
      });
    });
  });

  test('should survive rapid video toggling and massive chat payload spam without crashing', async ({ page }) => {
    // Navigate to a hypothetical chat room
    await page.goto('/chat/chaos-room-999');

    // 1. Attempt to find the chat input and spam it with massive payloads
    const chatInput = page.locator('textarea, input[type="text"]').first();
    
    // Wait for the UI to render
    await page.waitForTimeout(1000);

    if (await chatInput.isVisible()) {
      const massiveString = 'ZALGO '.repeat(500) + ' 👾 '.repeat(100);
      
      // Fire 20 massive messages in rapid succession
      for (let i = 0; i < 20; i++) {
        await chatInput.fill(`Spam ${i}: ${massiveString}`);
        await page.keyboard.press('Enter');
        // Minimal wait to simulate aggressive typing/pasting
        await page.waitForTimeout(10);
      }
    }

    // 2. Rapidly toggle video/audio call buttons to trigger race conditions in LiveKit/WebRTC state
    const callButton = page.locator('button[aria-label*="call" i], button[aria-label*="video" i], button:has-text("Call")').first();
    
    if (await callButton.isVisible()) {
      for (let i = 0; i < 15; i++) {
        await callButton.click({ force: true });
        // Toggle faster than typical WebRTC negotiation takes
        await page.waitForTimeout(30);
      }
    }

    // 3. Inject malformed data into the DOM to test Angular's sanitization and error boundaries
    await page.evaluate(() => {
      const fakeMessage = document.createElement('div');
      fakeMessage.innerHTML = '<img src="x" onerror="while(true){}">';
      document.body.appendChild(fakeMessage);
    });

    // 4. Verify the application hasn't completely crashed (White Screen of Death)
    const rootElement = page.locator('app-root');
    await expect(rootElement).toBeVisible();

    // Ensure no generic Angular/JS error boundary text is displayed
    const errorBoundary = page.locator('text="An unexpected error occurred"');
    await expect(errorBoundary).not.toBeVisible();
  });
});
