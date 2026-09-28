# Local draft persistence

## Contract

Unsent Chat messages and Moment compositions are preserved locally through the shared Angular `DraftService`. The browser is the persistence boundary: drafts are not uploaded to the backend merely because they are drafts.

Chat drafts are scoped by both the authenticated user and room. The current implementation preserves the composer text plus reply and correction state. Chat state is restored when a room finishes loading, saved while the learner types and when the room/component is left, cleared after a successful send, and retained after a failed send.

Moment drafts are scoped to the authenticated user. The current implementation preserves text, media URLs/type, target language and bounded voice duration. A draft is restored after browser rendering, preserved on component teardown and grammar-review state changes, and cleared only after a Moment is successfully created.

## Privacy and security

`localStorage` is durable browser storage, not encrypted storage. Drafts can contain private conversation or Moment content, so keys are account-scoped to prevent one signed-in account from reading another account's draft through the application. The service does not log draft contents or send them to analytics.

Browser storage access is best-effort. Privacy settings, sandboxing or quota exhaustion may make `localStorage` unavailable. Those failures must never prevent composing, sending or publishing. Corrupt or oversized records are discarded instead of repeatedly breaking restore flows.

The service bounds chat and Moment text to 10,000 characters, serialized drafts to 96,000 characters, Moment media to nine HTTP(S) URLs, and voice duration metadata to 60 seconds.

## Failure behaviour

- Storage read failure: continue with an empty draft.
- Storage write failure: keep the in-memory composer usable; sending remains available.
- Corrupt/oversized persisted data: remove the unusable record and continue.
- Failed Chat send: retain the local text for retry.
- Failed Moment publish: do not clear the persisted draft.
- Successful Chat/Moment mutation: clear the corresponding local draft.

## Verification

Run the dependency-free cross-layer contract:

```bash
node --test scripts/draft-persistence-contract.test.mjs
```

The normal frontend unit suite contains the detailed `DraftService` storage, account-isolation, corruption and failure-path tests:

```bash
cd frontend
npm test -- src/app/services/draft.service.spec.ts src/app/components/chat-room/chat-room.draft-recovery.spec.ts
```

Pull requests also run the `Draft Persistence Contract` workflow, which guards the service and both product integrations without requiring a frontend dependency install.

## Rollout and rollback

No database migration, API change or server rollout is required. This is browser-local state and is backward-compatible with existing server versions. A code rollback does not require deleting stored drafts; old or unsupported records are already validated on load and discarded safely when necessary.
