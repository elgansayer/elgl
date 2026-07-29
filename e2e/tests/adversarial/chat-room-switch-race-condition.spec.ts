import { test, expect } from '@playwright/test';

/**
 * Adversarial test: exploits the fact that ChatRoomComponent reads its room id
 * via `id = input.required<string>()` bound to the `chat/:id` route param, and
 * reacts to changes with an unguarded `effect()` that calls `initializeRoom()`.
 * Because Angular's default RouteReuseStrategy reuses the same component
 * instance across `chat/:id` navigations, and none of `loadRoomDetails()`,
 * `loadBlockedUsers()`, `loadMessages()` cancel or ignore stale in-flight
 * requests, a slow response for room A that resolves *after* the user has
 * already switched to room B will still land via `this.messages.set(data)`
 * and clobber room B's message list with room A's (potentially private)
 * content.
 *
 * This simulates a real user flow: open a chat, the network is slow, quickly
 * switch to a different conversation (e.g. by tapping a push notification or
 * double-tapping between chats) before the first request settles.
 */

test.describe('Adversarial: chat room switch race condition', () => {
  test('stale slow response from a previous room must not leak into the currently viewed room', async ({
    page,
  }) => {
    const SECRET_ALPHA_TEXT = 'TOP-SECRET-ALPHA-ONLY-MESSAGE-9182';
    const PUBLIC_BETA_TEXT = 'public-beta-room-message';

    const room = (id: string, title: string) => ({
      id,
      title,
      subtitle: '',
      avatar: '',
      is_online: true,
      is_pinned: false,
      created_at: new Date().toISOString(),
    });

    const message = (id: string, roomId: string, text: string) => ({
      id,
      room_id: roomId,
      sender_id: 'other-user',
      message_type: 'text',
      text_content: text,
      is_read: true,
      created_at: new Date().toISOString(),
      sender: { id: 'other-user', display_name: 'Other User' },
    });

    await page.route('**/api/chat/rooms', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([room('room-alpha', 'Alpha Room'), room('room-beta', 'Beta Room')]),
      });
    });

    // Room alpha's message fetch is deliberately slow (simulating a bad network
    // moment) and only resolves well after the user has navigated away.
    await page.route('**/api/chat/messages/room-alpha*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 4000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([message('msg-alpha-1', 'room-alpha', SECRET_ALPHA_TEXT)]),
      });
    });

    // Room beta responds immediately.
    await page.route('**/api/chat/messages/room-beta*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([message('msg-beta-1', 'room-beta', PUBLIC_BETA_TEXT)]),
      });
    });

    await page.route('**/api/safety/blocked-ids', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/safety/blocked-and-blocker-ids/*', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
    await page.route('**/api/chat/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'fake-jwt-token' }),
      });
    });

    // Enter room alpha directly. This fires off the 4s-delayed messages fetch.
    await page.goto('/chat/room-alpha');
    await expect(page.locator('[data-testid="chat-message-input"]')).toBeVisible({
      timeout: 10000,
    });

    // Immediately, before alpha's response has arrived, jump straight to room
    // beta the same way an in-app router navigation would: update the URL and
    // fire the popstate event Angular's Router listens for, without a full
    // page reload (which would otherwise abort the in-flight request and mask
    // the bug).
    await page.evaluate(() => {
      history.pushState({}, '', '/chat/room-beta');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });

    await expect(page).toHaveURL(/\/chat\/room-beta$/);
    await expect(page.locator('[data-testid="chat-message"]', { hasText: PUBLIC_BETA_TEXT })).toBeVisible({
      timeout: 10000,
    });

    // Wait long enough for alpha's stale, delayed response to resolve while
    // we're sitting in room beta.
    await page.waitForTimeout(4500);

    // We must still be looking at room beta, and it must never show alpha's
    // private content: a stale response overwriting the signal would leak
    // one conversation's messages into another.
    await expect(page).toHaveURL(/\/chat\/room-beta$/);
    await expect(
      page.locator('[data-testid="chat-message"]', { hasText: SECRET_ALPHA_TEXT }),
    ).toHaveCount(0);
    await expect(
      page.locator('[data-testid="chat-message"]', { hasText: PUBLIC_BETA_TEXT }),
    ).toBeVisible();
  });
});
