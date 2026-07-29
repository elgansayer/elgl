import { test, expect, Page } from '@playwright/test';

/**
 * Targets the "Group Admin Settings" panel in chat-room.component.html
 * (behind the isAdmin-gated "Admin" toggle) and its handlers in
 * chat-room.component.ts (renameGroup / addMember / removeMember).
 *
 * Two independent, compounding bugs live in this one panel:
 *
 * 1. i18n: every string in the admin panel - "Admin", "Group Admin Settings",
 *    "Rename", "Add Member", "Remove Member", the three input placeholders,
 *    and the showToast() success/error strings in chat-room.component.ts
 *    (lines ~413, 425, 431, 440, 446) - is a raw template/string literal.
 *    None of it goes through TranslatePipe (`| t`) or I18nService.translate().
 *    Forcing the whole app to Arabic/RTL (the same mechanism the
 *    incoming-call-i18n-hardcoded-adversarial spec uses) proves the rest of
 *    the shell flips language and direction while this entire panel stays
 *    stuck in English, violating the "zero hard-coded strings" mandate.
 *
 * 2. No submit guard: renameGroup()/addMember()/removeMember() are plain
 *    async methods with no in-flight flag and the buttons are never
 *    disabled while a request is pending. Double-clicking (or a slow
 *    network + an impatient user) fires the underlying HTTP call twice
 *    with the same input, because the component field that gets cleared
 *    only clears *after* the await resolves - so the second click reads
 *    the same not-yet-cleared value. That is a duplicate side effect
 *    (e.g. two identical add-member calls) with duplicate visible toasts.
 */

const API = 'http://localhost:3000/api';
const MOCK_USER_ID = 'mock-user-123'; // AuthService falls back to MOCK_CURRENT_USER when unauthenticated
const ROOM_ID = 'admin-panel-adversarial-room';

const AR_TRANSLATIONS: Record<string, string> = {
  'chatRoom.searchBtn': 'يبحث',
  'chatRoom.liveStatus': 'مباشر',
};

function makeRoom() {
  return {
    id: ROOM_ID,
    title: 'Adversarial Study Group',
    subtitle: 'en -> ar',
    avatar: 'A',
    is_online: true,
    is_pinned: false,
    created_at: new Date().toISOString(),
    admin_id: MOCK_USER_ID, // makes chat-room.component.ts's isAdmin getter true for the mock user
  };
}

async function mockChatApi(page: Page) {
  const room = makeRoom();

  // Playwright matches routes in reverse registration order (most recently
  // added wins), so the catch-all must be registered first - otherwise it
  // shadows every specific mock below and hands back `{}` for endpoints
  // that must return arrays (e.g. rooms.find() crashes on a bare object).
  await page.route(`${API}/**`, (route) => route.fulfill({ status: 200, json: {} }));

  await page.route(`${API}/chat/rooms`, (route) => route.fulfill({ json: [room] }));
  await page.route(`${API}/chat/rooms/${ROOM_ID}`, (route) => route.fulfill({ json: room }));
  await page.route(`${API}/chat/messages/${ROOM_ID}*`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'fake-centrifugo-token' } }),
  );
  await page.route(`${API}/safety/blocked-ids`, (route) => route.fulfill({ json: [] }));
  await page.route(`${API}/safety/blocked-and-blocker-ids/${MOCK_USER_ID}`, (route) =>
    route.fulfill({ json: [] }),
  );
  await page.route(`${API}/groups`, (route) => route.fulfill({ json: [] }));

  const addMemberRequests: string[] = [];
  await page.route(`${API}/chat/groups/${ROOM_ID}/members`, async (route) => {
    if (route.request().method() === 'POST') {
      addMemberRequests.push(route.request().postData() ?? '');
      // Small artificial delay so a rapid double-click reliably lands both
      // clicks *before* either response comes back - exactly the window
      // the missing submit-guard bug needs to manifest.
      await new Promise((r) => setTimeout(r, 150));
      await route.fulfill({ json: {} });
      return;
    }
    await route.fulfill({ json: {} });
  });

  await page.route(`${API}/chat/groups/${ROOM_ID}/rename`, (route) => route.fulfill({ json: {} }));
  await page.route(`${API}/chat/groups/${ROOM_ID}/members/*`, (route) =>
    route.fulfill({ json: {} }),
  );

  return { addMemberRequests };
}

