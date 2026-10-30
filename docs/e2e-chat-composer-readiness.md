# E2E chat composer readiness

The canonical Playwright locator for the Chat Room text composer is `data-testid="chat-message-input"`.

## Why this contract exists

Older adversarial QA specs targeted `data-testid="message-input"`. The Angular composer later moved to the shared Spartan autocomplete input and exposes `chat-message-input` on the underlying native `<input>`. A stale locator does not fail immediately: Playwright waits for an element that can never appear and eventually reports a 30-second `locator.fill()` timeout, hiding the real selector drift.

`e2e/chat-composer-contract.test.mjs` turns that relationship into a cheap preflight contract. It verifies that:

- `ChatRoomComponent` declares the canonical `chat-message-input` test ID;
- `HlmAutocompleteInput` forwards its `testId` input to the native `<input>`, so `locator.fill()` targets an editable element;
- no Playwright spec uses the removed `message-input` ID;
- the canonical chat messaging suite exercises the current locator;
- the adversarial chat security suite exercises the current locator across XSS, long payload, null-byte injection, whitespace rejection, RTL unicode, and rapid sequential message flows.

The contract runs from the E2E package `pretest` hook before Playwright discovery or browser startup. Selector drift therefore fails in seconds with a targeted message instead of timing out inside an adversarial case.

## Backend persistence defence

In addition to locator contract validation in Playwright, the NestJS chat service and DTO layer (`SendMessageDto` and `EditMessageDto`) explicitly strip null bytes (`\0`) from message text payloads before persisting to Supabase PostgreSQL. This prevents PostgreSQL from terminating the transaction with a UTF-8 encoding error (`0x00`) while ensuring the frontend text renderer handles cleaned text safely.

## Verification

From `e2e/`:

```bash
npm run test:chat-composer-contract
npm test -- --list
```

The second command also runs backend-readiness and chat-composer preflight checks through `pretest` before Playwright collection.

## Failure and rollback

If the production composer test ID intentionally changes, update the Angular template, the Playwright specs, and this contract in the same pull request. Do not add a second hidden input or a compatibility-only interactive control just to preserve an obsolete locator.

Rollout requires no schema migration: deploy the backend validation and persistence defence with the E2E contract. The API now removes null bytes from text-message send and edit payloads before validation and persistence, so stored text can differ from the raw request only by removal of those bytes. Authentication, authorisation, analytics, and existing stored messages are unchanged.

Rollback is a normal revert of the DTO, chat-service, E2E, and contract changes. Existing cleaned messages need no data recovery, but after rollback a client that submits a null byte can once again trigger PostgreSQL's unsupported UTF-8 null-byte failure. Restore the backend sanitisation if that failure reappears.
