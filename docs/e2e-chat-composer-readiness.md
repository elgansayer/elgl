# E2E chat composer readiness

The canonical Playwright locator for the Chat Room text composer is `data-testid="chat-message-input"`.

## Why this contract exists

Issue #1584 recorded a QA run in which every case of `e2e/tests/adversarial/adversarial-chat.spec.ts` (for example `send message containing null byte`) failed with `locator.fill: Test timeout of 30000ms exceeded` while waiting for the composer. Two problems combined:

- Older adversarial QA specs targeted `data-testid="message-input"` (and `adversarial-chat-video.spec.ts` targeted the `.message-input` class). The Angular composer later moved to the shared Spartan autocomplete input and exposes `chat-message-input` on the underlying native `<input>`.
- Six of the seven cases in `adversarial-chat.spec.ts` never navigated anywhere, and the seventh only visited `/video/room123` and then the `/chat` room list. The composer was never on the page, even under the canonical ID, so correcting the selector alone would not have made the suite pass.

A stale or absent locator does not fail immediately: Playwright waits for an element that can never appear and eventually reports a 30-second `locator.fill()` timeout, hiding the real cause. The generated `e2e/tests/adversarial/` suite has been removed and must not be restored unchanged (see `docs/e2e-login-boundary.md`). A replacement adversarial scenario should follow `e2e/tests/chat-messaging.spec.ts`: install deterministic route fixtures, open `/chat/<room id>`, assert the composer is visible, and only then send the hostile input.

## Guards

Three layers stop the failure from returning, from cheapest to most realistic.

1. **Preflight contract.** `e2e/chat-composer-contract.test.mjs` runs from the E2E package `pretest` hook before Playwright discovery or browser startup, so selector drift fails in seconds with the offending `file:line` instead of a 30-second timeout. It verifies that:
   - `ChatRoomComponent` declares the canonical `chat-message-input` test ID;
   - `HlmAutocompleteInput` forwards its `testId` input to the native `<input>`, so `locator.fill()` targets an editable element;
   - no Playwright spec, helper, fixture or page object under `e2e/tests` targets a removed composer locator: `[data-testid="message-input"]` (quoted, unquoted or spaced), `getByTestId('message-input')`, `.message-input` or `#message-input`;
   - the canonical chat messaging suite exercises the current locator.
2. **Rendered DOM unit tests.** `chat-room.composer-locator.spec.ts` renders the real `ChatRoomComponent` and asserts that exactly one editable native `<input>` matches the canonical test ID, that no `message-input` alias exists, and that typing then pressing Enter sends the text and clears the field, which is what Playwright's `fill()` and `press('Enter')` rely on. `hlm-autocomplete-input.spec.ts` covers the primitive: the test ID lands on the native input rather than the wrapper, the attribute is dropped when unset instead of rendering `"null"`, and native input and keydown events reach the host. These run in the ordinary frontend unit gate, so a template refactor fails there before any browser run.
3. **Browser flow.** `e2e/tests/chat-messaging.spec.ts` drives the real composer against deterministic route fixtures and remains the authoritative end-to-end proof.

## Limits

The preflight scan is static text matching for the selector forms QA specs have used. It cannot see a locator assembled at runtime or reached through a variable, and it also flags a comment that quotes a removed locator. Treat it as a cheap early warning, not a substitute for the browser suite.

## Verification

From `e2e/`:

```bash
npm run test:chat-composer-contract
npm test -- --list
```

The second command also runs the backend-readiness, web-server readiness and chat-composer preflight checks through `pretest` before Playwright collection.

From `frontend/`:

```bash
npx ng test --no-watch \
  --include='src/app/components/chat-room/chat-room.composer-locator.spec.ts' \
  --include='src/app/components/ui/autocomplete/src/lib/hlm-autocomplete-input.spec.ts'
```

## Failure and rollback

If the production composer test ID intentionally changes, update the Angular template, the Playwright specs, the frontend unit tests and this contract in the same pull request. Do not add a second hidden input or a compatibility-only interactive control just to preserve an obsolete locator; the unit tests assert that no such alias exists.

This change has no API, database, authentication, analytics, or persisted-state impact. Rollback is a normal revert of the E2E contract, frontend spec and documentation changes.
