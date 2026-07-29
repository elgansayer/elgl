import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:3000/api';
const CURRENT_USER_ID = 'mock-user-123'; // matches MOCK_CURRENT_USER in services/mock-data.ts
const ROOM_ID = 'room-ng-content-e2e';
const SEEDED_MESSAGE_TEXT = 'Seeded history message that must render on screen';

/**
 * Targets LongPressContextMenuComponent (frontend/src/app/components/long-press-context-menu/
 * long-press-context-menu.component.ts), which ChatRoomComponent wraps around every non-system
 * chat bubble:
 *
 *   <app-long-press-context-menu ...>
 *     <div> ... the actual message bubble markup ... </div>
 *   </app-long-press-context-menu>
 *
 * The component's own `template` only contains the `@if (showMenu())` popup markup - there is no
 * `<ng-content>` anywhere in the file. Angular does not render default-slot projected content
 * unless the host template contains an `<ng-content>` outlet, so everything ChatRoomComponent
 * places between the component's opening/closing tags (sender name, text, images, audio players,
 * translate/save/bookmark buttons - every message in the room) is silently dropped from the DOM.
 *
 * Separately, the component defines `onRightClick`, `onTouchStart`, `onTouchMove` and `onTouchEnd`
 * handlers for opening the menu, but never wires them up: the `host` object only binds
 * `document:click`, `document:keydown.escape`, `window:resize` and `window:scroll`, and the
 * template has no element with `(contextmenu)`/`(touchstart)` bindings either. So even if content
 * were projected, right-click / long-press could never open the menu.
 *
 * This test asserts both: chat history and newly sent messages must be visible in the transcript,
 * and right-clicking a message must open the context menu.
 */

async function mockChatBackend(page: Page): Promise<void> {
  await page.route(`${API}/chat/rooms`, (route) =>
    route.fulfill({
      json: [
        {
          id: ROOM_ID,
          title: 'Content Projection Room',
          subtitle: 'en -> ja',
          avatar: 'C',
          is_online: true,
          is_pinned: false,
          created_at: new Date().toISOString(),
          admin_id: CURRENT_USER_ID,
        },
      ],
    }),
  );

  await page.route(`${API}/chat/messages/${ROOM_ID}*`, (route) =>
    route.fulfill({
      json: [
        {
          id: 'seed-msg-1',
          room_id: ROOM_ID,
          sender_id: 'other-user-456',
          message_type: 'text',
          text_content: SEEDED_MESSAGE_TEXT,
          is_read: true,
          created_at: new Date().toISOString(),
          sender: { id: 'other-user-456', display_name: 'Partner Person' },
        },
      ],
    }),
  );

  await page.route(`${API}/safety/blocked-ids`, (route) => route.fulfill({ json: [] }));

  await page.route(`${API}/chat/rooms/${ROOM_ID}/members`, (route) =>
    route.fulfill({ status: 404, json: {} }),
  );

  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'fake-token' } }),
  );

  await page.route(`${API}/chat/messages`, (route) => {
    if (route.request().method() !== 'POST') return route.continue();

    const body = route.request().postDataJSON() as { room_id: string; text_content?: string };
    return route.fulfill({
      status: 201,
      json: {
        id: `msg-${Date.now()}`,
        room_id: body.room_id,
        sender_id: CURRENT_USER_ID,
        message_type: 'text',
        text_content: body.text_content,
        is_read: false,
        created_at: new Date().toISOString(),
      },
    });
  });

  await page.routeWebSocket(/connection\/websocket/, () => {});
}

test.describe('Adversarial: chat message bubbles must actually appear in the DOM', () => {
  test('seeded chat history and freshly sent messages are visible, and right-click opens the context menu', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await mockChatBackend(page);
    await page.goto(`/chat/${ROOM_ID}`);

    const input = page.getByPlaceholder('Type your message');
    await expect(input).toBeVisible({ timeout: 10000 });

    // 1. A message that was already in the room's history before we arrived must render.
    // If LongPressContextMenuComponent is swallowing its projected content, this bubble -
    // sender name, text, and its action buttons - never reaches the DOM at all.
    await expect(page.getByText(SEEDED_MESSAGE_TEXT)).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Partner Person')).toBeVisible();

    // 2. Sending a brand-new message must also make it appear in the transcript.
    const sentText = `Freshly sent message ${Date.now()}`;
    await input.fill(sentText);
    await page.getByRole('button', { name: 'Send', exact: true }).click();
    await expect(page.getByText(sentText)).toBeVisible({ timeout: 5000 });

    // 3. The per-message action buttons (rendered inside the same projected content) must be
    // reachable too - e.g. the bookmark/"Fav" button next to the seeded message.
    const favButtons = page.getByRole('button', { name: 'Fav', exact: true });
    await expect(favButtons.first()).toBeVisible({ timeout: 5000 });

    // 4. Right-clicking a message bubble should open its long-press context menu (copy/favourite/
    // report/block). Since the handler exists but is never bound to any event, this currently
    // never opens - proving the interaction is dead, not just visually subtle.
    const seededBubble = page.getByText(SEEDED_MESSAGE_TEXT);
    await seededBubble.click({ button: 'right' });
    await expect(page.locator('.context-menu-popup')).toBeVisible({ timeout: 2000 });

    // Sanity check the app didn't silently crash while we probed it.
    await expect(page.locator('app-root')).toBeVisible();
    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
