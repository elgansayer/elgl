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

test.describe('Adversarial Chat Security System', () => {
  test.beforeEach(async ({ page }) => {
    await installChatApi(page);
  });

  test('XSS injection in chat message is properly escaped', async ({ page }) => {
    // Echo the submitted text through the API boundary so the rendering path
    // receives the same response shape as the production endpoint.
    await page.route('**/api/chat/messages', async (route) => {
      const requestBody = route.request().postDataJSON() as { text_content?: string };
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
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`/chat/${roomId}`);
    const input = page.locator('[data-testid="chat-message-input"]');
    await input.waitFor({ state: 'visible', timeout: 10000 });

    // Inject a naïve XSS payload
    const payload = `<img src=x onerror=alert(1)>`;
    await input.fill(payload);

    // Listen for any dialog that might indicate the XSS fired
    let dialogSeen = false;
    page.on('dialog', async (dialog) => {
      dialogSeen = true;
      await dialog.dismiss();
    });

    const sendRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/chat/messages'),
    );
    await input.press('Enter');
    await sendRequest;

    // The payload should not appear as raw HTML untrusted content
    const lastMessage = page.locator('[data-testid="chat-message"]').last();
    await expect(lastMessage).toBeVisible({ timeout: 5000 });

    // Check it's rendered as text, not evaluated as HTML
    const text = await lastMessage.textContent();
    expect(text).toContain(payload);

    // Ensure no JavaScript executed (no dialog fired)
    expect(dialogSeen).toBe(false);
  });

  test('sending extremely long message does not crash the UI', async ({ page }) => {
    await page.route('**/api/chat/messages', async (route) => {
      const requestBody = route.request().postDataJSON() as { text_content?: string };
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'message_long',
          room_id: roomId,
          sender_id: 'mock-user-123',
          message_type: 'text',
          text_content: requestBody.text_content,
          is_read: false,
          delivery_status: 'sent',
          created_at: new Date().toISOString(),
        }),
      });
    });

    await page.goto(`/chat/${roomId}`);
    const input = page.locator('[data-testid="chat-message-input"]');
    await input.waitFor({ state: 'visible', timeout: 10000 });

    // Generate a long payload
    const payload = 'A'.repeat(5000);
    await input.fill(payload);

    const sendRequest = page.waitForRequest(
      (request) => request.method() === 'POST' && request.url().endsWith('/api/chat/messages'),
    );
    await input.press('Enter');
    await sendRequest;

    // Ensure message appears without crashing
    const lastMessage = page.locator('[data-testid="chat-message"]').last();
    await expect(lastMessage).toBeVisible({ timeout: 5000 });
    const text = await lastMessage.textContent();
    expect(text).toContain('A'.repeat(100)); // Just check part of it
  });
});
