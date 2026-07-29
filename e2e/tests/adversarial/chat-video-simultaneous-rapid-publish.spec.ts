import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:3000/api';
const USER_ID = 'adversarial-user-001';
const ROOM_ID = 'room_rapid_publish_001';

async function mockBackend(page: Page) {
  await page.route(`${API}/chat/rooms`, async (route) => {
    await route.fulfill({
      json: [
        {
          id: ROOM_ID,
          title: 'Rapid Publish Room',
          subtitle: 'en -> fr',
          avatar: 'R',
          is_online: true,
          is_pinned: false,
          created_at: new Date().toISOString(),
          admin_id: USER_ID,
        },
      ],
    });
  });

  await page.route(`${API}/chat/rooms/${ROOM_ID}`, async (route) => {
    await route.fulfill({
      json: {
        id: ROOM_ID,
        title: 'Rapid Publish Room',
        subtitle: 'en -> fr',
        avatar: 'R',
        is_online: true,
        is_pinned: false,
        created_at: new Date().toISOString(),
        admin_id: USER_ID,
      },
    });
  });

  await page.route(`${API}/chat/messages/${ROOM_ID}`, async (route) => {
    await route.fulfill({
      json: [
        {
          id: 'seed-msg-1',
          room_id: ROOM_ID,
          sender_id: 'other-user',
          message_type: 'text',
          text_content: 'Initial message',
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ],
    });
  });

  await page.route(`${API}/chat/token`, async (route) => {
    await route.fulfill({ json: { token: 'rapid-publish-test-token' } });
  });

  await page.route(`${API}/safety/blocked-ids`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/safety/blocked-and-blocker-ids/${USER_ID}`, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route(`${API}/groups`, (route) => route.fulfill({ json: [] }));

  // Catch any remaining API calls
  await page.route(`${API}/**`, (route) => {
    route.fulfill({ status: 200, json: {} });
  });
}

test.describe('Adversarial – rapid concurrent publish via WebSocket', () => {
  test('should not crash when receiving many messages rapidly while video room loads', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => consoleErrors.push(err.message));

    // Mock Centrifugo WebSocket
    let wsConnection: { send: (data: string) => void } | undefined;

    await page.routeWebSocket(/\/connection\/websocket/, (ws) => {
      wsConnection = ws;
      ws.onMessage((raw) => {
        const data = JSON.parse(raw as string);
        if (data.connect) {
          ws.send(
            JSON.stringify({
              id: data.id,
              connect: { client: 'adversarial-rapid-publish' },
            }),
          );
        }
        if (data.subscribe) {
          ws.send(
            JSON.stringify({
              id: data.id,
              subscribe: { code: 0, channel: data.subscribe.channel },
            }),
          );
        }
      });
    });

    await mockBackend(page);
    await page.goto(`/chat?roomId=${ROOM_ID}`);
    await page.waitForLoadState('networkidle');

    const channelName = `chat_${ROOM_ID}`;
    const MESSAGE_COUNT = 100;

    for (let i = 0; i < MESSAGE_COUNT; i++) {
      if (wsConnection) {
        const eventData = {
          type: 'message',
          data: {
            id: `rapid-msg-${i}`,
            room_id: ROOM_ID,
            sender_id: 'other-user',
            message_type: 'text',
            text_content: `Rapid message #${i}`,
            created_at: new Date().toISOString(),
          },
        };
        wsConnection.send(
          JSON.stringify({
            id: `pub-${i}`,
            type: 'push',
            channel: channelName,
            data: eventData,
          }),
        );
      }
      // small delay to reflect realistic timing
      await page.waitForTimeout(5);
    }

    // Let the UI settle
    await page.waitForTimeout(300);

    // Simulate a concurrent video room creation request while messages are being processed
    await page.evaluate(async () => {
      await fetch(`${API}/audio-rooms/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'stress test room', language: 'en' }),
      });
    });

    await page.waitForTimeout(200);

    // Verify no crashes
    expect(consoleErrors).toEqual([]);

    // Verify that at least some messages are rendered
    const visibleMessages = await page.locator('[data-testid="chat-message"]').count();
    expect(visibleMessages).toBeGreaterThan(1);
  });
});
