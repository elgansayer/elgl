import { test, expect, type Page } from '@playwright/test';

const roomId = 'room_test_001';
const createdAt = '2026-08-25T12:00:00.000Z';

async function installChatApi(page: Page): Promise<void> {
  await page.route('**/api/safety/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route('**/api/chat/token', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ token: 'e2e-centrifugo-token' }),
    });
  });

  await page.route('**/api/chat/rooms', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: roomId,
          title: 'Japanese practice',
          subtitle: 'こんにちは',
          avatar: '',
          is_online: true,
          is_pinned: false,
          is_locked: false,
          created_at: createdAt,
        },
      ]),
    });
  });

  await page.route(`**/api/chat/rooms/${roomId}/members`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route(`**/api/chat/groups/${roomId}/members`, async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
  });

  await page.route(`**/api/chat/messages/${roomId}**`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'message_existing',
          room_id: roomId,
          sender_id: 'partner-2',
          message_type: 'text',
          text_content: 'こんにちは！',
          is_read: true,
          delivery_status: 'read',
          created_at: createdAt,
        },
      ]),
    });
  });

  await page.route('**/api/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'mock-user-123',
        display_name: 'E2E Learner',
        native_languages: ['en'],
        target_languages: ['ja'],
        is_vip: false,
        vip_tier: 'free',
        coins_balance: 0,
        study_streak_days: 0,
        correction_ratio: 0,
        is_serious_learner: false,
        privacy_hide_age: false,
        privacy_hide_location: false,
        privacy_hide_from_search: false,
        privacy_hide_gender: false,
        created_at: createdAt,
      }),
    });
  });

  await page.route('**/api/nlp/grammar-check', async (route) => {
    const requestBody = route.request().postDataJSON() as { text?: string };
    const text = requestBody.text ?? '';
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        original: text,
        corrected: text,
        explanation: 'No corrections needed.',
        errors_found: 0,
      }),
    });
  });
}

test.describe('HelloTalk Chat Messaging E2E', () => {
  test.beforeEach(async ({ page }) => {
    await installChatApi(page);
  });

  test('loads persisted chat history for the selected room', async ({ page }) => {
    await page.goto(`/chat/${roomId}`);

    await expect(page.locator('[data-testid="chat-message-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-message"]').filter({ hasText: 'こんにちは！' })).toBeVisible();
  });

  test('sends the composer text through POST /api/chat/messages and renders the result', async ({
    page,
  }) => {
    let messagePayload: unknown;

    await page.route('**/api/chat/messages', async (route) => {
      messagePayload = route.request().postDataJSON();
      const requestBody = messagePayload as { text_content?: string };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'message_sent',
          room_id: roomId,
          sender_id: 'mock-user-123',
          message_type: 'text',
          text_content: requestBody.text_content,
          is_read: false,
          delivery_status: 'sent',
          created_at: '2026-08-25T12:01:00.000Z',
        }),
      });
    });

    await page.goto(`/chat/${roomId}`);

    const messageInput = page.locator('[data-testid="chat-message-input"]');
    const text = '日本語を毎日れんしゅうしています。';
    await expect(messageInput).toBeVisible();
    await messageInput.fill(text);

    const sendRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/chat/messages'),
    );
    await messageInput.press('Enter');
    await sendRequest;

    expect(messagePayload).toMatchObject({
      room_id: roomId,
      message_type: 'text',
      text_content: text,
    });
    await expect(page.locator('[data-testid="chat-message"]').filter({ hasText: text })).toBeVisible();
    await expect(messageInput).toHaveValue('');
  });
});
