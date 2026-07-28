import { test, expect } from '@playwright/test';

test.describe('Adversarial WebSocket Payload Injection', () => {
  test('should not crash the UI when receiving malformed or unexpected WebSocket messages', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));

    // Mock the chat room and token endpoints
    await page.route('**/chat/rooms/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'room_malformed_123',
          title: 'Malformed Payload Room',
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

    let mockWs: any;

    // Mock Centrifugo WebSocket
    await page.routeWebSocket(/connection\/websocket/, (ws) => {
      mockWs = ws;
      ws.onMessage((message) => {
        // Normal echo behavior
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
          // Ignore
        }
      });
    });

    // Navigate to the chat room
    await page.goto('/chat/room_malformed_123');

    // Wait for the chat interface to load
    const messageInput = page.locator('input[placeholder="Type a message..."], textarea');
    if ((await messageInput.count()) > 0) {
      await messageInput.fill('Initial normal message');
      await page.keyboard.press('Enter');
    }

    // Wait a moment for WS to connect and register
    await page.waitForTimeout(1000);

    if (mockWs) {
      // 1. Send completely invalid JSON
      mockWs.send('{ broken_json: "yes" ');

      // 2. Send valid JSON but missing expected Centrifugo wrapper
      mockWs.send(JSON.stringify({ random_data: true, nested: { deeply: true } }));

      // 3. Send valid Centrifugo wrapper but malformed chat payload (wrong types)
      mockWs.send(
        JSON.stringify({
          push: {
            channel: 'chat_room_malformed_123',
            pub: {
              data: {
                type: 'text',
                // Expected string, sending array of numbers
                content: [1, 2, 3, 4, 5],
                sender_id: null,
                // Expected boolean, sending object
                is_read: { value: 'not a boolean' },
              },
            },
          },
        }),
      );

      // 4. Send an unknown message type
      mockWs.send(
        JSON.stringify({
          push: {
            channel: 'chat_room_malformed_123',
            pub: {
              data: {
                type: 'hacker_type_does_not_exist',
                payload: 'DROP TABLE users;',
              },
            },
          },
        }),
      );

      // 5. Send a massive payload from the server
      mockWs.send(
        JSON.stringify({
          push: {
            channel: 'chat_room_malformed_123',
            pub: {
              data: {
                type: 'text',
                content: 'B'.repeat(50000),
                sender_id: 'evil_server',
              },
            },
          },
        }),
      );
    }

    // Wait to see if the frontend crashes from processing the garbage data
    await page.waitForTimeout(2000);

    // Verify the page is still responsive
    const body = page.locator('body');
    await expect(body).toBeVisible();

    // Ensure no fatal uncaught exceptions occurred in the Angular app
    const fatalErrors = errors.filter((e) => e.includes('Uncaught') || e.includes('Fatal'));
    expect(fatalErrors).toHaveLength(0);
  });
});
