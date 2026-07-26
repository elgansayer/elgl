import { test, expect } from '@playwright/test';

test.describe('Adversarial Network & Concurrency Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock the initial chat room load
    await page.route('**/chat/rooms/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'room_network_test',
          title: 'Network Stress Test Room',
          is_online: true,
          messages: []
        })
      });
    });

    // Mock Centrifugo token endpoint
    await page.route('**/chat/token', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ token: 'fake-jwt-token' })
      });
    });

    // Mock message sending endpoint
    await page.route('**/chat/messages', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: `msg_${Date.now()}` })
      });
    });

    await page.goto('/chat/room_network_test');
  });

  test('should not crash when network drops while sending a message', async ({ page, context }) => {
    const inputField = page.locator('textarea[name="chat-input"], input[name="chat-input"], [data-testid="chat-input"]');
    const sendButton = page.locator('button[type="submit"], [data-testid="send-button"]');

    await expect(inputField.first()).toBeVisible({ timeout: 10000 });

    // Type a message
    await inputField.first().fill('Message before offline');
    
    // Simulate sudden network drop
    await context.setOffline(true);

    // Attempt to send while offline
    // The UI should either queue the message, show an error toast, or disable the button, but MUST NOT crash.
    await sendButton.first().click();

    // Verify the page hasn't crashed (e.g., an error boundary didn't trigger)
    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    await expect(errorBoundary).toHaveCount(0);

    // Restore network
    await context.setOffline(false);

    // Send another message to ensure the UI recovered and is still interactive
    await inputField.first().fill('Message after recovery');
    await sendButton.first().click();
    
    await expect(errorBoundary).toHaveCount(0);
  });

  test('should handle delayed API responses without duplicating messages on rapid clicks', async ({ page }) => {
    const inputField = page.locator('textarea[name="chat-input"], input[name="chat-input"], [data-testid="chat-input"]');
    const sendButton = page.locator('button[type="submit"], [data-testid="send-button"]');

    await expect(inputField.first()).toBeVisible({ timeout: 10000 });

    // Override the message route to have a massive artificial delay
    await page.route('**/chat/messages', async (route) => {
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3 second delay
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, id: `msg_${Date.now()}` })
      });
    });

    await inputField.first().fill('Delayed message test');
    
    // Rapidly click send 10 times while the first request is still pending
    for (let i = 0; i < 10; i++) {
      await sendButton.first().click();
    }

    // Verify the page hasn't crashed
    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    await expect(errorBoundary).toHaveCount(0);
  });
});
