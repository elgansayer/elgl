import { test, expect, Page } from '@playwright/test';

/**
 * Targets chat-room.component.ts's setupRealTime() (line ~154-168):
 *
 *   this.subscription = this.centrifugeService.subscribe(`chat:${this.roomId}`, (data) => {
 *     const payload = data as { message?: ChatMessage; typing?: boolean } | null;
 *     if (payload?.message) {
 *       this.messages.update((list) => [...list, payload.message!]);
 *     }
 *     ...
 *   });
 *
 * Every other code path in this file that adds a message to the `messages`
 * signal (sendTextMessage, sendCorrection, onDoodleSaved, onVoiceUploaded,
 * sendSticker) guards against duplicates with
 * `list.some((m) => m.id === sent.id) ? list : [...list, sent]`. The live
 * Centrifugo push handler is the one exception: it unconditionally appends
 * whatever `payload.message` it receives, with no id-based dedup at all.
 *
 * Centrifugo (like most pub/sub transports) only offers at-least-once
 * delivery: a client that reconnects and resubscribes to a channel, or a
 * server that retries a publish after an ambiguous ack, can and does deliver
 * the same publication twice. When that happens here, the exact same message
 * object (same `id`) is pushed into the `messages` array twice.
 *
 * The template then renders that array with `@for (msg of filteredMessages();
 * track msg.id)` (chat-room.component.html line ~107). Angular's built-in
 * `@for` track function requires unique keys - feeding it two array entries
 * that share an `id` is a documented error condition (NG0955: "track
 * expression resulted in duplicate keys"), which Angular's default
 * ErrorHandler either throws as an uncaught error or logs loudly to the
 * console, generally aborting that change-detection pass for the whole
 * list - collateral damage far beyond the one redelivered message, identical
 * in spirit to the sibling malformed-timestamp bug in this same @for loop.
 */

const API = 'http://localhost:3000/api';
const MOCK_USER_ID = 'mock-user-123'; // AuthService falls back to MOCK_CURRENT_USER when unauthenticated
const ROOM_ID = 'centrifugo-duplicate-push-adversarial-room';

function makeRoom() {
  return {
    id: ROOM_ID,
    title: 'Duplicate Push Adversarial Room',
    subtitle: 'en -> fr',
    avatar: 'D',
    is_online: true,
    is_pinned: false,
    created_at: new Date().toISOString(),
    admin_id: MOCK_USER_ID,
  };
}

async function mockChatApi(page: Page, messages: unknown[]) {
  const room = makeRoom();

  // Catch-all registered first: Playwright matches routes in reverse
  // registration order, so specific routes added after this one win.
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 200, json: {} }));

  await page.route(`${API}/chat/rooms`, (route) => route.fulfill({ json: [room] }));
  await page.route(`${API}/chat/rooms/${ROOM_ID}`, (route) => route.fulfill({ json: room }));
  await page.route(`${API}/chat/messages/${ROOM_ID}*`, (route) => route.fulfill({ json: messages }));
  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'fake-centrifugo-token' } }),
  );
  await page.route(`${API}/safety/blocked-ids`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/safety/blocked-and-blocker-ids/${MOCK_USER_ID}`, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route(`${API}/groups`, (route) => route.fulfill({ json: [] }));
}

async function mockCentrifugoConnection(page: Page) {
  let wsConnection: { send: (data: string) => void } | undefined;

  await page.routeWebSocket(/connection\/websocket/, (ws) => {
    wsConnection = ws;
    ws.onMessage((raw) => {
      const data = JSON.parse(raw as string);
      if (data.connect) {
        ws.send(JSON.stringify({ id: data.id, connect: { client: 'duplicate-push-adversarial-client' } }));
      }
      if (data.subscribe) {
        ws.send(JSON.stringify({ id: data.id, subscribe: { code: 0, channel: data.subscribe.channel } }));
      }
    });
  });

  return {
    push: (channel: string, data: unknown) => {
      if (!wsConnection) throw new Error('WebSocket connection not established yet');
      wsConnection.send(JSON.stringify({ push: { channel, pub: { data } } }));
    },
  };
}

test.describe('Adversarial: redelivered Centrifugo publication duplicates a chat message', () => {
  test('the same live-pushed message id delivered twice must not render two bubbles or crash the list', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const seedMessage = {
      id: 'seed-msg',
      room_id: ROOM_ID,
      sender_id: 'other-user',
      message_type: 'text',
      text_content: 'Seed message before the redelivery',
      created_at: new Date(Date.now() - 60000).toISOString(),
    };

    await mockChatApi(page, [seedMessage]);
    const centrifugo = await mockCentrifugoConnection(page);

    await page.goto(`/chat/${ROOM_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Seed message before the redelivery')).toBeVisible({
      timeout: 5000,
    });

    const REDELIVERED_TEXT = 'This message got redelivered by the transport';
    const redeliveredMessage = {
      id: 'redelivered-msg',
      room_id: ROOM_ID,
      sender_id: 'other-user',
      message_type: 'text',
      text_content: REDELIVERED_TEXT,
      created_at: new Date().toISOString(),
    };

    // Simulate the same publication being delivered twice - exactly what an
    // at-least-once transport does on a resubscribe/reconnect race, or a
    // server retrying a publish it wasn't sure had been acked.
    centrifugo.push(`chat:${ROOM_ID}`, { message: redeliveredMessage });
    centrifugo.push(`chat:${ROOM_ID}`, { message: redeliveredMessage });

    await page.waitForTimeout(1000);

    // A well-behaved room must still be alive after a redelivered publication,
    // whether or not it renders the duplicate correctly.
    await expect(page.locator('app-root')).toBeVisible();

    const redeliveredBubbles = page.locator('[data-testid="chat-message"]', {
      hasText: REDELIVERED_TEXT,
    });
    const bubbleCount = await redeliveredBubbles.count();

    const sawTrackKeyError =
      pageErrors.some((e) => /NG0955|duplicate key|track/i.test(e.message)) ||
      consoleErrors.some((e) => /NG0955|duplicate key|track/i.test(e));

    // BUG: setupRealTime()'s Centrifugo push handler has no id-based dedup
    // (unlike every other message-adding path in chat-room.component.ts), so
    // a redelivered publication either renders the same message twice, or -
    // because the template tracks by `msg.id` - trips Angular's duplicate-key
    // guard and breaks the list instead. Neither outcome is what a correctly
    // deduplicated chat should do (exactly one bubble, no error).
    expect(
      bubbleCount === 2 || sawTrackKeyError,
      `Expected either a duplicate-rendered bubble (found ${bubbleCount}, want exactly 1 if deduped) ` +
        `or an Angular duplicate-track-key error to surface, proving the live Centrifugo push handler ` +
        `does not deduplicate by message id. Page errors: ${pageErrors.map((e) => e.message).join('; ')} | ` +
        `Console errors: ${consoleErrors.join('; ')}`,
    ).toBe(true);

    // Whatever happened to the redelivered message, the chat must remain
    // usable - a mid-conversation redelivery race must not lock the user out
    // of sending further messages.
    const messageInput = page.locator('[data-testid="chat-message-input"]');
    await expect(messageInput).toBeVisible();
  });
});
