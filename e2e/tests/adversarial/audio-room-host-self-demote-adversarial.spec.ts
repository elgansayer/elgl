import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';

/**
 * Targets the `speaker_demoted` / `co_host_removed` realtime handlers in
 * audio-rooms.store.ts (setupRealTime's centrifugeService.subscribe callback,
 * around lines 247-301). Every branch that reacts to a `target_user_id`
 * blindly trusts whatever the wire says: there is no check anywhere that
 * `target_user_id !== room.host_id`. The room UI itself (audio-room.component.html)
 * never offers a "demote"/"mute" control targeting the host - those buttons are
 * only rendered `@if (... && speakerId !== room.host_id)` - so this can only ever
 * happen via a malformed/replayed/malicious realtime event, exactly the kind of
 * backend-trust attack surface the sibling "spoofed self co-host" adversarial
 * test already exercises for `co_host_invited`. This suite targets the mirror
 * case for `speaker_demoted`: a single spoofed event silently strips the HOST
 * of their own speaking rights, in their own room.
 */

const API = 'http://localhost:3000/api';
const HOST_ID = 'mock-user-123'; // matches MOCK_CURRENT_USER in services/mock-data.ts
const ROOM_ID = 'chaos-self-demote-room-1';
const ROOM_NAME = 'chaos-self-demote-room-1-name';
const CHANNEL = `room_${ROOM_ID}`;

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOM_ID,
    room_name: ROOM_NAME,
    title: 'Adversarial Self-Demote Exchange',
    target_language: 'es',
    language_pair: 'en-es',
    topic_tag: 'chaos',
    host_id: HOST_ID,
    co_host_id: null,
    is_video_stream: false,
    is_active: true,
    speakers: [HOST_ID],
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

test.describe('Adversarial: spoofed speaker_demoted event targets the room host', () => {
  const pageErrors: Error[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on('pageerror', (err) => pageErrors.push(err));
  });

  test('a speaker_demoted event naming the host silently locks the host out of their own room', async ({
    page,
  }) => {
    const fake = await setupFakeCentrifugo(page);
    await mockAudioRoomApi(page, makeRoom());

    await page.goto('/audio-rooms');
    await page.getByRole('button', { name: 'Join room' }).click();

    await expect(page.getByText('Speaker stage', { exact: false })).toBeVisible({
      timeout: 15000,
    });

    // Sanity check: the host starts out correctly as a speaker in their own
    // room, with no "raise hand" affordance (that's only shown to non-speakers)
    // and can end the room.
    await expect(page.getByText('Chaos Host (', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Raise hand', exact: false })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /end.*archive/i })).toBeVisible();

    // Nothing in audio-rooms.store.ts's speaker_demoted handler checks that
    // target_user_id differs from the room's own host_id before applying it.
    fake.pushToChannel(CHANNEL, { type: 'speaker_demoted', target_user_id: HOST_ID });

    await page.waitForTimeout(1000);

    // BUG: the host has been silently stripped from the speaker stage in their
    // own room and their microphone has been programmatically disabled...
    await expect(page.getByText('Chaos Host (', { exact: false })).toHaveCount(0);

    // ...and now sees a "Raise hand" button, exactly as a mere listener would,
    // in a room they are hosting.
    await expect(page.getByRole('button', { name: 'Raise hand', exact: false })).toBeVisible({
      timeout: 3000,
    });

    // Yet the "End & Archive" control (gated purely on host_id, not isSpeaker)
    // is still there: the host can still end their own room, but cannot speak
    // in it - a broken, inconsistent state reachable from a single spoofed event.
    await expect(page.getByRole('button', { name: /end.*archive/i })).toBeVisible();

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
