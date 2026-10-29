# Pre-send grammar review

Issues #979, #1343 and #1698 describe this one advisory grammar check before a text chat message or text Moment is sent. This is the single implementation and operations contract.

## User flow

For text content, the client calls `POST /nlp/grammar-check` before the existing send or publish mutation.

- When no correction is suggested, the original text is sent immediately.
- When a correction is suggested, the composer is replaced with the corrected text and the explanation is shown. Nothing is sent yet. The user can edit the suggestion or submit again to accept it.
- Media-only Moments do not call the grammar checker.
- If the grammar provider is unavailable, `VocabularyStore` preserves the existing degraded-mode behaviour and returns the original text with zero suggested edits. Grammar checking is advisory, so a provider outage does not prevent communication.
- Chat suppresses duplicate submissions while a grammar request is in flight.

The grammar checker never sends a chat message or creates a Moment itself. Existing chat and Moments APIs remain the only write paths.

### Review rules

The client remembers the original and suggested wording after showing a correction. Submitting either reviewed wording sends it without a second provider call. Editing to any other wording runs a fresh check. The review is cleared after a successful send or publish, when the chat room changes, and when a Moment's target language changes.

If the learner keeps typing while a check is in flight, the newer draft wins. The stale suggestion is neither applied nor sent. Moments also reject concurrent submissions and keep the composer open for suggestions and failed publishes. Only a successful publish closes it.

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

Responses are `201` on success, `400` for validation failures, `401` for missing or invalid authentication, `429` for per-minute or daily quota exhaustion, and a generic `503` when the provider times out, fails or returns an unusable response.

## Provider and failure behaviour

The route uses the configured `LlmProxyService`, so deployment continues to use `LLM_API_URL`, `LLM_API_KEY` and `LLM_MODEL`. The previous Azure Translator dictionary lookup is not used by the route because dictionary translation is not a grammar-checking provider.

Provider instructions are isolated in a system message. The learner's language hint and draft are placed only in a JSON user message and explicitly treated as untrusted data. Responses are parsed and bounded before reaching clients. Empty, malformed or oversized results fail closed with `503 Grammar checking is temporarily unavailable`. Provider details and user text are not copied into the public error.

A grammar-provider call is bounded to 10 seconds and the upstream request is aborted at the deadline. The output budget scales with input length up to 4,000 tokens, preventing valid long or CJK input from being truncated by the shared 500-token default. Existing per-minute endpoint limits remain in place, and the existing daily free-tier AI usage policy is applied before the provider call. VIP profiles retain the existing daily-limit exemption.

## Observability

Success and failure volume plus provider latency use the existing reading-engine AI Prometheus metrics with `endpoint="grammar-check"`. Failures also increment the error metric with `timeout`, `provider_error` or `invalid_response`.

Each failure emits a structured `grammar_check_failed` warning containing only the reason, safe detail, duration, text length and validated language hint. It never contains draft text, provider response text, credentials or tokens. The generic client error and sanitised operator signal can therefore be correlated without exposing private content.

## Privacy and caching

Grammar requests contain user-authored draft text. The endpoint therefore retains `Cache-Control: private, no-store`. The grammar service does not persist drafts, add a cache entry or log the submitted text. Draft text is sent only through the configured LLM proxy for the requested check.

Client-side drafts continue to use the existing `DraftService`. A suggested correction is saved back to that draft so a navigation or refresh does not silently restore the pre-correction text.

## Accessibility

Suggestions return to the existing editable composer. The translated explanation and second-submit instruction use the persistent polite toast live region. Send and Post are disabled while their grammar request is pending, and the Moments button's accessible name follows its visible translated label.

## Verification

Focused tests cover:

- DTO trimming, maximum length and language-tag validation;
- provider prompt hardening, JSON parsing, normalisation and fail-closed responses;
- controller authentication, free/VIP daily-limit routing and provider delegation;
- HTTP validation, authentication, rate limiting, no-store and sanitised failure behaviour;
- chat suggestion review, second-submit acceptance, duplicate suppression and degraded operation;
- Moments suggestion review, second-submit acceptance, degraded operation and media-only publishing.

Focused checks:

```bash
cd backend
npm test -- src/nlp/grammar-check.service.spec.ts src/nlp/nlp.controller.spec.ts src/nlp/grammar-check-pre-send.contract.spec.ts src/llm-proxy/llm-proxy.service.spec.ts
npm run test:e2e -- test/grammar-check.e2e-spec.ts

cd ../frontend
npm test -- --include src/app/services/grammar-review.spec.ts --include src/app/components/chat-room/chat-room.grammar-check.spec.ts --include src/app/components/moments-feed/moments-feed.grammar-check.spec.ts --include src/app/components/primitives/toast/toast.component.spec.ts
```

The normal repository backend and frontend test, type-check, lint and format jobs remain the release gate.

## Rollout and rollback

No database migration or data backfill is required. The API shape is unchanged, so backend and frontend can be deployed in either order. Monitor `429` and `503` responses, the grammar-check error ratio, failure reason and latency near the 10-second deadline.

Rollback is a code-only revert of the pull request. Existing chat messages, Moments and drafts do not require migration or repair because the feature does not change their stored schema or write APIs.
