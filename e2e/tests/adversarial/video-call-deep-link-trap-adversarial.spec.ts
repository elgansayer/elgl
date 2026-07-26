import { test, expect } from '@playwright/test';

/**
 * Targets the standalone `/video-call` route (app.routes.ts) which lazy-loads
 * VideoCallComponent directly, and VideoCallComponent itself
 * (video-call.component.ts). This route is a plausible real-world entry point:
 * a push-notification deep link, a shared/bookmarked URL, or a stale link left
 * over from an in-progress "start video call" feature would all land a user
 * here with no application state carried along, exactly like a fresh
 * `page.goto('/video-call')`.
 *
 * VideoCallComponent declares `roomName` and `otherUserId` as `input.required<string>()`,
 * but `app.config.ts`'s `provideRouter(routes)` call never adds
 * `withComponentInputBinding()`, so routed navigation can never populate those
 * inputs from route/query params in the first place - there is no way to reach
 * this component correctly via the router at all.
 */

test.describe('Adversarial: direct navigation to the video-call route', () => {
  test('landing on /video-call with no bound inputs strands the user behind an unclosable full-screen call overlay', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/video-call');

    // The full-screen `fixed inset-0 z-50 bg-black` call UI renders immediately
    // and unconditionally, regardless of whether required inputs are present -
    // the template guards on local signals (remoteVideoTrack, localVideoTrack),
    // never on whether the component was set up correctly at all.
    const overlay = page.locator('.fixed.inset-0.z-50.bg-black');
    await expect(overlay).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('Waiting for', { exact: false })).toBeVisible();

    // Under the hood, ngOnInit's `this.roomName()` throws NG0950 ("Input is
    // required but no value is available yet") before a LiveKit token is ever
    // requested. That failure is swallowed by ngOnInit's try/catch, which only
    // console.errors it and emits `callEnded` - but nothing is listening to
    // `callEnded` for a routed (not embedded) component, so the emit is a
    // no-op. The user is left staring at a live-looking "Waiting for User..."
    // call screen that can never possibly connect, without so much as an error
    // toast telling them anything went wrong.
    await page.waitForTimeout(1500);
    await expect(overlay).toBeVisible();

    // This must not be a hard app crash (Angular's default ErrorHandler would
    // surface NG0950 as an uncaught pageerror if it weren't caught internally).
    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);

    // Try the obvious way out: the red "End call" button.
    const endCallButton = overlay.locator('button.bg-red-600');
    await expect(endCallButton).toBeVisible();

    // BUG (layered on top of the above): AppComponent's own persistent bottom
    // tab bar (`fixed bottom-0 inset-x-0 z-50`, app.component.html) is never
    // hidden behind "fullscreen" routed views like this one, and shares the
    // exact same z-50 stacking level as the call overlay's controls bar. Being
    // later in DOM order, the tab bar wins paint order and physically sits on
    // top of the call controls, so a real user's click on "End call" never
    // reaches the button at all - Playwright's actionability check confirms
    // this by refusing a plain (non-forced) click.
    const navBar = page.locator('nav.fixed.bottom-0');
    await expect(navBar).toBeVisible();
    const buttonBox = await endCallButton.boundingBox();
    const navBox = await navBar.boundingBox();
    expect(buttonBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(
      buttonBox!.y + buttonBox!.height > navBox!.y,
      `Expected the End call button (bottom=${buttonBox!.y + buttonBox!.height}) to be physically overlapped by the bottom nav bar (top=${navBox!.y}), confirming it is unclickable by a real user`,
    ).toBe(true);
    await expect(endCallButton.click({ timeout: 3000 })).rejects.toThrow();

    // Even bypassing the overlap with a forced click, the deeper bug remains:
    // endCall() only calls cleanup() (a no-op here, since a LiveKit room was
    // never created) and emits the unlistened `callEnded` output. There is no
    // router navigation anywhere in VideoCallComponent, so the full-screen
    // overlay is still covering the viewport and the URL never changes - the
    // user is completely stuck with no in-app way back to the rest of HelloTalk.
    await endCallButton.click({ force: true });
    await page.waitForTimeout(500);
    await expect(page).toHaveURL(/\/video-call/);
    await expect(overlay).toBeVisible();

    expect(
      pageErrors,
      `Unexpected uncaught page errors after clicking End call: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
