import { test, expect } from '@playwright/test';

test.describe('Chat & Video UI Stress Tests (Adversarial)', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to a test chat room. Adjust the URL to match your routing structure.
    await page.goto('/chat/room_stress_test_123');
    
    // Wait for the chat interface to be ready
    await page.waitForSelector('[data-testid="chat-input-area"]', { state: 'visible' });
  });

  test('should handle rapid message spamming without crashing', async ({ page }) => {
    const messageInput = page.getByRole('textbox', { name: /message/i });
    const sendButton = page.getByRole('button', { name: /send/i });

    // Rapidly send 50 messages
    for (let i = 0; i < 50; i++) {
      await messageInput.fill(`Stress test message ${i}`);
      await sendButton.click();
    }

    // Verify the UI hasn't crashed and the last message is visible
    const lastMessage = page.getByText('Stress test message 49');
    await expect(lastMessage).toBeVisible({ timeout: 10000 });
    
    // Ensure the page is still responsive
    const isResponsive = await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => resolve(true))));
    expect(isResponsive).toBe(true);
  });

  test('should handle extremely large text payloads gracefully', async ({ page }) => {
    const messageInput = page.getByRole('textbox', { name: /message/i });
    const sendButton = page.getByRole('button', { name: /send/i });

    // Generate a 100,000 character string
    const massiveString = 'A'.repeat(100000);

    await messageInput.fill(massiveString);
    await sendButton.click();

    // The app should either truncate, reject gracefully, or render it without crashing the browser
    // We check that the input area is still functional afterwards
    await expect(messageInput).toBeVisible();
    await expect(messageInput).toBeEmpty();
    
    // Verify no critical error modals are blocking the screen
    const errorModal = page.getByTestId('critical-error-modal');
    await expect(errorModal).not.toBeVisible();
  });

  test('should handle rapid toggling of video and audio controls', async ({ page }) => {
    // Assuming there's a button to join a call or toggle media
    const joinCallButton = page.getByRole('button', { name: /join call/i });
    if (await joinCallButton.isVisible()) {
      await joinCallButton.click();
    }

    const toggleVideoButton = page.getByRole('button', { name: /toggle video/i });
    const toggleAudioButton = page.getByRole('button', { name: /toggle audio/i });

    // Wait for controls to be active
    await expect(toggleVideoButton).toBeVisible();

    // Rapidly click the toggles 20 times
    for (let i = 0; i < 20; i++) {
      await toggleVideoButton.click();
      await toggleAudioButton.click();
    }

    // Verify the UI is still stable and controls are still present
    await expect(toggleVideoButton).toBeVisible();
    await expect(toggleAudioButton).toBeVisible();
  });

  test('should handle malformed or unexpected paste events', async ({ page }) => {
    const messageInput = page.getByRole('textbox', { name: /message/i });

    // Simulate pasting a massive JSON object instead of plain text
    const malformedData = JSON.stringify({ nested: { deep: 'A'.repeat(50000) } });
    
    await messageInput.focus();
    await page.evaluate((data) => {
      const pasteEvent = new ClipboardEvent('paste', {
        clipboardData: new DataTransfer()
      });
      pasteEvent.clipboardData?.setData('text/plain', data);
      document.activeElement?.dispatchEvent(pasteEvent);
    }, malformedData);

    // Ensure the app didn't crash from the paste event
    await expect(messageInput).toBeVisible();
  });
});
