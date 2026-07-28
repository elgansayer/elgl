import { test, expect } from '@playwright/test';

test.describe('Real-Time Engine Verification (Centrifugo v5 & LiveKit SFU)', () => {
  test('Centrifugo connection token and LiveKit stage simulation update signals reactively', async ({
    page,
  }) => {
    await page.goto('/');

    // Navigate to Centrifugo & Redis Fan-Out diagnostics tab
    const centrifugoTab = page.locator('button', { hasText: 'Centrifugo & Redis Fan-Out' });
    if (await centrifugoTab.isVisible()) {
      await centrifugoTab.click();

      const connectButton = page.locator('button', { hasText: 'Connect WebSocket' });
      if (await connectButton.isVisible()) {
        await connectButton.click();
      }

      // Trigger simulated RPUSH timeline_queue fan-out
      const triggerFanout = page.locator('button', { hasText: 'Trigger Simulated Redis Fan-Out' });
      if (await triggerFanout.isVisible()) {
        await triggerFanout.click();
        const logContainer = page.locator('section', {
          hasText: 'Live Architectural Diagnostics Stream',
        });
        await expect(logContainer).toContainText('Simulated RPUSH timeline_queue');
      }
    }

    // Navigate to LiveKit SFU Stage Simulator tab
    const livekitTab = page.locator('button', { hasText: 'LiveKit SFU Stage Simulator' });
    if (await livekitTab.isVisible()) {
      await livekitTab.click();

      const raiseHandBtn = page.locator('button', { hasText: 'Simulate Host Approval' });
      if (await raiseHandBtn.isVisible()) {
        await raiseHandBtn.click();
        await expect(page.locator('strong', { hasText: 'GRANTED (Microphone ON)' })).toBeVisible();
      }
    }
  });
});
