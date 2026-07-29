import { test, expect } from '@playwright/test';

const API = 'http://localhost:3000/api';

/**
 * Adversarial test targeting the standalone `/video-call` route
 * (frontend/src/app/app.routes.ts:100-104 and
 * frontend/src/app/components/video-call/video-call.component.ts).
 *
 * VideoCallComponent declares `roomName` and `otherUserId` as
 * `input.required<string>()`. The route has no path/query params of its own
 * and no guard, relying entirely on the app-wide `withComponentInputBinding()`
 * router feature (frontend/src/app/app.config.ts) to satisfy those inputs
 * from query params. Nothing else in the app ever links here (no "start
 * video call" button exists anywhere in chat-room.component.html), so this
 * route is only ever reached via a raw URL - exactly what a stale push
 * notification, shared link, or bookmark would hand a real user.
 *
 * The component's root element is `fixed inset-0 z-50 bg-black`
 * (video-call.component.ts line 33), intended to be a full-screen call
 * overlay. But the app shell's persistent bottom tab bar
 * (frontend/src/app/app.component.html line 46) is *also* `fixed ... z-50`,
 * and it is rendered after `<router-outlet>` in the DOM (line 42 vs 46).
 * Equal z-index ties resolve by DOM order, so the nav bar paints on top of
 * the "full-screen" call UI and physically intercepts pointer events over
 * the bottom ~60px of the screen - exactly where the mute / camera / end
 * call controls live. The end call button becomes unclickable: a real user
 * on an active video call has no way to hang up from the call UI itself.
 */

test.describe('Adversarial: /video-call full-screen overlay vs persistent bottom nav', () => {
  test('the bottom nav bar intercepts clicks meant for the End Call button, making it impossible to hang up', async ({
    page,
  }) => {
    // Backend LiveKit failure isn't the point here - it just gets us to a
    // stable rendered state quickly without needing real camera/mic/SFU access.
    await page.route(`${API}/livekit/token`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: '{}' }),
    );

    await page.goto('/video-call?roomName=room-adversarial&otherUserId=other-user-99');

    const overlay = page.locator('div.fixed.inset-0.z-50.bg-black');
    await expect(overlay).toBeVisible({ timeout: 10000 });

    const nav = page.locator('nav');
    await expect(nav).toBeVisible();

    // The nav bar and the call overlay both claim z-50 and both claim the
    // bottom of the viewport - confirm they actually overlap on screen.
    const navBox = await nav.boundingBox();
    const endCallButton = page.locator('button').last();
    const endCallBox = await endCallButton.boundingBox();
    expect(navBox, 'bottom nav bar did not render').not.toBeNull();
    expect(endCallBox, 'end call button did not render').not.toBeNull();
    expect(
      endCallBox!.y + endCallBox!.height,
      'end call button does not actually overlap the bottom nav bar - premise of this test no longer holds',
    ).toBeGreaterThan(navBox!.y);

    // The element that would actually receive a real click at the end call
    // button's centre point must be the nav bar's link, not the button.
    const center = {
      x: endCallBox!.x + endCallBox!.width / 2,
      y: endCallBox!.y + endCallBox!.height / 2,
    };
    const topmostTag = await page.evaluate(
      ({ x, y }) => {
        const el = document.elementFromPoint(x, y);
        return el?.closest('nav') ? 'nav' : el?.closest('button') ? 'button' : el?.tagName ?? null;
      },
      center,
    );
    expect(
      topmostTag,
      'BUG: the End Call button should receive the click, but the bottom nav is stacked on top of it',
    ).toBe('nav');

    // A real Playwright click (not a forced one) reproduces exactly what a
    // user's tap would do: it must time out because the nav intercepts it,
    // and the user must therefore remain stuck on the call screen.
    await expect(async () => {
      await endCallButton.click({ timeout: 1000 });
    }).rejects.toThrow(/intercepts pointer events/);

    await expect(page).toHaveURL(/\/video-call/);
    await expect(overlay).toBeVisible();
  });
});
