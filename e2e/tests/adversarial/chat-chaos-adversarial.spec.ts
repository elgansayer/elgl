import { test, expect, Page } from '@playwright/test';

async function setupChaosEnvironment(page: Page) {
  // Mock the initial chat room load
  await page.route('**/chat/rooms/*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'room_chaos_999',
        title: 'Chaos Test Room',
        is_online: true,
        messages: []
      })
    });
  });

  // Mock Centrifugo token endpoint
  await page.route('**/chat/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'chaos-jwt-token' })
    });
  });

  // Mock message sending endpoint with a slight delay to encourage race conditions
  await page.route('**/chat/messages', async (route) => {
    setTimeout(async () => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: `msg_${Date.now()}` })
      });
    }, 50);
  });

  // Intercept WebSocket to simulate Centrifugo and allow injecting garbage data
  let wsConnection: any;
  await page.routeWebSocket(/connection\/websocket/, (ws) => {
    wsConnection = ws;
    ws.onMessage((message) => {
      const data = JSON.parse(message as string);
      if (data.connect) {
        ws.send(JSON.stringify({ id: data.id, connect: { client: 'chaos-client-id' } }));
      }
    });
  });

  return {
    injectGarbageWebsocketData: () => {
      if (wsConnection) {
        wsConnection.send(
          JSON.stringify({
            push: {
              channel: 'chat_room_chaos_999',
              pub: { data: { type: 'CORRUPT_PAYLOAD', content: undefined, nested: { deep: NaN } } }
            }
          })
        );
      }
    }
  };
}

test('should survive concurrent massive payloads, rapid clicks, and garbage websocket data', async ({ page }) => {
  const chaosEnv = await setupChaosEnvironment(page);
  
  await page.goto('/chat/room_chaos_999');

  const inputField = page.locator('textarea[name="chat-input"], input[name="chat-input"], [data-testid="chat-input"], textarea, input[type="text"]').first();
  const sendButton = page.locator('button[type="submit"], [data-testid="send-button"], button:has-text("Send")').first();

  await expect(inputField).toBeVisible({ timeout: 10000 });

  // 1. Prepare a massive payload
  const massiveString = 'CHAOS_'.repeat(10000); // 60k characters

  // 2. Execute concurrent adversarial actions
  await Promise.all([
    // Action A: Rapidly type and send massive payloads
    (async () => {
      for (let i = 0; i < 5; i++) {
        await inputField.fill(massiveString + i);
        await sendButton.click({ force: true, noWaitAfter: true });
      }
    })(),

    // Action B: Inject garbage data via WebSocket simultaneously
    (async () => {
      for (let i = 0; i < 20; i++) {
        chaosEnv.injectGarbageWebsocketData();
        await page.waitForTimeout(10);
      }
    })(),

    // Action C: Rapidly toggle offline/online mode to simulate network flapping
    (async () => {
      for (let i = 0; i < 3; i++) {
        await page.context().setOffline(true);
        await page.waitForTimeout(50);
        await page.context().setOffline(false);
        await page.waitForTimeout(50);
      }
    })()
  ]);

  // 3. Verify the application hasn't completely crashed (Error boundary check)
  const errorBoundary = page.locator('[data-testid="error-boundary"]');
  await expect(errorBoundary).toHaveCount(0);

  // 4. Verify the UI is still responsive and can accept normal input after the chaos
  await inputField.fill('Sanity check after chaos');
  await expect(inputField).toHaveValue('Sanity check after chaos');
});
