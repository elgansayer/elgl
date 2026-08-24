# Pre-send grammar review

Issue #979 adds an advisory grammar check before a text chat message or text Moment is sent.

## User flow

For text content, the client calls `POST /nlp/grammar-check` before the existing send or publish mutation.

- When no correction is suggested, the original text is sent immediately.
- When a correction is suggested, the composer is replaced with the corrected text and the explanation is shown. Nothing is sent yet. The user can edit the suggestion or submit again to accept it.
- Media-only Moments do not call the grammar checker.
- If the grammar provider is unavailable, `VocabularyStore` preserves the existing degraded-mode behaviour and returns the original text with zero suggested edits. Grammar checking is advisory, so a provider outage does not prevent communication.
- Chat suppresses duplicate submissions while a grammar request is in flight.

The grammar checker never sends a chat message or creates a Moment itself. Existing chat and Moments APIs remain the only write paths.

## API contract

`POST /nlp/grammar-check` remains authenticated by `SupabaseAuthGuard` and protected by both the endpoint throttle and the NLP rate-limiter guard.

Request:

```json
{
  "text": "I go to school yesterday.",
  "language": "en-GB"
}
```

`text` is trimmed, required and limited to 2,000 characters. `language` is optional, limited to 35 characters and accepts a BCP 47-style language tag such as `en`, `en-GB` or `zh-Hans`.

Successful response:

```json
{
  "original": "I go to school yesterday.",
  "corrected": "I went to school yesterday.",
  "explanation": "Use the past tense.",
  "errors_found": 1
}
```

The server derives `original` from the validated request rather than trusting provider output. Changed text is normalised to at least one error and unchanged text to zero errors.

## Provider and failure behaviour

The route uses the configured `LlmProxyService`, so deployment continues to use `LLM_API_URL`, `LLM_API_KEY` and `LLM_MODEL`. The previous Azure Translator dictionary lookup is not used by the route because dictionary translation is not a grammar-checking provider.

The provider prompt explicitly treats user text as untrusted data and requires a JSON-only result. Responses are parsed and bounded before reaching clients. Empty, malformed or oversized results fail closed with `503 Grammar checking is temporarily unavailable`. Provider details and user text are not copied into the public error.

A grammar-provider call is bounded to 10 seconds. Existing per-minute endpoint limits remain in place, and the existing daily free-tier AI usage policy is still applied before the provider call. VIP profiles retain the existing daily-limit exemption.

## Privacy and caching

Grammar requests contain user-authored draft text. The endpoint therefore retains `Cache-Control: private, no-store`. The grammar service does not persist drafts, add a cache entry or log the submitted text. Draft text is sent only through the configured LLM proxy for the requested check.

Client-side drafts continue to use the existing `DraftService`. A suggested correction is saved back to that draft so a navigation or refresh does not silently restore the pre-correction text.

## Verification

Focused tests cover:

- DTO trimming, maximum length and language-tag validation;
- provider prompt hardening, JSON parsing, normalisation and fail-closed responses;
- controller authentication, free/VIP daily-limit routing and provider delegation;
- chat suggestion review, second-submit acceptance, duplicate suppression and degraded operation;
- Moments suggestion review, second-submit acceptance, degraded operation and media-only publishing.

The normal repository backend and frontend test, type-check, lint and format jobs remain the release gate.

## Rollout and rollback

No database migration or data backfill is required. Deploy the backend and frontend from the same release so the pre-send UI and provider route behaviour change together. Monitor `429` and `503` responses from `/nlp/grammar-check` and the configured LLM provider's latency/error rate.

Rollback is a code-only revert of the pull request. Existing chat messages, Moments and drafts do not require migration or repair because the feature does not change their stored schema or write APIs.
