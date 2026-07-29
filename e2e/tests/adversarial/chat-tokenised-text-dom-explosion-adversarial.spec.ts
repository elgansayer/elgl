import { test, expect } from '@playwright/test';

// app-tokenised-text (used to render every text chat message) wraps EVERY
// Intl.Segmenter token - words *and* whitespace/punctuation - in its own
// <span>, and gives every word-like span tabindex="0" plus click/keydown
// handlers. There is no message length cap, no virtualisation, and no cap
// on token count. A single very long message therefore forces the browser
// to create tens of thousands of live, individually-focusable DOM nodes.
//
// This test sends one message built from thousands of space-separated
// words and checks two consequences of that:
//   1. The DOM actually balloons to one node per token (no de-duplication/
//      virtualisation kicks in), which is a real performance/DoS risk for
//      every participant who has to render the message, not just the sender.
//   2. A keyboard-only user tabbing from the top of the page can no longer
//      reach the message compose box in a reasonable number of tab presses,
//      because it must first tab through every token span in the flooded
//      message - a keyboard trap that violates the project's own WCAG AA /
//      focus-management mandate.

const ROOM_ID = 'dom-explosion-room';
const WORD_COUNT = 20000;

test.describe('Adversarial: chat message tokenisation DOM explosion', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/chat/rooms', (route) =>
      route.fulfill({
        status: 200,
        json: [
          {
            id: ROOM_ID,
            title: 'Explosion Room',
            subtitle: '',
            avatar: '',
            is_online: true,
            is_pinned: false,
            created_at: new Date().toISOString(),
            admin_id: null,
          },
        ],
      }),
    );
    await page.route('**/api/chat/messages/*', (route) => route.fulfill({ status: 200, json: [] }));
    await page.route('**/api/safety/blocked-ids', (route) =>
      route.fulfill({ status: 200, json: [] }),
    );
    await page.route('**/api/safety/blocked-and-blocker-ids/*', (route) =>
      route.fulfill({ status: 200, json: [] }),
    );
    await page.route('**/api/chat/token', (route) =>
      route.fulfill({ status: 200, json: { token: 'fake-token' } }),
    );
    // Prevent a real Centrifugo connection attempt from ever resolving/erroring loudly.
    await page.routeWebSocket(/connection\/websocket/, (ws) => {
      ws.onMessage(() => undefined);
    });

    // Echo the huge message straight back so it renders through the same
    // app-tokenised-text path a real incoming message would take.
    await page.route('**/api/chat/messages', (route) => {
      if (route.request().method() !== 'POST') return route.fallback();
      const body = route.request().postDataJSON() as { text_content?: string; room_id?: string };
      return route.fulfill({
        status: 200,
        json: {
          id: 'msg-flood-1',
          room_id: body.room_id ?? ROOM_ID,
          sender_id: 'attacker-1',
          message_type: 'text',
          text_content: body.text_content,
          is_read: false,
          created_at: new Date().toISOString(),
        },
      });
    });
  });

  test('a single flooded message balloons the DOM by one span per token', async ({ page }) => {
    await page.goto(`/chat/${ROOM_ID}`);

    const messageInput = page.getByRole('textbox').last();
    await expect(messageInput).toBeVisible();

    const floodMessage = Array.from({ length: WORD_COUNT }, (_, i) => `word${i}`).join(' ');
    await messageInput.fill(floodMessage);

    const before = Date.now();
    await messageInput.press('Enter');

    // Every word + every whitespace run becomes its own <span>, so a
    // WORD_COUNT-word message should produce roughly 2 * WORD_COUNT spans.
    const expectedMinimumSpans = WORD_COUNT;
    await page.waitForFunction(
      (min) => document.querySelectorAll('span[role="button"]').length >= min,
      expectedMinimumSpans,
      { timeout: 20000 },
    );
    const renderMs = Date.now() - before;

    const spanCount = await page.locator('span[role="button"]').count();
    console.log(`Rendered ${spanCount} focusable token spans in ${renderMs}ms`);

    // A single chat message should never be allowed to place tens of
    // thousands of live, individually-interactive nodes in the DOM. If this
    // fails, there is no client-side cap on tokenised message size.
    expect(spanCount).toBeLessThan(2000);
  });

  test('keyboard-only user cannot tab past a flooded message to reach the compose box', async ({
    page,
  }) => {
    await page.goto(`/chat/${ROOM_ID}`);

    const messageInput = page.getByRole('textbox').last();
    await expect(messageInput).toBeVisible();

    const floodMessage = Array.from({ length: WORD_COUNT }, (_, i) => `w${i}`).join(' ');
    await messageInput.fill(floodMessage);
    await messageInput.press('Enter');

    await page.waitForFunction(
      () => document.querySelectorAll('span[role="button"]').length > 0,
      undefined,
      { timeout: 20000 },
    );

    // Start keyboard navigation from the very top of the page, as a
    // screen-reader/keyboard-only user would, and try to tab down to the
    // message compose input.
    await page.locator('body').click();
    await page.keyboard.press('Tab');

    const REASONABLE_TAB_BUDGET = 40;
    let reachedComposeBox = false;
    for (let i = 0; i < REASONABLE_TAB_BUDGET; i++) {
      const isComposeBox = await messageInput.evaluate((el) => el === document.activeElement);
      if (isComposeBox) {
        reachedComposeBox = true;
        break;
      }
      await page.keyboard.press('Tab');
    }

    // A keyboard user must be able to reach the message compose box in a
    // small, bounded number of tab presses regardless of how many messages
    // (or how long a single message) are in the room. If this fails, the
    // flooded message has created a keyboard trap.
    expect(reachedComposeBox).toBe(true);
  });
});
