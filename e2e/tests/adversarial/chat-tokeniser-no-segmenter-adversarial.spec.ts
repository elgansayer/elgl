import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:3000/api';
const USER_ID = 'adversarial-user-002';
const ROOM_ID = 'room_no_segmenter_001';

/**
 * TokenisedTextComponent (frontend/src/app/components/tokenised-text/tokenised-text.component.ts)
 * has a fallback code path used whenever `Intl.Segmenter` is unavailable in the runtime
 * (older Safari/WebView engines, embedded browsers, some locked-down environments).
 * That fallback calls `this.text.split(...)` where `this.text` is the Angular `input()`
 * accessor function, not the string value (`this.text()`), so it should throw
 * `this.text.split is not a function` the moment any text message tries to render.
 *
 * This suite forces that fallback path by deleting `Intl.Segmenter` before the app boots,
 * to see whether every text message in a chat room silently fails to render.
 */
async function mockBackend(page: Page) {
  await page.route(`${API}/chat/rooms`, (route) =>
    route.fulfill({
      json: [
        {
          id: ROOM_ID,
          title: 'No Segmenter Room',
          subtitle: 'en -> ja',
          avatar: 'N',
          is_online: true,
          is_pinned: false,
          created_at: new Date().toISOString(),
          admin_id: USER_ID,
        },
      ],
    }),
  );

  await page.route(`${API}/chat/rooms/${ROOM_ID}`, (route) =>
    route.fulfill({
      json: {
        id: ROOM_ID,
        title: 'No Segmenter Room',
        subtitle: 'en -> ja',
        avatar: 'N',
        is_online: true,
        is_pinned: false,
        created_at: new Date().toISOString(),
        admin_id: USER_ID,
      },
    }),
  );

  await page.route(`${API}/chat/rooms/${ROOM_ID}/members`, (route) => route.fulfill({ json: [] }));

  await page.route(`${API}/chat/messages/${ROOM_ID}*`, (route) =>
    route.fulfill({
      json: [
        {
          id: 'seed-msg-1',
          room_id: ROOM_ID,
          sender_id: 'other-user',
          message_type: 'text',
          text_content: 'Hello world, this should still be readable',
          created_at: new Date(Date.now() - 60000).toISOString(),
        },
      ],
    }),
  );

  await page.route(`${API}/chat/messages`, (route) => {
    const body = route.request().postDataJSON();
    route.fulfill({
      status: 201,
      json: {
        id: `sent-${Date.now()}`,
        room_id: ROOM_ID,
        sender_id: USER_ID,
        message_type: 'text',
        text_content: body?.text_content ?? '',
        created_at: new Date().toISOString(),
      },
    });
  });

  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'no-segmenter-test-token' } }),
  );

  await page.route(`${API}/safety/blocked-ids`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/safety/blocked-and-blocker-ids/${USER_ID}`, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route(`${API}/groups`, (route) => route.fulfill({ json: [] }));

  await page.route(`${API}/**`, (route) => route.fulfill({ status: 200, json: {} }));
}

test.describe('Adversarial - chat text rendering without Intl.Segmenter', () => {
  test.beforeEach(async ({ page }) => {
    // Strip Intl.Segmenter before any app code runs, simulating a runtime that
    // lacks it, which forces TokenisedTextComponent into its manual-split fallback.
    await page.addInitScript(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (Intl as any).Segmenter;
    });

    await page.routeWebSocket(/\/connection\/websocket/, (ws) => {
      ws.onMessage((raw) => {
        const data = JSON.parse(raw as string);
        if (data.connect) {
          ws.send(JSON.stringify({ id: data.id, connect: { client: 'no-segmenter-client' } }));
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
  });

  test('existing text messages still render when Intl.Segmenter is unavailable', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await expect(async () => {
      const hasSegmenter = await page.evaluate(
        () => typeof (Intl as unknown as { Segmenter?: unknown }).Segmenter,
      );
      expect(hasSegmenter).toBe('undefined');
    }).toPass({ timeout: 5000 });

    await page.goto(`/chat/${ROOM_ID}`);
    await page.waitForLoadState('networkidle');

    const splitCrash = pageErrors.find((e) => /\.split is not a function/.test(e.message));
    expect(
      splitCrash,
      `TokenisedTextComponent's no-Intl.Segmenter fallback crashed: ${splitCrash?.message}`,
    ).toBeUndefined();

    await expect(page.getByText('Hello world, this should still be readable')).toBeVisible();
  });

  test('newly sent text messages still render when Intl.Segmenter is unavailable', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(`/chat/${ROOM_ID}`);
    await page.waitForLoadState('networkidle');

    const input = page.locator('input[placeholder]').last();
    await input.fill('Testing the fallback tokeniser path');
    await input.press('Enter');

    await page.waitForTimeout(300);

    const splitCrash = pageErrors.find((e) => /\.split is not a function/.test(e.message));
    expect(
      splitCrash,
      `TokenisedTextComponent's no-Intl.Segmenter fallback crashed on send: ${splitCrash?.message}`,
    ).toBeUndefined();

    await expect(page.getByText('Testing the fallback tokeniser path')).toBeVisible();
  });
});
