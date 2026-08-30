# Local draft persistence

Issue #1074 keeps unfinished chat and Moment composition state on the device so navigation, route changes, and normal component teardown do not silently discard work.

## Runtime contract

`frontend/src/app/services/draft.service.ts` is the single browser-storage boundary for drafts. Chat rooms use user-scoped, room-scoped keys. The legacy text-only chat key remains supported for mixed-version compatibility, while the v2 chat draft also stores reply/correction composition state. Moments use one user-scoped compose key containing text, remote media URLs, media type, target language, and an optional voice duration.

`ChatRoomComponent` restores the active room draft after message history loads, saves composer state on input and when changing rooms, and clears both chat draft formats only after a successful send. Failed text sends retain the draft. `MomentsFeedComponent` restores its compose draft after browser rendering, preserves it during normal teardown and grammar-review corrections, and clears it only after a Moment is successfully created.

Draft persistence is deliberately best-effort. Blocking `localStorage`, browser privacy restrictions, quota exhaustion, malformed stored JSON, or cleanup failures must never prevent typing, sending, or publishing.

## Privacy and security

Drafts contain private user-authored content and remain local to the browser. They are not uploaded, logged, added to analytics, or included in diagnostics by `DraftService`. Authenticated storage keys are namespaced by user ID so switching accounts does not load another authenticated user's draft. The pre-existing anonymous namespace remains for compatibility before authentication is available.

Stored input is treated as untrusted when restored. The service validates object shapes, bounds text and identifiers, caps Moment media to nine HTTP(S) URLs, rejects oversized/unsafe URLs, constrains voice duration, and removes malformed or oversized serialized records. Restored text is still rendered through the application's normal Angular/text boundaries rather than as trusted HTML.

Because browser storage is readable by JavaScript running on the same origin, it is not a secret store. Credentials, access tokens, API keys, raw media blobs, or other authentication material must never be added to the draft schema.

## Limits

- room identifier: 160 characters
- chat text: 10,000 characters
- each correction field: 10,000 characters
- Moment text: 10,000 characters
- Moment media: at most 9 HTTP(S) URLs
- media URL: 4,096 characters
- target-language identifier: 32 characters
- Moment voice duration: 0-60 seconds
- serialized draft record: 96,000 characters

The limits protect the synchronous browser-storage path from corrupt or unexpectedly large records. Product/backend validation remains authoritative when content is actually submitted.

## Failure and recovery

Storage read/write/remove operations are wrapped individually. `SecurityError`, `QuotaExceededError`, SSR/no-storage environments, and comparable browser failures degrade to an in-memory composer with no exception escaping the service.

Malformed, invalid-shape, or oversized structured drafts are treated as absent and are removed on a best-effort basis. This prevents one corrupt record from poisoning every later visit to the room or Moments composer.

A successful chat/Moment submission clears its persisted draft. A failed submission does not. No background cleanup job or database migration is required because all state is device-local.

## Verification

`frontend/src/app/services/draft.service.spec.ts` covers:

- per-room and per-user chat isolation;
- enriched reply/correction round trips;
- Moment text/media/voice round trips;
- corrupt-record cleanup;
- text, media, URL, and duration bounds;
- unsafe media URL filtering;
- unavailable, blocked, quota-exhausted, and cleanup-failure storage paths.

The normal frontend Vitest, static-analysis, formatting, and production-build jobs remain authoritative for repository integration.

## Rollout and rollback

No API, schema, server configuration, or data migration is required. Deploy with the frontend. Existing valid keys remain compatible; invalid historical values simply degrade to no restored draft.

Rollback is a normal code revert. Draft keys can be left in `localStorage`; older compatible clients can continue reading their supported formats. Do not introduce server-side draft persistence as a rollback shortcut because that would materially change the privacy and retention model.
