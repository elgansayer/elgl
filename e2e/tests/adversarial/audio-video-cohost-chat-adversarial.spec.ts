import { test, expect, type Page, type WebSocketRoute } from '@playwright/test';

/**
 * Targets the newly-added split-screen co-host video feature
 * (audio-rooms.store.ts / video-room.component.ts / supabase/migrations/016_video_room_co_host.sql)
 * and the room chat pipeline (room-chat.component.ts), which have no server backing
 * mocks so this suite drives the real Centrifugo JSON wire protocol directly.
 */

const API = 'http://localhost:3000/api';
const HOST_ID = 'mock-user-123'; // matches MOCK_CURRENT_USER in services/mock-data.ts
const ROOM_ID = 'chaos-video-room-1';
const ROOM_NAME = 'chaos-video-room-1-name';
const CHANNEL = `room_${ROOM_ID}`;

function makeRoom(overrides: Record<string, unknown> = {}) {
  return {
    id: ROOM_ID,
    room_name: ROOM_NAME,
    title: 'Adversarial Video Exchange',
    target_language: 'es',
    language_pair: 'en-es',
    topic_tag: 'chaos',
    host_id: HOST_ID,
    co_host_id: null,
    is_video_stream: true,
    is_active: true,
    speakers: [HOST_ID, 'partner-1'],
    raised_hands: [],
    listeners_count: 4,
    recording_url: null,
    created_at: new Date().toISOString(),
    host: { id: HOST_ID, display_name: 'Chaos Host' },
    ...overrides,
  };
}

interface FakeCentrifugo {
  wsRoute: WebSocketRoute | null;
  receivedPublishes: { channel: string; data: unknown }[];
  relayPublish: boolean;
  pushToChannel: (channel: string, data: unknown) => void;
}

// Minimal server-side implementation of the Centrifuge JSON wire protocol
// (newline-delimited JSON commands/replies, see node_modules/centrifuge/build/index.mjs)
// good enough to satisfy connect + subscribe handshakes and to inject arbitrary
// realtime events, without needing a real Centrifugo server.
async function setupFakeCentrifugo(page: Page): Promise<FakeCentrifugo> {
  const fake: FakeCentrifugo = {
    wsRoute: null,
    receivedPublishes: [],
    relayPublish: true,
    pushToChannel: () => {
      throw new Error('pushToChannel called before websocket connected');
    },
  };

  await page.routeWebSocket(/connection\/websocket/, (ws) => {
    fake.wsRoute = ws;
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
          const publish = cmd.publish as { channel: string; data: unknown };
          fake.receivedPublishes.push(publish);
          ws.send(JSON.stringify({ id, publish: {} }));
          if (fake.relayPublish) {
            fake.pushToChannel(publish.channel, publish.data);
          }
        }
      }
    });
  });

  return fake;
}

async function mockAudioRoomApi(page: Page, room: ReturnType<typeof makeRoom>) {
  let currentRoom = room;

  await page.route(`${API}/audio-rooms/list`, (route) => route.fulfill({ json: [currentRoom] }));

  await page.route(`${API}/audio-rooms/token`, (route) =>
    route.fulfill({
      json: {
        token: 'fake-livekit-token',
        room_id: currentRoom.id,
        room_name: currentRoom.room_name,
        // Contains "mock" so the store deliberately skips the real LiveKit/WebRTC
        // connection path (audio-rooms.store.ts joinRoom) and takes the safe fallback.
        livekit_url: 'wss://mock-livekit.local/rtc',
        is_speaker: true,
      },
    }),
  );

  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'fake-centrifugo-token' } }),
  );

  await page.route(`${API}/audio-rooms/invite-co-host`, async (route) => {
    const body = route.request().postDataJSON() as { target_user_id: string };
    currentRoom = { ...currentRoom, co_host_id: body.target_user_id };
    await route.fulfill({ json: currentRoom });
  });

  await page.route(`${API}/audio-rooms/remove-co-host`, async (route) => {
    currentRoom = { ...currentRoom, co_host_id: null };
    await route.fulfill({ json: currentRoom });
  });
}

