import { test, expect, Page } from '@playwright/test';

test('debug3', async ({ page }) => {
  const start = Date.now();
  page.on('request', (req) => { if (req.url().includes('mock-data') || req.url().includes('chunk')) console.log(Date.now()-start, 'REQ:', req.url()); });
  page.on('console', (msg) => console.log(Date.now()-start, 'BROWSER:', msg.text()));

  await page.goto('/');
  await page.evaluate(() => new Promise(r => setTimeout(r, 3000)));
  const bodyText = await page.evaluate(() => document.body.innerText.slice(0, 2000));
  console.log('BODY:', bodyText);
});
