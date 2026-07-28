import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:3000/api';
const CURRENT_USER_ID = 'mock-user-123'; // matches MOCK_CURRENT_USER in services/mock-data.ts
const BLOCKED_USER_ID = 'blocked-stalker-666';

const SAFE_ROOM_ID = 'room-safe-friend';
const BLOCKED_ROOM_ID = 'room-blocked-stalker';

const SAFE_ROOM_TITLE = 'Safe Language Partner';
const BLOCKED_ROOM_TITLE = 'Blocked Stalker Account';

/**
 * Targets ChatService (frontend/src/app/services/chat.service.ts).
 *
 * getMessages() correctly filters out messages from blocked users:
 *   const blockedIds = await this.safetyService.getBlockedAndBlockerIds(currentUser.id);
 *   if (blockedIds.length > 0) {
 *     return messages.filter(msg => !blockedIds.includes(msg.sender_id));
 *   }
 *
 * getRooms() fetches the exact same blockedIds list, and its comment claims
 * the same behaviour ("Filter out rooms where the other participant is
 * blocked"), but the implementation never actually filters anything - it
 * just returns the unfiltered `rooms` array in both branches:
 *   if (currentUser?.id) {
 *     const blockedIds = await this.safetyService.getBlockedAndBlockerIds(currentUser.id);
 *     if (blockedIds.length > 0) {
 *       return rooms;   // <-- BUG: should be rooms.filter(...), just returns everything
 *     }
 *   }
 *   return rooms;
 *
 * ChatListComponent (chat-list.component.ts) renders whatever getRooms()
 * returns directly into the chat list as a live `routerLink` to
 * `/chat/{roomId}`. So although getMessages() correctly empties out a
 * blocked room's message history (it falls back to the
 * "chatList.noMessagesYet" placeholder), the thread itself - title, avatar,
 * VIP badge and a working link straight back into the conversation - keeps
 * showing up on the main chat list every time a blocking user opens the app.
 * For a dating/language-exchange app that is a real safety leak: blocking
 * someone is supposed to make them disappear, not just silence their old
 * messages while leaving an inviting, clickable tile on the home screen.
 */

async function mockBlockedUserChatLeak(page: Page): Promise<void> {
  await page.route(`${API}/safety/blocked-and-blocker-ids/${CURRENT_USER_ID}`, (route) =>
    route.fulfill({ json: [BLOCKED_USER_ID] }),
  );

  // A couple of other safety endpoints the app may probe on init; keep them
  // harmless so this test stays focused on the getRooms() leak.
  await page.route(`${API}/safety/blocked-ids`, (route) =>
    route.fulfill({ json: [BLOCKED_USER_ID] }),
  );

  await page.route(`${API}/chat/rooms`, (route) =>
    route.fulfill({
      json: [
        {
          id: SAFE_ROOM_ID,
          title: SAFE_ROOM_TITLE,
          subtitle: 'en -> es',
          avatar: 'S',
          is_online: true,
          is_pinned: false,
          created_at: new Date().toISOString(),
        },
        {
          id: BLOCKED_ROOM_ID,
          title: BLOCKED_ROOM_TITLE,
          subtitle: 'en -> fr',
          avatar: 'B',
          is_online: false,
          is_pinned: false,
          created_at: new Date().toISOString(),
        },
      ],
    }),
  );

  await page.route(`${API}/chat/messages/${SAFE_ROOM_ID}*`, (route) =>
    route.fulfill({
      json: [
        {
          id: 'msg-safe-1',
          room_id: SAFE_ROOM_ID,
          sender_id: 'safe-friend-1',
          message_type: 'text',
          text_content: 'Hey, how was your day?',
          is_read: true,
          created_at: new Date().toISOString(),
        },
      ],
    }),
  );

  // This message's sender is the blocked user. getMessages() correctly
  // strips it out (proving the filtering logic itself works fine), which is
  // exactly what makes getRooms() forgetting to filter so glaring: the
  // thread's history is empty/safe, yet the thread tile is still there.
  await page.route(`${API}/chat/messages/${BLOCKED_ROOM_ID}*`, (route) =>
    route.fulfill({
      json: [
        {
          id: 'msg-blocked-1',
          room_id: BLOCKED_ROOM_ID,
          sender_id: BLOCKED_USER_ID,
          message_type: 'text',
          text_content: 'I found your home address, see you soon',
          is_read: false,
          created_at: new Date().toISOString(),
        },
      ],
    }),
  );
}

test.describe('Adversarial: blocked user chat room leaks onto the chat list', () => {
  test("a blocked user's chat thread and last-message preview keep showing on the main chat list", async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await mockBlockedUserChatLeak(page);

    await page.goto('/chat');

    // Wait for the loading state to clear.
    await expect(page.getByText('Loading', { exact: false })).toHaveCount(0, { timeout: 10000 });

    // Sanity check: the non-blocked room renders normally.
    await expect(page.getByText(SAFE_ROOM_TITLE, { exact: true })).toBeVisible();

    // BUG: despite the user having blocked this account (safety/blocked-and-blocker-ids
    // returns it), ChatService.getRooms() never filters the room list, so the
    // blocked user's thread - title, avatar and last-message preview - is still
    // rendered on the chat list a blocking user has to look at every time they
    // open the app.
    await expect(page.getByText(BLOCKED_ROOM_TITLE, { exact: true })).toBeVisible();
    await expect(page.getByText(LEAKED_LAST_MESSAGE, { exact: false })).toBeVisible();

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
