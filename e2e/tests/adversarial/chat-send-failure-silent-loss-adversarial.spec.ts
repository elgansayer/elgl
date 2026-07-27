import { test, expect, Page } from '@playwright/test';

const API = 'http://localhost:3000/api';
const CURRENT_USER_ID = 'mock-user-123'; // matches MOCK_CURRENT_USER in services/mock-data.ts
const ROOM_ID = 'room-silent-loss-e2e';

/**
 * Targets ChatRoomComponent.sendTextMessage() (frontend/src/app/components/chat-room/chat-room.component.ts):
 *
 *   async sendTextMessage(): Promise<void> {
 *     if (!this.textInput.trim()) return;
 *     const text = this.textInput.trim();
 *     this.textInput = '';                       // <-- input cleared optimistically, BEFORE the request
 *     try {
 *       const sent = await this.chatService.sendMessage({ ... });
 *       this.messages.update(list => ...);        // only reaches the transcript on success
 *     } catch (e) {
 *       console.error('Failed to send text message:', e);   // <-- BUG: dead end, no showToast(), no restore
 *     }
 *   }
 *
 * Every other mutating action in this component (bookmark, report, block/unblock, save-to-vocab,
 * translate, rename group, add/remove member) calls showToast() on both success AND failure - see
 * the showToast(...AlertAlert) / showToast(...ErrorAlert) pairs throughout the file. Sending a plain
 * text message, the core feature of a chat app, is the one action whose failure path is completely
 * silent: the typed text disappears from the input, never reaches the transcript, and nothing on
 * screen - no toast, no inline error, no retry affordance - ever tells the user their message
 * did not send. This is a real, user-facing silent data-loss bug, not a crash/exception.
 */

async function mockChatBackend(page: Page, state: { sendShouldFail: boolean }): Promise<void> {
  await page.route(`${API}/chat/rooms`, (route) =>
    route.fulfill({
      json: [
        {
          id: ROOM_ID,
          title: 'Silent Loss Room',
          subtitle: 'en -> fr',
          avatar: 'S',
          is_online: true,
          is_pinned: false,
          created_at: new Date().toISOString(),
          admin_id: CURRENT_USER_ID,
        },
      ],
    }),
  );

  await page.route(`${API}/chat/messages/${ROOM_ID}*`, (route) => route.fulfill({ json: [] }));

  await page.route(`${API}/safety/blocked-ids`, (route) => route.fulfill({ json: [] }));

  // sendMessage() looks up room members to run its blocked-user check; let it fail
  // harmlessly (the real code already `.catch(() => [])`s this call).
  await page.route(`${API}/chat/rooms/${ROOM_ID}/members`, (route) =>
    route.fulfill({ status: 404, json: {} }),
  );

  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'fake-token' } }),
  );

  // Exact match only: this is the POST /chat/messages endpoint sendTextMessage() hits.
  await page.route(`${API}/chat/messages`, (route) => {
    if (route.request().method() !== 'POST') return route.continue();

    if (state.sendShouldFail) {
      return route.fulfill({ status: 500, json: { message: 'Internal Server Error' } });
    }

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

  // Prevent a real websocket handshake attempt from Centrifuge during the test.
  await page.routeWebSocket(/connection\/websocket/, () => {});
}

test.describe('Adversarial: chat message send failure is silently swallowed', () => {
  test('a failed text message send vanishes with zero user feedback, then recovers once the API is healthy', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    const backendState = { sendShouldFail: true };
    await mockChatBackend(page, backendState);

    await page.goto(`/chat/${ROOM_ID}`);

    const input = page.getByPlaceholder('Type your message');
    const sendButton = page.getByRole('button', { name: 'Send', exact: true });
    await expect(input).toBeVisible({ timeout: 10000 });

    // The chat input has no maxlength/client-side limit at all, so pair the failure case with
    // an aggressively oversized payload to make sure nothing about the length itself is what
    // masks the bug.
    const doomedMessage = `This message must not vanish silently ${Date.now()} ${'X'.repeat(5000)}`;

    await input.fill(doomedMessage);
    await sendButton.click();

    // Give the rejected request + catch block time to resolve.
    await page.waitForTimeout(1000);

    // 1. The input was already cleared optimistically before the request was even sent - the
    // user's typed text is gone from the box regardless of what the server said.
    await expect(input).toHaveValue('');

    // 2. BUG: the failed message never made it into the transcript (messages() is only ever
    // updated on the success path), so there is no trace of it anywhere in the UI...
    await expect(
      page.getByText('This message must not vanish silently', { exact: false }),
    ).toHaveCount(0);

    // 3. ...and no toast was ever raised for the failure, unlike every other mutating action in
    // this component. The user is given no indication whatsoever that sending failed.
    await expect(page.locator('app-toast div.rounded-full')).toHaveCount(0);

    // Sanity check the app is still alive, not just quietly broken.
    await expect(page.locator('app-root')).toBeVisible();

    // Recovery: once the backend starts accepting sends again, a fresh message should still
    // go through normally - proving this is a silent-failure bug, not a permanently broken input.
    backendState.sendShouldFail = false;
    const recoveredMessage = `Recovered message ${Date.now()}`;
    await input.fill(recoveredMessage);
    await sendButton.click();
    await expect(page.getByText(recoveredMessage)).toBeVisible({ timeout: 5000 });

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
