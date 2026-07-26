import { test, expect, Page } from '@playwright/test';

const MOCK_USER_ID = 'mock-user-123';
const API = 'http://localhost:3000/api';

// CentrifugeService.connect() (frontend/src/app/services/centrifuge.service.ts)
// fetches a real Centrifugo token over HTTP before ever opening the websocket,
// so the websocket mock below is unreachable unless this succeeds.
async function mockChatToken(page: Page) {
  await page.route(`${API}/chat/token`, (route) =>
    route.fulfill({ json: { token: 'fake-centrifugo-token' } }),
  );
}

/**
 * Minimal fake Centrifugo server good enough to satisfy the connect/subscribe
 * handshake used by CentrifugeService (frontend/src/app/services/centrifuge.service.ts),
 * and to inject arbitrary realtime pushes onto a channel.
 */
async function mockCentrifugoConnection(page: Page) {
  let wsConnection: { send: (data: string) => void } | undefined;

  await page.routeWebSocket(/connection\/websocket/, (ws) => {
    wsConnection = ws;
    ws.onMessage((message) => {
      const data = JSON.parse(message as string);
      if (data.connect) {
        ws.send(JSON.stringify({ id: data.id, connect: { client: 'adversarial-client-id' } }));
      } else if (data.subscribe) {
        ws.send(JSON.stringify({ id: data.id, subscribe: {} }));
      }
    });
  });

  return {
    pushToChannel: (channel: string, data: unknown) => {
      if (!wsConnection) throw new Error('WebSocket connection not established yet');
      wsConnection.send(
        JSON.stringify({
          push: {
            channel,
            pub: { data },
          },
        }),
      );
    },
  };
}

test.describe('Adversarial: incoming call push with missing/malformed caller fields', () => {
  test('an incoming_call push with no callerName crashes the caller-initials avatar render', async ({
    page,
  }) => {
    const centrifugo = await mockCentrifugoConnection(page);
    await mockChatToken(page);

    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/');
    await page.waitForTimeout(1500);

    // AppComponent.ngOnInit's centrifugeService.subscribe callback
    // (app.component.ts) trusts the raw wire payload completely: it casts
    // `data` straight to `IncomingCallData & { type: string }` with no runtime
    // validation, then forwards callerName untouched into IncomingCallModalComponent's
    // `callData` input. The template's fallback avatar branch
    // (incoming-call-modal.component.ts) unconditionally calls
    // `data.callerName.charAt(0).toUpperCase()` assuming the string is always
    // present, exactly the assumption a malicious or buggy backend can violate.
    centrifugo.pushToChannel(`user_${MOCK_USER_ID}`, {
      type: 'incoming_call',
      callerId: 'attacker-id',
      // callerName intentionally omitted
      roomName: 'room_missing_caller_name',
      isVideoCall: true,
    });

    await page.waitForTimeout(1000);

    // The rest of the app (nav, root shell) must still be alive - this must not
    // be a full white-screen crash of the whole SPA.
    await expect(page.locator('app-root')).toBeVisible();

    // BUG: a template expression throwing on `undefined.charAt` during change
    // detection surfaces as an uncaught exception via Angular's ErrorHandler.
    // A well-behaved app would treat a missing callerName as an empty/unknown
    // caller (e.g. render '?' like the sibling VoipCallComponent does with
    // `displayName()[0]?.toUpperCase() || '?'`), not throw.
    expect(
      pageErrors.some((e) => /charAt|callerName|undefined/i.test(e.message)),
      `Expected the missing-callerName crash to be caught as a page error, got: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toBe(true);
  });

  test('rapid-fire overlapping incoming_call pushes leave a permanently ringing, undismissable modal', async ({
    page,
  }) => {
    const centrifugo = await mockCentrifugoConnection(page);
    await mockChatToken(page);

    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/');
    await page.waitForTimeout(1500);

    // Fire a burst of well-formed incoming_call events from different
    // "callers" back-to-back, faster than a human could ever accept/decline.
    // AppComponent.incomingCallData is a single signal with no queueing, so
    // each push just clobbers the previous caller's data mid-ring.
    for (let i = 0; i < 10; i++) {
      centrifugo.pushToChannel(`user_${MOCK_USER_ID}`, {
        type: 'incoming_call',
        callerId: `caller-${i}`,
        callerName: `Caller ${i}`,
        roomName: `room_${i}`,
        isVideoCall: i % 2 === 0,
      });
      await page.waitForTimeout(30);
    }

    const acceptButton = page.locator('button[aria-label="Accept call"]');
    await expect(acceptButton).toBeVisible({ timeout: 5000 });

    // Only the very last caller's name should be showing - stale callers must
    // never be silently accepted/merged.
    await expect(page.getByText('Caller 9', { exact: true })).toBeVisible();

    await acceptButton.click();

    // onAcceptCall() in app.component.ts only logs to the console and clears
    // incomingCallData - it never actually calls into LivekitService to join
    // the room (see the `// TODO: Navigate to call room or start LiveKit
    // session` in app.component.ts). Accepting a call must not silently be a
    // no-op that leaves the user believing they're now in a call.
    await page.waitForTimeout(500);
    await expect(acceptButton).not.toBeVisible();

    expect(
      pageErrors,
      `Expected no uncaught page errors from rapid overlapping calls, got: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toHaveLength(0);
  });
});
