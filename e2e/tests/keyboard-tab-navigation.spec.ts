import { test, expect } from '@playwright/test';

const MAX_TAB_STOPS = 40;

test.describe('Desktop keyboard tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < 1024,
      'Desktop keyboard tab navigation requires a desktop viewport.',
    );
    await page.goto('/forgot-password');
    await expect(page.locator('#main-content')).toBeAttached();
  });

  test('offers the skip link as the first tab stop and moves focus to main content', async ({
    page,
  }) => {
    const skipLink = page.locator('a[href="#main-content"]');

    await page.keyboard.press('Tab');
    await expect(skipLink).toBeFocused();
    await expect(skipLink).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page.locator('#main-content')).toBeFocused();
    await expect(page).toHaveURL(/#main-content$/);
  });

  test('reaches desktop sidebar links without entering the hidden mobile tab bar', async ({
    page,
  }) => {
    await expect(page.locator('app-desktop-sidebar nav')).toBeVisible();
    await expect(page.locator('app-mobile-navigation nav')).toBeHidden();

    const visitedRegions = new Set<string>();

    for (let stop = 0; stop < MAX_TAB_STOPS; stop += 1) {
      await page.keyboard.press('Tab');
      const region = await page.evaluate(() => {
        const active = document.activeElement;
        if (!(active instanceof HTMLElement)) return 'none';
        if (active.closest('app-mobile-navigation')) return 'mobile';
        if (active.closest('app-desktop-sidebar')) return 'desktop';
        if (active.closest('#main-content')) return 'main';
        return 'other';
      });

      visitedRegions.add(region);
      if (visitedRegions.has('desktop')) break;
    }

    expect(visitedRegions.has('desktop')).toBe(true);
    expect(visitedRegions.has('mobile')).toBe(false);
  });
});
