# Chat language actions

Issue #841 is intentionally completed against the product that exists in the repository rather than inventing the missing reference implied by its truncated title. No authoritative external UI specification for “interface mirroring” is present in the codebase.

## User-facing contract

Text messages expose language-learning actions through the shared message context menu. The chat surface currently supports:

- Translate: request a translation into the active UI language and show or hide the translated variant without replacing the original message.
- Transliterate: show a transliteration when the language provider supplies one.
- Correct: prefill the correction composer from the selected message.
- Request correction: send an attributable correction-request message that replies to the source message.
- Correction display: render original, corrected text, and optional explanation through `VisualDiffComponent`.

The original message remains visible while a translation is shown, so the user can always recover the source text. Provider output is rendered with Angular text interpolation rather than trusted HTML.

## Frontend ownership

`ChatRoomComponent` owns per-message presentation state and delegates network operations to typed services:

- `ChatService.translateText()` calls the authenticated NLP translation endpoint.
- `TranslationCacheService` is an optional browser-side optimisation for translation results.
- `VocabularyStore` owns the existing transliteration request path.
- `ChatService.sendMessage()` owns correction and correction-request mutations.
- `VisualDiffComponent` owns correction comparison presentation.
- `LongPressContextMenuComponent` owns the accessible desktop/mobile message-action entry point.

Do not add raw `fetch()` calls to message components for translation or correction. New language actions should reuse these boundaries or introduce one shared typed service when the existing boundary is insufficient.

## Translation cache reliability

Browser storage is not a correctness dependency. Private browsing, enterprise policy, storage quota exhaustion, or browser security settings can make `localStorage` throw synchronously.

The translation cache therefore follows these rules:

1. A storage read failure is treated as a cache miss.
2. A storage write failure never turns a successful translation into a failed action.
3. Cache clearing and eviction are best-effort.
4. Entries expire after seven days.
5. New entries persist their source text and target language alongside the cached value. This metadata is validated on read so a hash collision cannot surface a translation for different source text.
6. Legacy entries containing only `value` and `timestamp` remain readable during migration.

The server remains authoritative for a translation when no valid cached value exists.

## Failure and privacy behaviour

- Authentication remains owned by `AuthService`/`ChatService`; translation code must not log access tokens.
- Message text is sent only to the existing NLP translation endpoint when the user explicitly requests translation and no valid cache entry exists.
- Cache failures are silent implementation details and must not produce a false “translation failed” state.
- Provider failures leave the original message intact and are surfaced through the existing translated error/toast path.
- Correction mutations remain normal chat messages, preserving sender attribution, source-room context, and the existing server authorization boundary.

## Accessibility and rendering

- Original and translated strings are rendered as text, not HTML.
- Message actions remain reachable through the shared context-menu interaction used by keyboard and touch users.
- Translation is additive: it does not remove or replace the source text.
- Correction output uses semantic insertion/deletion presentation in `VisualDiffComponent` and must not communicate changes by colour alone.

## Verification

Relevant automated coverage lives in:

- `frontend/src/app/components/chat-room/chat-room.component.spec.ts` for translate/show-hide, transliteration, correction-prefill, and correction-request behaviour;
- `frontend/src/app/services/translation-cache.service.spec.ts` for cache identity, expiry, legacy compatibility, malformed data, blocked storage, and quota failure behaviour;
- `frontend/src/app/components/visual-diff/visual-diff.component.spec.ts` for correction rendering semantics.

The normal frontend unit, static-analysis, production-build, design-governance, and repository CI checks are required before merge.

## Rollback

This change does not alter an API, schema, route, or persisted server-side data shape. Reverting the cache hardening restores the previous browser cache implementation. Stored legacy and new cache entries are disposable and may be cleared at any time without data loss.
