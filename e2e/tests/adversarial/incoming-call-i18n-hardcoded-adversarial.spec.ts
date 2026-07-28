import { test, expect, Page } from '@playwright/test';

const MOCK_USER_ID = 'mock-user-123';
const API = 'http://localhost:3000/api';

// Real Arabic strings the backend's dynamic ANY-language translate-ui API would
// hand back for the exact keys IncomingCallModalComponent *should* be reading
// (services/i18n.service.ts already ships English seed values for both:
// 'voip.incomingVoiceCall' and 'voip.incomingVideoCall', at lines 660-661).
const AR_TRANSLATIONS: Record<string, string> = {
  'voip.incomingVoiceCall': 'مكالمة صوتية واردة...',
  'voip.incomingVideoCall': 'مكالمة فيديو واردة...',
  'voip.dismiss': 'إغلاق',
};

async function mockChatToken(page: Page) {
  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'fake-centrifugo-token' } }),
  );
}

// Minimal fake Centrifugo server, same handshake shape used by the other
// incoming-call adversarial specs (CentrifugeService connect/subscribe).
async function mockCentrifugoConnection(page: Page) {
  let wsConnection: { send: (data: string) => void } | undefined;

  await page.routeWebSocket(/connection\/websocket/, (ws) => {
    wsConnection = ws;
    ws.onMessage((message) => {
      const data = JSON.parse(message as string);
      if (data.connect) {
        ws.send(JSON.stringify({ id: data.id, connect: { client: 'i18n-adversarial-client' } }));
      } else if (data.subscribe) {
        ws.send(JSON.stringify({ id: data.id, subscribe: {} }));
      }
    });
  });

  return {
    pushToChannel: (channel: string, data: unknown) => {
      if (!wsConnection) throw new Error('WebSocket connection not established yet');
      wsConnection.send(JSON.stringify({ push: { channel, pub: { data } } }));
    },
  };
}

test.describe('Adversarial: incoming call modal ignores the active language entirely', () => {
  test('switching to Arabic flips the whole document to RTL but the incoming-call text stays hardcoded in English', async ({
    page,
  }) => {
    await mockChatToken(page);
    const centrifugo = await mockCentrifugoConnection(page);

    let translateUiRequested = false;
    // This is the real backend contract I18nService.setLanguage() calls
    // (services/i18n.service.ts, POST /api/nlp/translate-ui): it hands the
    // *whole* base dictionary to the backend and gets a fully-translated
    // dictionary back, which becomes the single source of truth for `| t`
    // and I18nService.translate() lookups from then on.
    await page.route('**/api/nlp/translate-ui', async (route) => {
      translateUiRequested = true;
      await route.fulfill({ json: { translations: AR_TRANSLATIONS } });
    });

    // Force the locale to Arabic before the app boots, exactly as it would be
    // for a returning user (I18nService.initLanguageFromStorage() reads this
    // same key on construction and calls setLanguage() with it).
    await page.addInitScript(() => {
      window.localStorage.setItem('hellotalk_locale', 'ar');
    });

    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/');

    // Confirm the language switch actually took effect app-wide: the backend
    // translation fetch fired and the document flipped to RTL. If this ever
    // stops being true the rest of the test is measuring the wrong thing.
    await expect.poll(() => translateUiRequested, { timeout: 10000 }).toBe(true);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.dir), { timeout: 5000 })
      .toBe('rtl');
    await expect
      .poll(() => page.evaluate(() => document.documentElement.lang), { timeout: 5000 })
      .toBe('ar');

    // Now ring the phone: same wire shape as the other incoming-call specs
    // (AppComponent.centrifugeService.subscribe(`user_${user.id}`, ...)).
    centrifugo.pushToChannel(`user_${MOCK_USER_ID}`, {
      type: 'incoming_call',
      callerId: 'caller-ar-1',
      callerName: 'Farida',
      roomName: 'room_ar_call',
      isVideoCall: true,
    });

    const acceptButton = page.locator('button[aria-label="Accept call"]');
    await expect(acceptButton).toBeVisible({ timeout: 5000 });

    // BUG: incoming-call-modal.component.ts (lines 44-46, 76-77, 119) writes
    // "Incoming video call...", "Decline" and "Accept" as raw template string
    // literals, and never injects I18nService or TranslatePipe at all. So
    // even though the rest of the shell has correctly flipped to Arabic/RTL
    // and the translated string is sitting right there in the dictionary
    // (services/i18n.service.ts:661, 'voip.incomingVideoCall'), the one piece
    // of UI a non-English speaker most urgently needs to read in their own
    // language, whether to answer an incoming call, never gets translated.
    await expect(page.getByText('Incoming video call...', { exact: true })).toBeVisible();
    await expect(page.getByText(AR_TRANSLATIONS['voip.incomingVideoCall'])).toHaveCount(0);
    await expect(page.getByText('Decline', { exact: true })).toBeVisible();
    await expect(page.getByText('Accept', { exact: true })).toBeVisible();

    expect(
      pageErrors,
      `Unexpected uncaught page errors: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toEqual([]);
  });
});
