import { test, expect } from '@playwright/test';

const API = '/api';

async function mockServices(page: any) {
  // Mock auth token endpoint
  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({
      json: { token: 'aggressive-test-token' },
    }),
  );
  // Mock safety blocked list
  await page.route(`${API}/safety/blocked-ids`, (route) =>
    route.fulfill({ json: [] }),
  );
  // Mock chat rooms list
  await page.route(`${API}/chat/rooms`, (route) =>
    route.fulfill({
      json: [
        {
          id: 'room_aggressive_1',
          title: 'Aggressive Test Chat',
          subtitle: 'some partner',
          avatar: '',
          is_online: true,
          is_pinned: false,
          created_at: new Date().toISOString(),
        },
      ],
    }),
  );
  // Catch any unhandled API calls and return empty
  await page.route(`${API}/**`, (route) => {
    if (!route.isHandled) {
      route.fulfill({ json: {} });
    }
  });
}

test.describe('Aggressive Chat & Video UI Attacks', () => {
  test.beforeEach(async ({ page }) => {
    await mockServices(page);
    // Suppress browser dialogs that may be triggered by XSS
    page.on('dialog', (dialog) => dialog.dismiss());
    // Navigate to base chat page and wait for it to load
    await page.goto('http://localhost:4200/chat');
    await page.waitForLoadState('networkidle');
  });

  test('should handle empty message submission without crashing', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.waitFor({ state: 'visible' });
    await input.fill('');
    await page.keyboard.press('Enter');
    // No error UI
    const errorToast = page.locator('[data-testid="error-toast"]');
    await expect(errorToast).toHaveCount(0);
    // No 500 network errors
    page.on('response', (response) => {
      expect(response.status()).not.toBe(500);
    });
  });

  test('should reject giant payload and not crash', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.waitFor({ state: 'visible' });
    const giantText = 'a'.repeat(1_000_000);
    await input.fill(giantText);
    await page.keyboard.press('Enter');
    // Expect validation feedback
    const validationMsg = page.locator('[data-testid="validation-message"]');
    await expect(validationMsg).toBeVisible({ timeout: 5000 });
    await expect(input).toBeEnabled();
  });

  test('should prevent XSS in chat messages', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.waitFor({ state: 'visible' });
    const xssPayload = '<img src=x onerror=alert(1)>';
    await input.fill(xssPayload);
    await page.keyboard.press('Enter');
    // If an alert fires the dialog handler will dismiss it,
    // but we confirm no such dialog path was taken by checking the message text is plain text.
    await page.waitForTimeout(1500);
    const lastMessage = page.locator('[data-testid="chat-message"]').last();
    await expect(lastMessage).toContainText(xssPayload);
  });

  test('should not crash on rapid message sending', async ({ page }) => {
    const input = page.locator('[data-testid="chat-input"]');
    await input.waitFor({ state: 'visible' });
    for (let i = 0; i < 20; i++) {
      await input.fill(`burst-${i}`);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(50);
    }
    const errorToast = page.locator('[data-testid="error-toast"]');
    await expect(errorToast).toHaveCount(0);
  });

  test('should connect to video room and handle lifecycle gracefully', async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await mockServices(page);
    // Mock audio rooms list
    await page.route(`${API}/audio-rooms`, (route) =>
      route.fulfill({
        json: [
          {
            id: 'room_video_1',
            room_name: 'Test Video Room',
            host_id: 'host123',
            language_pair: 'en-es',
            topic_tag: 'Pronunciation',
            is_video_stream: true,
            is_active: true,
            participants_count: 2,
          },
        ],
      }),
    );
    await page.goto('http://localhost:4200/audio-rooms');
    await page.waitForLoadState('networkidle');

    const joinButton = page.locator('button:has-text("Join Room")').first();
    if (await joinButton.isVisible()) {
      await joinButton.click();
      // Give time for device permissions and connection
      await page.waitForTimeout(3000);
      // Expect at least a video container to be present if the room is video-stream enabled
      const video = page.locator('video').first();
      if (await video.count() > 0) {
        await expect(video).toBeVisible();
      }
      const leaveButton = page.locator('button:has-text("Leave")');
      if (await leaveButton.isVisible()) {
        await leaveButton.click();
        await page.waitForTimeout(1000);
      }
    } else {
      console.log('No video rooms available for testing');
    }
    await context.close();
  });
});
