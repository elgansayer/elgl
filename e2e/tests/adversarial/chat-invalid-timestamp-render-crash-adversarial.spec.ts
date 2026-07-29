import { test, expect, Page } from '@playwright/test';

/**
 * Targets chat-room.component.html line ~140:
 *   {{ msg.created_at | date: 'shortTime' }}
 *
 * This runs inside the `@for (msg of filteredMessages(); ...)` loop that
 * renders every message bubble. Angular's built-in DatePipe throws a hard
 * `InvalidPipeArgument` error if `created_at` is not a valid Date/ISO
 * string/timestamp - and nothing in chat-room.component.ts validates or
 * sanitises `created_at` before it reaches the template, whether the
 * message comes from the initial REST history fetch (ChatService.getMessages)
 * or a live Centrifugo push on the `chat:${roomId}` channel
 * (chat-room.component.ts's setupRealTime()).
 *
 * A single malformed timestamp - which could come from a buggy backend
 * migration, a malicious/compromised peer in a group chat, or a race with
 * partially-written data - is therefore able to take down rendering for
 * the *entire* message list, not just the one bad message, because the
 * throw happens mid-iteration of the `@for` loop during a single
 * synchronous change-detection pass.
 */

const API = 'http://localhost:3000/api';
const MOCK_USER_ID = 'mock-user-123'; // AuthService falls back to MOCK_CURRENT_USER when unauthenticated
const ROOM_ID = 'invalid-timestamp-adversarial-room';

function makeRoom() {
  return {
    id: ROOM_ID,
    title: 'Timestamp Adversarial Room',
    subtitle: 'en -> fr',
    avatar: 'T',
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
        ws.send(JSON.stringify({ id: data.id, connect: { client: 'timestamp-adversarial-client' } }));
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

test.describe('Adversarial: malformed message timestamp breaks chat rendering', () => {
  test('a message with an invalid created_at in chat history takes the whole message list down', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    const consoleErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const goodMessageBefore = {
      id: 'good-msg-before',
      room_id: ROOM_ID,
      sender_id: 'other-user',
      message_type: 'text',
      text_content: 'This message has a valid timestamp',
      created_at: new Date(Date.now() - 120000).toISOString(),
    };
    const poisonedMessage = {
      id: 'poisoned-msg',
      room_id: ROOM_ID,
      sender_id: 'other-user',
      message_type: 'text',
      text_content: 'This message has a garbage timestamp',
      created_at: 'not-a-real-date',
    };
    const goodMessageAfter = {
      id: 'good-msg-after',
      room_id: ROOM_ID,
      sender_id: 'other-user',
      message_type: 'text',
      text_content: 'This message comes after the bad one',
      created_at: new Date().toISOString(),
    };

    await mockChatApi(page, [goodMessageBefore, poisonedMessage, goodMessageAfter]);
    await mockCentrifugoConnection(page);

    await page.goto(`/chat/${ROOM_ID}`);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // The app shell must survive regardless of what happens to the message list.
    await expect(page.locator('app-root')).toBeVisible();

    const visibleBefore = await page.getByText('This message has a valid timestamp').count();
    const visibleAfter = await page.getByText('This message comes after the bad one').count();

    // BUG: DatePipe throws InvalidPipeArgument on `not-a-real-date` while
    // iterating the @for loop, which aborts that change-detection pass
    // before it can render the sibling messages either side of the
    // poisoned one. Two valid, well-formed messages become invisible
    // because of one malformed record - collateral damage well beyond the
    // single bad message.
    expect(
      visibleBefore === 0 || visibleAfter === 0,
      'Expected the malformed created_at on one message to also blank out ' +
        'neighbouring valid messages in the same render pass (collateral ' +
        'damage from an uncaught DatePipe error), proving chat-room.component.html ' +
        "does not guard `msg.created_at | date: 'shortTime'` against malformed input.",
    ).toBe(true);

    // Whether or not Angular's default ErrorHandler swallows the throw into
    // console.error rather than an uncaught pageerror, *some* error signal
    // must exist - a silently blanked chat with zero diagnostics anywhere
    // would be even worse.
    const sawSomeError =
      pageErrors.some((e) => /date|invalid|NaN/i.test(e.message)) ||
      consoleErrors.some((e) => /date|invalid|NaN|ERROR/i.test(e));
    expect(
      sawSomeError,
      `Expected an InvalidPipeArgument-style error to surface somewhere. Page errors: ${pageErrors.map((e) => e.message).join('; ')} | Console errors: ${consoleErrors.join('; ')}`,
    ).toBe(true);
  });

  test('a live-pushed message with an invalid created_at breaks rendering for a call-in-progress room', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const seedMessage = {
      id: 'seed-msg',
      room_id: ROOM_ID,
      sender_id: 'other-user',
      message_type: 'text',
      text_content: 'Seed message before the call starts',
      created_at: new Date(Date.now() - 60000).toISOString(),
    };

    await mockChatApi(page, [seedMessage]);
    const centrifugo = await mockCentrifugoConnection(page);

    await page.goto(`/chat/${ROOM_ID}`);
    await page.waitForLoadState('networkidle');
    await expect(page.getByText('Seed message before the call starts')).toBeVisible({
      timeout: 5000,
    });

    // Simulate a video-call-notification-style text message (e.g. "Call
    // accepted"/"Call rejected", as sent by VoipCallComponent.acceptCall/
    // rejectCall) arriving live over Centrifugo with a corrupted timestamp -
    // exactly the kind of payload a flaky signalling backend could produce
    // mid-call.
    centrifugo.push(`chat:${ROOM_ID}`, {
      message: {
        id: 'live-poisoned-msg',
        room_id: ROOM_ID,
        sender_id: 'other-user',
        message_type: 'text',
        text_content: 'Call accepted',
        created_at: 'NaN',
      },
    });

    await page.waitForTimeout(1000);

    // The room must still be alive and usable after the bad push - not a
    // frozen or blanked chat mid-call.
    await expect(page.locator('app-root')).toBeVisible();

    const messageInput = page.getByPlaceholder(/type a message|message/i).first();
    const inputIsUsable = await messageInput.isVisible().catch(() => false);

    expect(
      inputIsUsable,
      'After a live push with a malformed created_at, the chat input should ' +
        'still be usable - if the whole surrounding view crashed/blanked, ' +
        'a mid-call user loses the ability to send or read anything.',
    ).toBe(true);
  });
});
