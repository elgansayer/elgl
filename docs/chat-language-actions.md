# Chat language actions

Issue #841 is intentionally completed against the product that exists in the repository rather than inventing the missing reference implied by its truncated title. No authoritative external UI specification for “interface mirroring” is present in the codebase.

Issue #1387 is implemented by the shared client-side translation cache and the per-message/per-Moment visibility state. A learner can hide and show an already translated string without making another provider request.

## User-facing contract

Text messages expose language-learning actions through the shared message context menu. The chat surface currently supports:

- Translate: request a translation into the active UI language and show or hide the translated variant without replacing the original message.
- Transliterate: show a transliteration when the language provider supplies one.
- Correct: prefill the correction composer from the selected message.
- Request correction: send an attributable correction-request message that replies to the source message.
- Correction display: render original, corrected text, and optional explanation through `VisualDiffComponent`.

Moments use the same client-side translation-cache service before requesting a translation. Component-local visibility state controls whether the original or cached translated presentation is shown.

The original content remains available while a translation is shown, so the user can always recover the source text. Provider output is rendered with Angular text interpolation rather than trusted HTML.

## Frontend ownership

`ChatRoomComponent` owns per-message presentation state and delegates network operations to typed services:

- `ChatService.translateText()` calls the authenticated NLP translation endpoint.
- `TranslationCacheService` owns the shared browser-process cache for translation results.
- `VocabularyStore` owns the existing transliteration and Moments translation request paths.
- `ChatService.sendMessage()` owns correction and correction-request mutations.
- `VisualDiffComponent` owns correction comparison presentation.
- `LongPressContextMenuComponent` owns the accessible desktop/mobile message-action entry point.

Do not add raw `fetch()` calls to message components for translation or correction. New language actions should reuse these boundaries or introduce one shared typed service when the existing boundary is insufficient.

## Translation cache contract

The translation cache is deliberately process-local and memory-only because chat and Moment text can contain sensitive personal content. It is a performance optimisation, never a source of truth.

The cache follows these rules:

1. Cache identity includes the exact source text and normalized target language.
2. A hit is checked before another translation-provider request is made.
3. Hiding a translation does not evict it, so showing it again does not make another API call.
4. Entries expire after seven days.
5. The cache is capped at 500 entries and uses least-recently-used eviction.
6. Empty source, target-language, or translated values are not cached.
7. Cache contents are not written to `localStorage`, `sessionStorage`, IndexedDB, cookies, or server persistence.
8. A fresh application process starts with an empty cache. Losing the cache is always safe because the server/provider path remains authoritative.

The process-local policy supersedes the older browser-storage cache design. There is no migration requirement: historical browser-cache data is disposable and is no longer read by `TranslationCacheService`.

## Failure and privacy behaviour

- Authentication remains owned by `AuthService` and typed API services; translation code must not log access tokens.
- Source text is sent to the existing NLP translation endpoint only when the learner explicitly requests translation and no valid cache entry exists.
- A cache miss is not an error and never changes the user-visible source text.
- Provider failures leave the original content intact and must remain retryable rather than creating a successful cached translation.
- Correction mutations remain normal chat messages, preserving sender attribution, source-room context, and the existing server authorization boundary.

## Accessibility and rendering

- Original and translated strings are rendered as text, not HTML.
- Message actions remain reachable through the shared context-menu interaction used by keyboard and touch users.
- Translation is additive: it does not remove or destructively replace the source text.
- Correction output uses semantic insertion/deletion presentation in `VisualDiffComponent` and must not communicate changes by colour alone.

## Verification

Relevant automated coverage lives in:

- `frontend/src/app/components/chat-room/chat-room.translation-corrections.spec.ts` for cache-first translation and repeated show/hide behavior without another provider request;
- `frontend/src/app/services/translation-cache.service.spec.ts` for source/target identity, expiry, LRU bounds, memory-only privacy, and fresh-process behavior;
- `scripts/translation-cache-contract.test.mjs` for the cross-surface contract that Chat and Moments keep the shared cache boundary and cache-first ordering;
- `frontend/src/app/components/visual-diff/visual-diff.component.spec.ts` for correction rendering semantics.

Run the focused dependency-free contract with:

```sh
node --test scripts/translation-cache-contract.test.mjs
```

The normal frontend unit, static-analysis, production-build, design-governance, and repository CI checks remain authoritative before merge.

## Rollout and rollback

This contract does not alter an API, schema, route, or persisted server-side data shape. Deployment is frontend-only. Rollback may revert the verification/documentation changes without data cleanup. The memory cache can always be discarded without user data loss; a rollback must not reintroduce persistent storage of private translated chat or Moment text without a separate privacy review.
