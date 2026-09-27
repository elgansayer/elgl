# Pre-send grammar review

Issues #979, #1343 and #1698 all describe this one capability: an advisory grammar check before a text chat message or a text Moment is sent. This document is the single source of truth for it. Extend the implementation described here rather than adding a second grammar-check path.

## User flow

For text content, the client calls `POST /nlp/grammar-check` before the existing send or publish mutation. The checker never sends a chat message or creates a Moment itself: the existing chat and Moments APIs remain the only write paths.

| Outcome of the check | What the learner sees | What is sent |
| --- | --- | --- |
| No change suggested | Nothing extra | The original text, immediately |
| Change suggested | The composer now holds the suggestion and a toast explains it | Nothing yet |
| Check unavailable, rate limited or failed | Nothing extra | The original text, immediately |
| Media-only Moment | No check is made | The Moment, immediately |

### Review rules

A suggestion is remembered as a review of two wordings: the learner's original and the suggested text.

1. The suggestion replaces the composer text and a translated toast shows the provider's explanation for eight seconds (`GRAMMAR_REVIEW_TOAST_MS`). Nothing is sent.
2. Submitting again sends the suggested wording without a second provider call. "Submit again to accept" is therefore exact: it cannot loop on a provider that rewords its own suggestion, and it does not spend a second daily AI request.
3. Restoring the original wording and submitting sends the original. This is how a learner keeps their own wording on purpose, for example when quoting a mistake to a language partner.
4. Editing the text into any other wording triggers a fresh check.
5. The review is dropped after a successful send or publish, when the chat room changes, and when the Moment target language changes (the language hint changes what the checker would say). A failed send keeps the review so a retry still sends the reviewed wording.
6. If the learner keeps typing while a check is in flight, their newer wording wins: the suggestion is not applied and the superseded text is not sent.

The shared decision logic lives in `frontend/src/app/services/grammar-review.ts` and is used by both surfaces.

### Chat

- The Send control is disabled while a check runs and duplicate submissions are ignored.
- The composer text is a plain field in a zoneless component, so the component flags the view for change detection after applying a suggestion. Without that the composer keeps showing the old text.
- Failed sends keep the draft (`DraftService`), as before.

### Moments

- Post is disabled while a check or publish is running, and `submitMoment` ignores a second call while one is in flight.
- The composer closes only after the Moment is published. A suggestion or a failed publish leaves the composer open so the draft can be reviewed, edited and retried. Previously the click handler closed the composer immediately, hiding the suggestion.
- The Post button is named by its visible label, so assistive technology hears "Post moment" or "Posting..." to match what is shown.

## API contract

`POST /nlp/grammar-check` is authenticated by `SupabaseAuthGuard` and protected by both the endpoint throttle and the NLP rate-limiter guard.

Request:

```json
{
  "text": "I go to school yesterday.",
  "language": "en-GB"
}
```

`text` is trimmed, required and limited to 2,000 characters. `language` is optional, limited to 35 characters and accepts a BCP 47-style language tag such as `en`, `en-GB` or `zh-Hans`. Unknown properties are rejected.

Successful response (`201`):

```json
{
  "original": "I go to school yesterday.",
  "corrected": "I went to school yesterday.",
  "explanation": "Use the past tense.",
  "errors_found": 1
}
```

The server derives `original` from the validated request rather than trusting provider output. Changed text is normalised to at least one error and unchanged text to zero errors.

| Status | Meaning |
| --- | --- |
| `400` | Validation failed: missing, blank or over-long text, malformed language tag, or an unknown property |
| `401` | Missing, invalid or expired token |
| `429` | The per-minute NLP limit (20 requests per user) or the free-tier daily AI limit was reached; the provider is not called |
| `503` | The grammar provider failed, timed out or returned an unusable reply: `Grammar checking is temporarily unavailable` |

The frontend treats every failure, including `429`, as "no suggestion". Grammar checking is advisory, so an outage or spent quota never prevents communication.

## Provider and failure behaviour

