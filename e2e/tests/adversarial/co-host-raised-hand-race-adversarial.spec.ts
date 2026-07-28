import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';

/**
 * Targets a lost-update race between two independent write paths that both
 * mutate the same `currentRoom` signal in audio-rooms.store.ts:
 *   1. Realtime Centrifugo events (raise_hand, speaker_approved, ...), which
 *      are merged in with `currentRoom.update(r => ({ ...r, ... }))`.
 *   2. REST responses (inviteCoHost, removeCoHost, raiseHand, ...), which
 *      overwrite the whole room with `currentRoom.set(updated)`.
 *
 * If a REST call is in flight while a realtime event lands, the REST
 * response's snapshot of the room (captured server-side *before* the
 * realtime-visible change) can win the race and stomp the merged state,
 * silently discarding it on the host's screen even though it is still
 * correct in the backend. This suite reproduces that with a host inviting a
 * co-host while another user's raised hand arrives mid-flight.
 */

const API = 'http://localhost:3000/api';
const HOST_ID = 'mock-user-123'; // matches MOCK_CURRENT_USER in services/mock-data.ts
const ROOM_ID = 'chaos-race-room-1';
const ROOM_NAME = 'chaos-race-room-1-name';
const CHANNEL = `room_${ROOM_ID}`;
const RAISED_HAND_USER = 'late-raiser-99';
const CO_HOST_TARGET = 'partner-1';

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOM_ID,
    room_name: ROOM_NAME,
    title: 'Adversarial Race Exchange',
    target_language: 'es',
    language_pair: 'en-es',
    topic_tag: 'chaos',
    host_id: HOST_ID,
    co_host_id: null,
    is_video_stream: true,
    is_active: true,
    speakers: [HOST_ID, CO_HOST_TARGET],
    raised_hands: [],
    listeners_count: 4,
    recording_url: null,
    created_at: new Date().toISOString(),
    host: { id: HOST_ID, display_name: 'Chaos Host' },
    ...overrides,
  };
}

interface FakeCentrifugo {
  pushToChannel: (channel: string, data: unknown) => void;
}

// Minimal server-side implementation of the Centrifuge JSON wire protocol
// (newline-delimited JSON commands/replies) good enough to satisfy the
// connect + subscribe handshake and to inject arbitrary realtime events.
async function setupFakeCentrifugo(page: Page): Promise<FakeCentrifugo> {
  const fake: FakeCentrifugo = {
    pushToChannel: () => {
      throw new Error('pushToChannel called before websocket connected');
    },
  };

  await page.routeWebSocket(/connection\/websocket/, (ws: WebSocketRoute) => {
    fake.pushToChannel = (channel: string, data: unknown) => {
      ws.send(JSON.stringify({ push: { channel, pub: { data } } }));
    };

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
          ws.send(JSON.stringify({ id, publish: {} }));
        }
      }
    });
  });

  return fake;
}

async function mockAudioRoomApi(
  page: Page,
  room: ReturnType<typeof makeRoom>,
  onInviteCoHost: () => Promise<void> | void,
) {
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

  // Simulate the real backend: this REST response is computed from the room
  // snapshot as it stood the instant the request was received, with no
  // knowledge of the raise-hand that a *different* request lands in the
  // meantime. It deliberately does NOT echo back raised_hands, matching what
  // audio-rooms.service.ts's inviteCoHost() actually returns.
  await page.route(`${API}/audio-rooms/invite-co-host`, async (route) => {
    await onInviteCoHost();
    const body = route.request().postDataJSON() as { target_user_id: string };
    await route.fulfill({
      json: {
        ...room,
        co_host_id: body.target_user_id,
        speakers: room.speakers.includes(body.target_user_id)
          ? room.speakers
          : [...room.speakers, body.target_user_id],
      },
    });
  });
}

test.describe('Adversarial: co-host invite vs raised-hand realtime race', () => {
  const pageErrors: Error[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on('pageerror', (err) => pageErrors.push(err));
  });

  test('a raised hand that arrives while inviting a co-host is silently erased once the invite response lands', async ({
    page,
  }) => {
    const fake = await setupFakeCentrifugo(page);

    // Hold the invite-co-host REST response open until the test explicitly
    // releases it, so a realtime event can be injected mid-flight.
    let releaseInviteResponse!: () => void;
    const inviteInFlight = new Promise<void>((resolve) => {
      releaseInviteResponse = resolve;
    });
    let inviteRequestReceived = false;
    await mockAudioRoomApi(page, makeRoom(), async () => {
      inviteRequestReceived = true;
      await inviteInFlight;
    });

    await page.goto('/audio-rooms');
    await page.getByRole('button', { name: 'Join room' }).click();
    await expect(page.getByText('Speaker stage', { exact: false })).toBeVisible({ timeout: 15000 });

    // Kick off the co-host invite; the mocked backend will hold the response
    // open until we release it below.
    const inviteButton = page.getByRole('button', { name: '🎥 Invite co-host' });
    await inviteButton.click();
    await page
      .getByRole('button', { name: /Speaker.*[a-f0-9]{6}/i })
      .first()
      .click();

    await expect.poll(() => inviteRequestReceived, { timeout: 5000 }).toBe(true);

    // While the invite is still pending server-side, a totally unrelated
    // user raises their hand. This is merged into the room signal
    // immediately via the realtime handler (currentRoom.update(...)).
    fake.pushToChannel(CHANNEL, { type: 'raise_hand', user_id: RAISED_HAND_USER });

    await expect(page.getByText('✋ Raised hands', { exact: false })).toBeVisible({
      timeout: 5000,
    });
    await expect(
      page.getByText(`Learner ${RAISED_HAND_USER.slice(0, 8)}`, { exact: false }),
    ).toBeVisible();

    // Now let the stale invite-co-host response land. It carries a room
    // snapshot from before the raised hand existed and is applied with a
    // raw currentRoom.set(...), which has no way to distinguish "authoritative
    // update" from "stale echo of an older state".
    releaseInviteResponse();

    await expect(page.getByText('🎥 Invite co-host')).toHaveCount(0);
    await expect(page.locator('video')).toHaveCount(2, { timeout: 5000 });

    // The raised hand that the host was just shown a moment ago must not
    // silently vanish: the learner is still waiting server-side for
    // approval, and the host now has no way to grant it because the UI
    // element to do so has disappeared.
    await expect(
      page.getByText(`Learner ${RAISED_HAND_USER.slice(0, 8)}`, { exact: false }),
    ).toBeVisible({ timeout: 3000 });

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
