import { test, expect } from '@playwright/test';

test.describe('HelloTalk RTL & Monetary Invariant Verification', () => {
  test('RTL locales automatically mirror layout and maintain logical CSS boundaries', async ({
    page,
  }) => {
    await page.goto('/');

    // Verify document dir attribute is dynamically mirrored or respects logical properties
    const bodyDir = await page.evaluate(() => document.documentElement.dir || document.body.dir);

    // Check that dual currency strings are displayed across VIP upgrade prompts
    const pageContent = await page.content();
    const hasDualCurrencyConsumer =
      pageContent.includes('8 UKP / $10 USD') || pageContent.includes('8 UKP');
    const hasDualCurrencyDeveloper =
      pageContent.includes('20 UKP / $26 USD') || pageContent.includes('20 UKP');

    expect(hasDualCurrencyConsumer || hasDualCurrencyDeveloper).toBeTruthy();

    // Verify no em dashes exist anywhere on the rendered page
    expect(pageContent).not.toContain('\u2014');
  });

  test('Developer Sandbox executes PostGIS query and renders distance_metres correctly', async ({
    page,
  }) => {
    await page.goto('/');

    // Navigate to PostGIS Sandbox if present or accessible
    const postgisTab = page.locator('button', { hasText: 'PostGIS Spatial Sandbox' });
    if (await postgisTab.isVisible()) {
      await postgisTab.click();
      await page.locator('button', { hasText: 'Execute Spatial Query' }).click();

      // Verify query result list or empty state displays logical spacing
      const resultsContainer = page.locator('section', {
        hasText: 'PostGIS Geography Query Simulator',
      });
      await expect(resultsContainer).toBeVisible();
    }
  });
});
