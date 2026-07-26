import { test, expect } from '@playwright/test';

test.describe('Adversarial Chat Payload & Injection Tests', () => {
  
  test.beforeEach(async ({ page }) => {
    // Mock the initial chat room load
    await page.route('**/chat/rooms/*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'room_payload_test',
          title: 'Payload Stress Test Room',
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

    // Mock message sending endpoint to echo the message back
    await page.route('**/chat/messages', async (route) => {
      const postData = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ 
          success: true, 
          id: `msg_${Date.now()}`,
          text_content: postData?.text_content || ''
        })
      });
    });

    await page.goto('/chat/room_payload_test');
  });

  test('should safely handle basic XSS injection attempts without executing scripts', async ({ page }) => {
    const inputField = page.locator('textarea[name="chat-input"], input[name="chat-input"], [data-testid="chat-input"]');
    const sendButton = page.locator('button[type="submit"], [data-testid="send-button"]');

    await expect(inputField.first()).toBeVisible({ timeout: 10000 });

    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src="x" onerror="alert(1)">',
      'javascript:alert(1)',
      '<iframe src="javascript:alert(1)"></iframe>'
    ];

    for (const payload of xssPayloads) {
      await inputField.first().fill(payload);
      await sendButton.first().click();
    }

    // Verify no alerts were triggered (Playwright auto-dismisses dialogs, but we can check if the text is rendered as plain text)
    // The UI should render the literal strings, not execute them.
    for (const payload of xssPayloads) {
      // Look for the exact text on the page, ensuring it was escaped
      await expect(page.locator(`text="${payload}"`).first()).toBeVisible();
    }
  });

  test('should not break layout with extremely long unbroken strings', async ({ page }) => {
    const inputField = page.locator('textarea[name="chat-input"], input[name="chat-input"], [data-testid="chat-input"]');
    const sendButton = page.locator('button[type="submit"], [data-testid="send-button"]');

    await expect(inputField.first()).toBeVisible({ timeout: 10000 });

    // Generate a 5000 character string with no spaces
    const longWord = 'W'.repeat(5000);
    
    await inputField.first().fill(longWord);
    await sendButton.first().click();

    // Check that the message container doesn't overflow the viewport width
    const messageContainer = page.locator(`text="${longWord}"`).first();
    await expect(messageContainer).toBeVisible();
    
    const box = await messageContainer.boundingBox();
    const viewport = page.viewportSize();
    
    if (box && viewport) {
      // The width of the message should not exceed the viewport width (CSS word-break/overflow-wrap should be working)
      expect(box.width).toBeLessThanOrEqual(viewport.width);
    }
  });

  test('should handle zero-width characters and RTL overrides gracefully', async ({ page }) => {
    const inputField = page.locator('textarea[name="chat-input"], input[name="chat-input"], [data-testid="chat-input"]');
    const sendButton = page.locator('button[type="submit"], [data-testid="send-button"]');

    await expect(inputField.first()).toBeVisible({ timeout: 10000 });

    // Payload with Zero-width joiners, non-joiners, and Right-to-Left Override (U+202E)
    const zalgoAndRtl = 'T\u200De\u200Cs\u202Et\u0336\u0347\u0359';
    
    await inputField.first().fill(zalgoAndRtl);
    await sendButton.first().click();

    // Verify the page hasn't crashed
    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    await expect(errorBoundary).toHaveCount(0);

    // Verify the text is in the DOM
    await expect(page.locator(`text="${zalgoAndRtl}"`).first()).toBeVisible();
  });
});
