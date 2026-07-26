import { test, expect } from '@playwright/test';

test.describe('Adversarial Network Drop Chaos', () => {
  test.beforeEach(async ({ page }) => {
    // Mock authentication
    await page.route('**/auth/session', (route) => 
      route.fulfill({ status: 200, json: { user: { id: 'network-chaos-tester', is_vip: true } } })
    );
    await page.route('**/chat/token', (route) => 
      route.fulfill({ status: 200, json: { token: 'fake-chaos-token' } })
    );
  });

  test('should handle rapid offline/online toggling during chat and video interactions', async ({ page, context }) => {
    await page.goto('/chat/chaos-room-999');

    // Wait for initial load
    await page.waitForTimeout(1000);

    const chatInput = page.locator('textarea, input[type="text"]').first();
    const callButton = page.locator('button[aria-label*="call" i], button[aria-label*="video" i], button:has-text("Call")').first();

    // 1. Rapidly toggle network state while trying to send messages
    if (await chatInput.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await context.setOffline(true);
        await chatInput.fill(`Message sent while offline ${i}`);
        await page.keyboard.press('Enter');
        
        await page.waitForTimeout(100); // Brief offline period
        
        await context.setOffline(false);
        await chatInput.fill(`Message sent while online ${i}`);
        await page.keyboard.press('Enter');
        
        await page.waitForTimeout(100); // Brief online period
      }
    }

    // 2. Toggle network state while attempting to initiate/drop a call
    if (await callButton.isVisible()) {
      for (let i = 0; i < 3; i++) {
        await context.setOffline(true);
        await callButton.click({ force: true });
        
        await page.waitForTimeout(200);
        
        await context.setOffline(false);
        await callButton.click({ force: true });
        
        await page.waitForTimeout(200);
      }
    }

    // Ensure we end up online
    await context.setOffline(false);
    await page.waitForTimeout(1000);

    // 3. Verify the application hasn't crashed
    const rootElement = page.locator('app-root');
    await expect(rootElement).toBeVisible();

    // Ensure no generic Angular/JS error boundary text is displayed
    const errorBoundary = page.locator('text="An unexpected error occurred"');
    await expect(errorBoundary).not.toBeVisible();
  });
});
