# Chat translation and correction contract

Issue: #1297

## Product behavior

ELGL exposes language-learning actions from each text message through the existing message context menu. The production flow intentionally reuses the same chat message, translation, vocabulary, and correction primitives used elsewhere in the application rather than creating a parallel translation surface.

### Translation

- **Translate** sends the source message to the authenticated chat translation endpoint and targets the current application language.
- The source message always remains visible. Translation is an optional learner aid rendered alongside it and can be shown or hidden without mutating the original chat row.
- A successful translation is cached for the current application lifetime so repeatedly opening the same source/target pair does not call the provider again.
- Translation cache entries are held **in memory only**. Private chat source text and translated text are not written to `localStorage`, `sessionStorage`, IndexedDB, or a new server table by the cache.
- Cache entries are exact source/target pairs, expire after seven days at the latest, and are bounded to 500 entries with least-recently-used eviction. A page reload, browser restart, logout/reload, or a fresh application process discards the cache.
- Provider failure leaves the original message usable and does not poison the cache. The learner can retry the action later.

### Corrections

- **Correct** opens the existing correction composer for text messages and preserves the selected source sentence as `correction_payload.original`.
- The learner supplies corrected text and may include an explanation. Leading/trailing whitespace is removed before submission.
- A correction is a normal authenticated chat message with `message_type = correction`. The existing `VisualDiffComponent` renders original and corrected forms together.
- Correction fields are cleared only after the message has been persisted successfully. A failed send leaves the complete draft available for retry.
- **Request correction** creates a `correction_request` message linked to the source through `reply_to_id`, preserving the original text in the bounded correction-request payload.
- Existing group-chat correction behavior uses the same message contract and room authorization path.

## API and authorization boundary

Chat APIs are guarded by `SupabaseAuthGuard`; the authenticated user identity is derived from the verified Supabase session rather than supplied by the request body. Translation uses the existing `/chat/translate-real-time` route and correction messages use the existing `/chat/messages` path. Existing room-membership, block, first-contact filtering, message validation, and Centrifugo publication behavior remain authoritative.

The translation route is rate limited and delegates language detection/translation to the configured translation service. This change does not add a new provider, credential, anonymous endpoint, database table, or direct browser write path.

## Privacy and security

Message text is private user content. The following rules apply:

1. Translation sends only the requested message text and target language through the authenticated translation path. Do not add source text, translated text, correction text, room IDs, tokens, provider payloads, or credentials to analytics or application logs.
2. Translation cache data is memory-only. This avoids durable copies of private conversations in shared browser profiles and removes the collision risk of the previous non-cryptographic local-storage hash key.
3. Translation output is displayed through Angular text interpolation. Do not introduce raw HTML rendering for provider output.
4. Corrections continue through the normal authenticated chat persistence boundary and inherit the room's retention/deletion rules.
5. A translation result is advisory content. It never overwrites the stored source message.

## Failure and concurrency behavior

- Translation provider/network failure: keep the source message visible, store no cache entry, and allow a later retry.
- Translation cache miss/expiry: call the authoritative translation API normally.
- Cache overflow: evict least-recently-used entries without affecting the displayed translation result.
- Cache lifecycle reset: a fresh application instance starts empty by design.
- Correction persistence failure: preserve original, corrected, and explanation draft fields and leave the correction form open.
- Correction persistence success: append the returned canonical message, clear the correction draft, and close the editor.
- Correction-request failure: do not create a local synthetic success row; retry remains safe through the existing send path.

## Accessibility and international text

The translation and correction actions remain native/Spartan button actions in the existing keyboard-accessible context-menu dialog. Original chat text is never hidden as the sole way to reveal translated content, so a translation-provider failure cannot make the conversation unreadable. Corrections continue to use the shared visual-diff component, which presents both forms rather than communicating the change by colour alone.

Text rendering must continue to support mixed-direction and non-Latin content through the existing tokenisation/visual-diff primitives. Translation controls must remain usable at high zoom and by keyboard or assistive technology.

## Verification

Focused frontend regression coverage locks:

- translation targeting to the current application language;
- cache-hit behavior without another provider call;
- show/hide behavior without duplicate network requests;
- provider-failure behavior without a poisoned cache;
- text-only correction editing;
- trimmed correction payloads and post-success cleanup;
- retry-safe correction drafts after failed persistence;
- source-linked correction requests;
- memory-only translation cache behavior;
- exact source/target cache isolation;
- seven-day expiry and 500-entry LRU bounding.

Repository GitHub Actions remain the authoritative clean-environment validation for frontend unit tests, static analysis/build, translation-safety checks, dependency review, and the wider application contracts.

## Rollout and rollback

No database migration, generated client, route, or provider configuration change is required. Deploy as a normal frontend release. The cache change is backward compatible because it changes only an optional client-side performance optimization; a fresh client naturally starts with an empty cache.

Rollback is a normal application revert and requires no stored-data repair. Do not restore durable browser persistence of private chat translations solely to preserve cache hits; provider caching should remain an optimization rather than a second durable store of conversation content.