test.describe('Adversarial: chat room admin panel ignores i18n and has no double-submit guard', () => {
  test('admin panel stays hardcoded English under Arabic/RTL and duplicates requests on rapid double-click', async ({
    page,
  }) => {
    const pageErrors: Error[] = [];
    const dialogs: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });

    const { addMemberRequests } = await mockChatApi(page);

    let translateUiRequested = false;
    await page.route('**/api/nlp/translate-ui', async (route) => {
      translateUiRequested = true;
      await route.fulfill({ json: { translations: AR_TRANSLATIONS } });
    });

    // Force Arabic before the app boots, same mechanism a returning user's
    // I18nService.initLanguageFromStorage() would trigger.
    await page.addInitScript(() => {
      window.localStorage.setItem('hellotalk_locale', 'ar');
    });

    await page.goto(`/chat/${ROOM_ID}`);

    await expect.poll(() => translateUiRequested, { timeout: 10000 }).toBe(true);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dir), { timeout: 5000 })
      .toBe('rtl');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.lang), { timeout: 5000 })
      .toBe('ar');

    // Open the admin panel via its hardcoded "Admin" toggle button.
    const adminToggle = page.getByRole('button', { name: 'Admin', exact: true });
    await expect(adminToggle).toBeVisible({ timeout: 10000 });
    await adminToggle.click();

    // BUG 1: the entire panel is raw English, even though the app is fully
    // switched to Arabic/RTL everywhere else (asserted above).
    await expect(page.getByText('Group Admin Settings', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Rename', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Member', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Remove Member', exact: true })).toBeVisible();
    await expect(page.getByPlaceholder('New Group Name')).toBeVisible();
    await expect(page.getByPlaceholder('User ID to Add')).toBeVisible();
    await expect(page.getByPlaceholder('User ID to Remove')).toBeVisible();

    // BUG 2: rapid double-click with an adversarial (very long, emoji-laden,
    // markup-shaped) member id. No script should execute and no dialog
    // should fire regardless of what happens with the request count.
    const maliciousMemberId =
      '<img src=x onerror=alert(1)>'.repeat(20) + '🔥'.repeat(200) + 'a'.repeat(5000);

    const memberIdInput = page.getByPlaceholder('User ID to Add');
    await memberIdInput.fill(maliciousMemberId);

    const addMemberButton = page.getByRole('button', { name: 'Add Member', exact: true });
    // Fire both clicks without awaiting the first - a real impatient user
    // double-clicking, or a slow network encouraging a repeat click.
    await Promise.all([addMemberButton.click(), addMemberButton.click()]);

    // Let both in-flight requests resolve and their toasts render.
    await page.waitForTimeout(600);

    expect(
      addMemberRequests.length,
      'renameGroup/addMember/removeMember have no in-flight guard: a rapid ' +
        'double-click on "Add Member" fires the POST twice with the same ' +
        'member id instead of the second click being a no-op or disabled.',
    ).toBeGreaterThanOrEqual(2);

    // Visible symptom of the same bug: duplicate hardcoded English toasts,
    // still unlocalized despite the Arabic/RTL context.
    const duplicateToasts = page.getByText('Member added successfully', { exact: true });
    await expect(duplicateToasts).toHaveCount(2, { timeout: 5000 });

    // The adversarial payload must never execute or trigger a native dialog.
    expect(dialogs).toEqual([]);
    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);

    // The UI must still be responsive after all of this - the room title
    // (also present in the header) should still be rendered, not a blank
    // or crashed component tree.
    await expect(page.getByText('Adversarial Study Group')).toBeVisible();
  });
});