The route uses the configured `LlmProxyService`, so deployment continues to use `LLM_API_URL`, `LLM_API_KEY` and `LLM_MODEL`. Azure Translator dictionary lookup is not a grammar-checking provider and is not used. The former unrouted `NlpService.grammarCheck` implementation has been removed: `GrammarCheckService` is the only implementation behind the route.

- **Prompt isolation.** Instructions are sent as the system message. The learner's text and language hint are sent only inside a JSON user message and are described to the model as untrusted data, never instructions.
- **Bounded output.** The reply must be a single JSON object. It is parsed and bounded (corrected text up to 4,000 characters, explanation up to 1,500, at most 50 reported errors) before reaching clients. Fenced JSON is accepted; anything else fails closed.
- **Output budget.** The completion token limit is `min(4000, 500 + 2 x characters)`. The previous fixed limit of 500 tokens truncated the JSON for long or CJK text, which then failed closed even though the input was valid. The configured model must allow 4,000 output tokens for the longest inputs.
- **Deadline.** A provider call is bounded to 10 seconds. When the deadline passes the upstream HTTP request is aborted (not left running) and the caller is released even if the provider ignores the abort signal.
- **Fail closed.** Empty, malformed, oversized or timed-out results return `503` with the generic message above. Provider details and user text are never copied into the public error.
- **HTTP failures.** Non-success provider responses are rejected before their bodies are parsed, even if a proxy or provider returns a completion-shaped error body.
- **Quota.** The existing daily free-tier AI usage policy is applied before the provider call. VIP profiles keep the existing exemption.

## Observability

The client only ever receives a generic `503`, so the server-side signals are how operators diagnose failures.

**Log line.** Every failure emits one `warn` line, `Grammar check provider failed`, through the request-scoped pino logger with these fields:

| Field | Value |
| --- | --- |
| `event` | `grammar_check_failed` |
| `reason` | `timeout`, `provider_error` or `invalid_response` |
| `detail` | The provider error class name, or the response defect: `empty`, `not_json`, `schema`, `oversized` |
| `durationMs` | Time spent before failing |
| `textLength` | Length of the submitted text, in characters |
| `language` | The validated language tag, or `auto-detect` |

The line never contains the submitted text, the provider's error message or credentials, and successful checks are not logged. The request logger adds the method and URL, and the HTTP access log line for the same request carries the `503` status and response time, so a learner's report at a given time can be matched to its cause without database access.

`LlmProviderHttpError` means the provider returned a non-success HTTP status. The status is retained in the internal exception for diagnostics but is not returned to the client or written to the grammar-check log; check provider credentials and quota first.

**Metrics** (Prometheus, scraped from `/api/metrics`), all with `endpoint="grammar-check"`:

| Metric | Additional labels | Use |
| --- | --- | --- |
| `hellotalk_reading_engine_ai_requests_total` | `status` (`success` or `error`) | Volume and error ratio |
| `hellotalk_reading_engine_ai_request_duration_seconds` | none | Latency histogram, including failures |
| `hellotalk_reading_engine_ai_errors_total` | `error_type` (same values as `reason`) | Failure breakdown |

Suggested alert expressions (add them to your Prometheus rules, no rule file is shipped):

- Error ratio: `sum(rate(hellotalk_reading_engine_ai_requests_total{endpoint="grammar-check",status="error"}[10m])) / sum(rate(hellotalk_reading_engine_ai_requests_total{endpoint="grammar-check"}[10m])) > 0.2` for 10 minutes.
- Latency near the deadline: `histogram_quantile(0.95, sum by (le) (rate(hellotalk_reading_engine_ai_request_duration_seconds_bucket{endpoint="grammar-check"}[10m]))) > 8`.
- Unusual volume: compare the request rate with the same time on the previous days.

The `SharedLoggerModule` context list includes `GrammarCheckService`, which is required for the contextual logger to resolve.

## Privacy and caching

Grammar requests contain user-authored draft text. The endpoint retains `Cache-Control: private, no-store`. The grammar service does not persist drafts, add a cache entry or log the submitted text. Draft text is sent only through the configured LLM proxy for the requested check. Nothing new is persisted, so there is no retention or deletion behaviour to define.

