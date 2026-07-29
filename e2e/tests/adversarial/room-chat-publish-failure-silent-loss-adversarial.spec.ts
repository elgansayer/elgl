import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';

/**
 * Targets `AudioRoomsStore.sendRoomChatMessage()` (audio-rooms.store.ts), which
 * is architecturally different from the 1:1 chat send path
 * (`ChatService.sendMessage` / `ChatRoomComponent.sendTextMessage`):
 *
 *  - The 1:1 chat path POSTs to the REST API, gets back a persisted `sent`
 *    message, and explicitly appends it to `messages` locally
 *    (`this.messages.update(list => [...list, sent])`) - the sender's own
 *    bubble is guaranteed to render even if the realtime echo never arrives.
 *  - The room-chat path has no REST call and no local/optimistic append at
 *    all. It only calls `centrifugeService.publish(channel, {...})` and
 *    trusts that the message will reappear via its own subscription to that
 *    same channel once Centrifugo echoes the publish back. There is nothing
 *    in `AudioRoomsStore.roomMessages` that the sender's own composer can
 *    fall back on.
 *
 * `RoomChatComponent.send()` (room-chat.component.ts) makes this worse: it
 * clears `inputText` unconditionally as soon as the (fire-and-forget, awaited
 * but not checked) publish call returns, regardless of whether it succeeded.
 * `CentrifugeService.publish()` swallows a rejected publish with only a
 * `console.error`, so a real backend that rejects the publish (e.g. because
 * room-chat channels are publish-ACL'd server-side, which is the *correct*
 * thing for a server to do given a client should never be trusted to write
 * directly into a shared realtime channel) leaves the user's message
 * permanently gone: erased from the input, never rendered in the transcript,
 * with no error toast or any other feedback that anything went wrong.
 */

const API = 'http://localhost:3000/api';
const HOST_ID = 'mock-user-123'; // matches MOCK_CURRENT_USER in services/mock-data.ts
const ROOM_ID = 'silent-loss-room-1';
const ROOM_NAME = 'silent-loss-room-1-name';
const CHANNEL = `room_${ROOM_ID}`;

function makeRoom() {
  return {
    id: ROOM_ID,
    room_name: ROOM_NAME,
    title: 'Silent Loss Test Room',
    target_language: 'es',
    language_pair: 'en-es',
    topic_tag: 'chaos',
    host_id: HOST_ID,
    co_host_id: null,
    is_video_stream: false,
    is_active: true,
    speakers: [HOST_ID],
    raised_hands: [],
    listeners_count: 3,
    recording_url: null,
    created_at: new Date().toISOString(),
    host: { id: HOST_ID, display_name: 'Chaos Host' },
  };
}

// Minimal server-side implementation of the Centrifuge JSON wire protocol
// good enough to satisfy the connect/subscribe handshake, but which
// deliberately rejects every "publish" command with a permission-denied
// error - modelling a real Centrifugo deployment that enforces publish ACLs
// on room channels server-side instead of trusting the client.
async function setupFakeCentrifugoRejectingPublish(page: Page): Promise<void> {
  await page.routeWebSocket(/connection\/websocket/, (ws: WebSocketRoute) => {
    ws.onMessage((message) => {
      const text = message.toString();
      for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let cmd: Record<string, unknown>;
        try {
          cmd = JSON.parse(trimmed);
        } catch {
          continue;
        }
        const id = cmd.id;
        if (cmd.connect) {
          ws.send(JSON.stringify({ id, connect: { client: 'fake-client-1' } }));
        } else if (cmd.subscribe) {
          ws.send(JSON.stringify({ id, subscribe: {} }));
        } else if (cmd.publish) {
          // Real Centrifugo would reject this if publish is not allowed for
          // this client on this channel - exactly the ACL a sane backend
          // should apply to a room-chat channel.
          ws.send(JSON.stringify({ id, error: { code: 103, message: 'permission denied' } }));
        }
      }
    });
  });
}

async function mockAudioRoomApi(page: Page, room: ReturnType<typeof makeRoom>) {
  await page.route(`${API}/audio-rooms/list`, (route) => route.fulfill({ json: [room] }));

  await page.route(`${API}/audio-rooms/token`, (route) =>
    route.fulfill({
      json: {
        token: 'fake-livekit-token',
        room_id: room.id,
        room_name: room.room_name,
        // Contains "mock" so the store skips the real LiveKit/WebRTC path.
        livekit_url: 'wss://mock-livekit.local/rtc',
        is_speaker: true,
      },
    }),
  );

  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'fake-centrifugo-token' } }),
  );
}

test.describe('Adversarial: room-chat message vanishes when the realtime publish is rejected', () => {
  test('a rejected room-chat publish erases the composer and never shows the message, with no error feedback', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await setupFakeCentrifugoRejectingPublish(page);
    await mockAudioRoomApi(page, makeRoom());

    await page.goto('/audio-rooms');
    await page.getByRole('button', { name: 'Join room' }).click();
    await expect(page.getByText('Speaker stage', { exact: false })).toBeVisible({ timeout: 15000 });

    const messageText = 'This message should not vanish without a trace';
    const chatInput = page.getByPlaceholder('Send a chat message to the room...');
    await expect(chatInput).toBeVisible();
    await chatInput.fill(messageText);
    await page.getByRole('button', { name: 'Send', exact: true }).click();

    // BUG (part 1): the composer is cleared immediately, unconditionally -
    // there is no way to tell send() failed, and the user's typed text is
    // gone with no chance to retry.
    await expect(chatInput).toHaveValue('');

    // Give the rejected publish plenty of time to (not) resolve into any kind
    // of visible state.
    await page.waitForTimeout(1500);

    // BUG (part 2): the message the user just sent is nowhere in the DOM at
    // all - not even locally, since sendRoomChatMessage() has no optimistic
    // append and depended entirely on an echo that the server just refused.
    await expect(page.getByText(messageText)).toHaveCount(0);
    // The empty-state placeholder is still showing, proving nothing was ever
    // recorded in `roomMessages`, not even transiently.
    await expect(
      page.getByText('No messages in this live room yet', { exact: false }),
    ).toBeVisible();

    // BUG (part 3): no error toast (or any other feedback) ever appears to
    // tell the user their message failed to send - CentrifugeService.publish()
    // only console.error's the rejection.
    await expect(page.locator('app-toast').getByText(/fail|error|denied/i)).toHaveCount(0);

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
