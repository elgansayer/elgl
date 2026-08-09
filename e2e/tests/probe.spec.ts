import { test, expect } from '@playwright/test';
import * as fs from 'fs';

test('probe duplicate input', async ({ page }) => {
  await page.goto('http://localhost:4200/chat/room_chaos_999');
  await page.waitForTimeout(2000);
  const count = await page.locator('[data-testid="chat-message-input"]').count();
  console.log('COUNT:', count);
  const html = await page.locator('body').innerHTML();
  fs.writeFileSync('/home/dev/hellotalk/e2e/body.html', html);
});
