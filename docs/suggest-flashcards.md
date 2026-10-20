# Suggest Flashcards

The Suggest Flashcards flow extracts word-like vocabulary candidates from a bounded text input and lets the authenticated learner add selected words to their vocabulary library.

## Request contract

`GET /api/flashcards/suggest` requires a valid Supabase session and accepts:

- `message`: source text, up to 5,000 characters.
- `target_language`: optional BCP 47 locale for `Intl.Segmenter`, up to 35 characters.
- `exclude_known`: defaults to `true`.
- `max_results`: 1-100, default 20.
- `user_id`: deprecated compatibility input. It is accepted for mixed-version clients but is ignored for authorization and filtering.

The server always derives ownership from the authenticated Supabase user. A caller cannot use `user_id` to query another account's mastered vocabulary.

## Suggestion behaviour

The backend uses `Intl.Segmenter` with word granularity, normalises word-like segments to locale-aware lowercase, removes duplicates while preserving source order, and applies the result limit. When `exclude_known` is enabled, SRS level 4 words from the authenticated learner's flashcard library are removed.

Punctuation-only input produces an empty suggestion list. Unsupported locale tags return a validation error instead of crashing the request.

## Privacy and security

Suggestion text and vocabulary contents are private learner data. The endpoint remains behind `SupabaseAuthGuard` and SRS rate limiting. Logs contain only aggregate counts and stable failure classifications; source text, access tokens, user IDs, and word lists are not logged.

Known-word lookup failures fail closed with `503 Service Unavailable`. The service does not silently return mastered words as new suggestions when the learner's vocabulary library cannot be read.

Authenticated suggestion responses retain the repository's private cache contract and vary by Authorization.

## Frontend behaviour

The Angular client no longer sends a user identifier. It supplies only the text, optional target language, `exclude_known`, and optional result limit. The component:

- disables duplicate manual submissions while a request is active;
- ignores stale responses from superseded requests;
- exposes loading, empty, and error states to assistive technology;
- keeps mixed-direction vocabulary readable with `dir="auto"`;
- reports failed vocabulary writes without marking a word as added;
- preserves the current text so a failed request can be retried.

## Failure handling and observability

Expected failures are:

- `400`: invalid/unsupported request data or target locale;
- `401`: missing authenticated user;
- `429`: request-rate limit exceeded;
- `503`: mastered-word lookup unavailable.

The backend emits a sanitised `known_words_lookup_failed` warning for storage failures. The frontend uses the existing SRS error boundary and global error handler without copying the source text into error metadata; only message length is recorded.

## Verification

Focused coverage lives in:

- `backend/src/flashcards/suggest-flashcards.service.spec.ts`
- `backend/src/flashcards/suggest-flashcards.controller.spec.ts`
- `frontend/src/app/services/suggest-flashcards.service.spec.ts`
- `frontend/src/app/components/suggest-flashcards/suggest-flashcards.component.spec.ts`

The tests cover authenticated ownership, legacy `user_id` isolation, known-word filtering, storage failure, multilingual segmentation, result bounds, client query construction, retry/error behaviour, and vocabulary writes.

## Rollout and rollback

Deploy the backend before or at the same time as the frontend. The backend continues accepting the legacy `user_id` query field while ignoring it, so older clients remain compatible during rollout.

Rollback the frontend first if necessary. The hardened backend can remain deployed because the old client contract is still accepted. Do not reintroduce caller-controlled ownership into the known-word lookup; doing so would restore a cross-account privacy boundary flaw.