test.describe('Adversarial: audio/video room co-host and chat', () => {
  const pageErrors: Error[] = [];

  test.beforeEach(async ({ page }) => {
    pageErrors.length = 0;
    page.on('pageerror', (err) => pageErrors.push(err));
  });

  test('a spoofed self co-host realtime event duplicates the host into a fake split-screen participant', async ({
    page,
  }) => {
    const fake = await setupFakeCentrifugo(page);
    await mockAudioRoomApi(page, makeRoom());

    await page.goto('/audio-rooms');
    await page.getByRole('button', { name: 'Join room' }).click();

    // Wait until the room is fully joined and subscribed (speaker stage renders once currentRoom is set).
    await expect(page.getByText('Speaker stage', { exact: false })).toBeVisible({ timeout: 15000 });
    await expect(page.locator('video')).toHaveCount(1);

    // Nothing in audio-rooms.store.ts validates that target_user_id from a
    // 'co_host_invited' realtime payload differs from the room's own host_id.
    // A malformed/replayed/malicious broadcast naming the host as their own
    // co-host should be rejected, not rendered.
    fake.pushToChannel(CHANNEL, { type: 'co_host_invited', target_user_id: HOST_ID });

    // If the app is defenceless against this, the video grid now renders the
    // exact same person twice: once as "Host" and once as "Co-Host".
    await expect(page.locator('video')).toHaveCount(2, { timeout: 5000 });
    await expect(page.getByText('Host', { exact: true })).toBeVisible();
    await expect(page.getByText('Co-Host', { exact: true })).toBeVisible();

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });

  test('a sent room chat message vanishes forever when its own realtime echo never arrives', async ({
    page,
  }) => {
    const fake = await setupFakeCentrifugo(page);
    // audio-rooms.store.ts sendRoomChatMessage() never appends to roomMessages()
    // locally - it relies entirely on Centrifugo echoing the publish back to the
    // sender's own subscription. Drop that echo (as a lagging/reconnecting
    // subscriber legitimately could) and see if the message is gone for good.
    fake.relayPublish = false;
    await mockAudioRoomApi(page, makeRoom());

    await page.goto('/audio-rooms');
    await page.getByRole('button', { name: 'Join room' }).click();
    await expect(page.getByText('Speaker stage', { exact: false })).toBeVisible({ timeout: 15000 });

    const distinctiveMessage = `adversarial-probe-${Date.now()}`;
    const chatInput = page.getByPlaceholder('Send a chat message to the room...');
    await chatInput.fill(distinctiveMessage);
    await chatInput.press('Enter');

    // Confirm the app really did attempt to publish (proves this isn't just a
    // "nothing was sent" false positive).
    await expect.poll(() => fake.receivedPublishes.length, { timeout: 5000 }).toBeGreaterThan(0);

    // Give a generous grace period far beyond any reasonable network round trip.
    await page.waitForTimeout(2000);

    await expect(page.getByText(distinctiveMessage)).toHaveCount(0);
    await expect(
      page.getByText('No messages in this live room yet', { exact: false }),
    ).toBeVisible();

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });

  test('rapid chat spam and co-host invite-picker toggling do not crash the room or leak raw markup', async ({
    page,
  }) => {
    const fake = await setupFakeCentrifugo(page);
    await mockAudioRoomApi(page, makeRoom());

    await page.goto('/audio-rooms');
    await page.getByRole('button', { name: 'Join room' }).click();
    await expect(page.getByText('Speaker stage', { exact: false })).toBeVisible({ timeout: 15000 });

    const chatInput = page.getByPlaceholder('Send a chat message to the room...');
    const payloads = [
      'A'.repeat(20000),
      '<img src=x onerror="window.__pwned = true">',
      '<script>window.__pwned = true;</script>',
      '   ',
      'Z͑ͫ̓ͪ̂ͫ̽͏̴̙̤̞͉͚̯̞̠͍A̴̵̜̰͔ͫ͗͢Lͨͧͽ̵̟̜͍͔̯ͯ̃ͯͪ͊ͧ͟͞G̦̝̑ͨ͊̋ͯͦ͂͆̀͢Ǫ̵̹̻̝̳͂̌̌͘!̵̡̠̰͕̿̋ͥͥ̂ͣ̐́́͞',
      '‮right-to-left-override',
      '{"type":"room_ended"}',
      '{"type":"co_host_invited","target_user_id":"attacker-id"}',
    ];

    for (const payload of payloads) {
      await chatInput.fill(payload);
      await chatInput.press('Enter');
    }

    // Rapidly toggle the co-host invite picker while messages are still landing.
    const inviteButton = page.getByRole('button', { name: '🎥 Invite co-host' });
    for (let i = 0; i < 15; i++) {
      if (await inviteButton.isVisible().catch(() => false)) {
        await inviteButton.click({ force: true });
      }
      await page.waitForTimeout(20);
    }

    await expect
      .poll(() => fake.receivedPublishes.length, { timeout: 5000 })
      .toBeGreaterThanOrEqual(payloads.length);

    // Angular interpolation must have kept the script/img payloads as inert text,
    // never executed or inserted as live markup.
    const pwned = await page.evaluate(() => (window as unknown as { __pwned?: boolean }).__pwned);
    expect(pwned).toBeUndefined();
    await expect(page.locator('script:has-text("__pwned")')).toHaveCount(0);

    // The app must still be alive and rendering, not a white screen.
    await expect(page.locator('app-root')).toBeVisible();

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
