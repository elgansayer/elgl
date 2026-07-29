import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api';

/**
 * Adversarial test targeting VideoCallComponent
 * (frontend/src/app/components/video-call/video-call.component.ts).
 *
 * This test hits two distinct project mandates from AGENTS.md at once:
 *
 * 1. "Globalisation, RTL & Zero Hard-Coded Strings: 0 hard-coded UI strings.
 *    Never write raw hard-coded text inside Angular templates or component
 *    code. Always pipe UI text through TranslatePipe / I18nService."
 *    VideoCallComponent's inline template writes `Waiting for
 *    {{ otherUserName() }}...` as a raw string literal (video-call.component.ts,
 *    the "Waiting for" text node), and `otherUserName`/`otherUserInitials`
 *    default to the raw English literals 'User' and '?' (input<string>('User'),
 *    input<string>('?')). None of this goes through `| t` or I18nService, so it
 *    stays in English no matter what language the rest of the app has switched
 *    to.
 *
 * 2. "Accessibility Requirements: MUST pass all AXE checks. MUST follow all
 *    WCAG AA minimums, including focus management, colour contrast, and ARIA
 *    attributes." The mute-audio, mute-video and end-call controls are
 *    `<app-button-secondary>` / `<app-gradient-button>` wrapping bare `<svg>`
 *    icons via `<ng-content />` (see
 *    frontend/src/app/components/primitives/button-secondary/button-secondary.component.ts
 *    and .../gradient-button/gradient-button.component.ts). Neither primitive
 *    accepts or renders an aria-label, and the call site in
 *    video-call.component.ts never sets `[attr.aria-label]` on any of the
 *    three controls either. The rendered `<button>` elements therefore have
 *    no accessible name at all (icon-only, no text content, no aria-label,
 *    no aria-labelledby) - a WCAG 4.1.2 (Name, Role, Value) failure that AXE's
 *    "button-name" rule flags, and a screen-reader user on an active video
 *    call cannot tell which button mutes audio, mutes video, or hangs up.
 */

test.describe('Adversarial: video call overlay ignores locale and strips accessible names', () => {
  test('the waiting-for-partner text stays hardcoded English under Arabic, and the call controls have no accessible name', async ({
    page,
  }) => {
    // Fail the LiveKit token exchange so the call sits in the deterministic
    // "Waiting for ..." / not-yet-connected state instead of needing a real
    // camera, mic or SFU - same trick as video-call-route-dead-end-adversarial.
    await page.route(`${API}/livekit/token`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );

    const AR_TRANSLATIONS: Record<string, string> = {
      'videoCall.waitingFor': '...في انتظار',
    };
    let translateUiRequested = false;
    await page.route('**/api/nlp/translate-ui', async (route) => {
      translateUiRequested = true;
      await route.fulfill({ json: { translations: AR_TRANSLATIONS } });
    });

    // Force Arabic before the app boots, exactly like a returning user whose
    // I18nService.initLanguageFromStorage() reads this same localStorage key.
    await page.addInitScript(() => {
      window.localStorage.setItem('hellotalk_locale', 'ar');
    });

    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto(
      '/video-call?roomName=room-i18n-a11y&otherUserId=other-user-77&otherUserName=Farida&otherUserInitials=F',
    );

    // Confirm the language switch genuinely took effect app-wide before
    // asserting the video call screen ignored it.
    await expect.poll(() => translateUiRequested, { timeout: 10000 }).toBe(true);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dir), { timeout: 5000 })
      .toBe('rtl');

    const overlay = page.locator('div.fixed.inset-0.z-50.bg-black');
    await expect(overlay).toBeVisible({ timeout: 10000 });

    // BUG 1: the waiting-for-partner copy is a raw English string literal
    // that never goes through the translation pipeline, even though the
    // rest of the document has flipped to Arabic/RTL.
    await expect(page.getByText('Waiting for Farida...', { exact: true })).toBeVisible();
    await expect(page.getByText(AR_TRANSLATIONS['videoCall.waitingFor'])).toHaveCount(0);

    // BUG 2: the three call control buttons (mute audio, mute video, end
    // call) are icon-only with no accessible name whatsoever. Playwright's
    // accessibility tree computation follows the same accessible-name
    // algorithm AXE uses, so an empty/whitespace name here means AXE's
    // "button-name" rule would fail.
    const controlButtons = overlay.locator('.bg-gray-900\\/95 button');
    await expect(controlButtons).toHaveCount(3);

    const accessibleNames = await controlButtons.evaluateAll((buttons) =>
      buttons.map((b) => (b.getAttribute('aria-label') ?? b.textContent ?? '').trim()),
    );
    for (const [i, name] of accessibleNames.entries()) {
      expect(
        name,
        `BUG: call control button #${i} has no accessible name (aria-label or text content) - a screen-reader user cannot identify it`,
      ).not.toBe('');
    }

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