Client-side drafts continue to use the existing `DraftService`. A suggested correction is saved back to that draft so a navigation or refresh does not silently restore the pre-correction text.

## Accessibility

- The suggestion is returned to the existing editable composer, so keyboard, screen-reader and high-zoom users inspect and alter it with the controls they already use.
- The toast region is a persistent polite live region (`role="status"`, `aria-live="polite"`, `aria-atomic="false"`), so the explanation and the instruction to send again are announced. It stays for eight seconds rather than the default three.
- Busy state is exposed through the disabled Send and Post controls and the "Posting..." label, not by colour alone.
- All wording is a translation key (`grammarReview.suggestionApplied`). The provider explanation is generated text and is passed in as a parameter.

## Verification

Backend (`cd backend`):

- `src/nlp/grammar-check.service.spec.ts`: prompt isolation, output budget, deadline and abort, failure classification, metrics and log sanitisation.
- `src/llm-proxy/llm-proxy.service.spec.ts`: token budget and abort signal pass-through with unchanged defaults.
- `src/nlp/nlp.controller.spec.ts` and `src/nlp/grammar-check-pre-send.contract.spec.ts`: wiring, single implementation and the cross-layer contract.
- `src/common/logger/logger.module.spec.ts`: the contextual logger is exported.
- `test/grammar-check.e2e-spec.ts`: the mapped route over HTTP with the production `SupabaseAuthGuard`, `NlpRateLimiterGuard`, `GrammarCheckService` and validation pipe settings. Only the external provider boundary is replaced with deterministic responses, covering `201`, `400`, `401`, `429`, `503`, no-store, and no leakage of text or provider errors.

```bash
cd backend
npm test -- src/nlp src/llm-proxy src/common/logger
npm run test:e2e -- test/grammar-check.e2e-spec.ts
```

Frontend (`cd frontend`):

- `src/app/services/grammar-review.spec.ts`: the review decision.
- `src/app/components/chat-room/chat-room.grammar-check.spec.ts` and `chat-room.component.spec.ts`: review rules, edit during a check, toast, room change, and the rendered composer and Send bindings.
- `src/app/components/moments-feed/moments-feed.grammar-check.spec.ts`: review rules, composer open and close, retry, re-entrancy and the template contract.
- `src/app/components/primitives/toast/toast.component.spec.ts`: the live region.

```bash
cd frontend
npx ng test --no-watch --include 'src/app/services/grammar-review.spec.ts' \
  --include 'src/app/components/chat-room/**/*.spec.ts' \
  --include 'src/app/components/moments-feed/**/*.spec.ts' \
  --include 'src/app/components/primitives/toast/*.spec.ts'
```

Browser flows: `e2e/tests/chat-messaging.spec.ts` and `e2e/tests/moment-creation.spec.ts` (Playwright) cover the suggestion, second submit and failed-publish retry; `frontend/cypress/e2e/chat-flow.cy.ts` and `moments-flow.cy.ts` cover the unchanged-text path.

The normal backend and frontend test, type-check, lint and build jobs remain the release gate.

## Rollout and rollback

No database migration or data backfill is required and the API contract is unchanged, so the backend and frontend can be deployed in either order. After deploying, watch the error ratio, the latency histogram against the 10 second deadline, and the `reason` breakdown. Confirm the configured `LLM_MODEL` accepts a 4,000 token completion limit.

Rollback is a code-only revert of the pull request. Existing chat messages, Moments and drafts do not need repair because the feature does not change their stored schema or write APIs.

## Known limits

- The free-tier daily quota is consumed before the provider call, so a failed provider call still counts against it. Changing that is a quota-policy decision (see `docs/daily-ai-usage-rate-limit.md`).
- `GrammarExplanationService` (`POST /nlp/explain-grammar`) still bounds its provider call with a race that does not abort the upstream request.
- The backend has no `I18nService`, so its two fallback explanations (`Grammar suggestions are available.` and `No grammar changes suggested.`) are English literals, as are its exception messages.
