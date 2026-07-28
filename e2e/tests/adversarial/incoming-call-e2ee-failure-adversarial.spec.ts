import { test, expect, Page } from '@playwright/test';

const MOCK_USER_ID = 'mock-user-123';

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

test.describe('Adversarial: incoming call with a malformed E2EE key', () => {
  test('a call that fails to join because of a malformed e2eeKey must leave the call modal dismissible', async ({
    page,
  }) => {
    const centrifugo = await mockCentrifugoConnection(page);

    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/');
    await page.waitForTimeout(1500);

    // The `incoming_call` push is untyped `unknown` data coming straight off the
    // wire (see IncomingCallComponent's centrifugoService.subscribe callback) - a
    // buggy or compromised backend can send an e2eeKey that isn't the `string`
    // the frontend type declares. Sending a bare number here makes LiveKit's
    // ExternalE2EEKeyProvider.setKey() reject (it isn't a string, so it falls
    // through to the ArrayBuffer/importKey path, which throws on a number).
    centrifugo.pushToChannel(`user_${MOCK_USER_ID}`, {
      type: 'incoming_call',
      callerId: 'attacker-id',
      callerName: 'Attacker',
      roomName: 'room_e2ee_malformed',
      isVideo: true,
      e2eeKey: 1234567890,
    });

    const acceptButton = page.locator('button[aria-label="Accept call"]');
    await expect(acceptButton).toBeVisible({ timeout: 5000 });

    await acceptButton.click();

    // Let the async joinRoom()/setKey() rejection propagate and the component's
    // catch block re-show the modal.
    await page.waitForTimeout(1000);

    const rejectButton = page.locator('button[aria-label="Reject call"]');
    await expect(
      rejectButton,
      'call modal must still offer a way to dismiss it after a failed join',
    ).toBeVisible();

    // The modal must remain fully functional: the user must be able to reject
    // (dismiss) it. IncomingCallComponent.acceptCall() unconditionally clears
    // `callInfo` after the try/catch, even along the failure path where it also
    // re-opens the modal - so `callInfo` is null while `showCallModal` is true.
    // Both acceptCall() and rejectCall() bail out early with `if (!info) return`,
    // so once this happens, neither button can ever close the modal again.
    await rejectButton.click();
    await page.waitForTimeout(300);

    await expect(
      rejectButton,
      'BUG: the incoming-call modal is stuck open with no working accept/reject action after a failed join - it permanently blocks the whole app behind a fixed full-screen overlay',
    ).not.toBeVisible();

    expect(
      pageErrors,
      `Expected no uncaught page errors, but got: ${pageErrors.map((e) => e.message).join('; ')}`,
    ).toHaveLength(0);
  });
});
