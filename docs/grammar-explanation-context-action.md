# Corrected-text grammar explanations ("Explain this")

## Product flow

A corrected chat message (`message_type: 'correction'` with a `correction_payload`) offers an **Explain this** action in its message actions menu. The menu opens by long-press, right-click, or the keyboard-focusable "Open message actions" button that `LongPressContextMenuComponent` renders for every message.

The action is available only when the message is a correction and both the original and corrected strings are non-empty. It is never shown for plain text messages. Selecting it closes the menu and opens the **Grammar explanation** dialog, which shows the original and improved sentences and requests `POST /nlp/explain-grammar` through `NlpService` in the Angular client.

The backend produces the breakdown with the repository's `LlmProxyService`. The dialog states that the explanation is AI-generated and may contain mistakes.

### Wiring requirement (regression note)

The live room (`ChatRoomComponent`, routed at `chat/:id`) must forward `correction_payload.original` and `correction_payload.corrected` to `app-long-press-context-menu` as `correctionOriginal` and `correctionCorrected`. An earlier version only wired those inputs inside `ChatMessageComponent`, which is not routed, so the action was implemented but never reachable in the real chat room. `chat-room.explain-correction.spec.ts` renders the real room and fails if the bindings are removed.

### Dialog states

| State | What the user sees |
| --- | --- |
| Loading | "Explaining this correction..." inside a permanent `aria-live="polite"` region (`aria-busy` while loading) |
| Result | The plain-text explanation in the same live region, so assistive technology announces the change |
| Rate limited (`429`) | "You have made too many explanation requests. Please wait and try again." with Retry |
| Signed out (`401`/`403`) | "Sign in again to explain this correction." with Retry |
| Empty response | "No explanation was returned. Please try again." with Retry |
| Unavailable or network failure (`503`, `400`, offline) | "This correction could not be explained. Check your connection and try again." with Retry |

Errors use `role="alert"` and text, never colour alone. The original, improved and explanation text use `dir="auto"` so a right-to-left sentence renders correctly in a left-to-right interface and vice versa. Model output is rendered as text, never as HTML. A superseded or closed request is aborted, and a stale response for a different message is ignored.

## Backend contract

`POST /nlp/explain-grammar`

Request:

```json
{
  "original": "I go shop yesterday.",
  "corrected": "I went to the shop yesterday."
}
```

Successful response (HTTP 201, `Cache-Control: private, no-store`):

```json
{
  "original": "I go shop yesterday.",
  "corrected": "I went to the shop yesterday.",
  "explanation": "Use the past tense because yesterday places the action in the past. Add the article before shop."
}
```

Both input strings are required to contain non-whitespace text and are limited to 4,000 characters; unknown properties are rejected by the global `ValidationPipe`. Provider output is limited to 2,500 characters. The endpoint is authenticated and limited to 10 requests a minute per user by `NlpRateLimiterGuard` (Redis), with a matching per-client throttler limit as defence in depth. It consumes the existing free-tier daily AI allowance (the allowance is checked before the provider is called). VIP behaviour is unchanged.

`NlpService` no longer contains an `explainGrammar` method. An earlier unreachable duplicate sent an English instruction prompt to the DeepL translation endpoint; translating a prompt is not grammar reasoning, it interpolated user text into the prompt, and it echoed provider error bodies. `GrammarExplanationService` is the only implementation.

## Prompt and privacy boundary

The original and corrected sentences are private user content. They are sent only to the configured LLM provider when the user explicitly requests an explanation. They are encoded in a user-role JSON payload, while the system message treats them as untrusted data and forbids following embedded instructions. User text is never interpolated into the trusted instructions.

Nothing is persisted: the backend stores no sentences or explanations and does not cache them, so there is no retention or deletion work. Retention at the LLM provider is governed by the provider configured through `LLM_API_URL`.

## Failure behaviour

| Cause | Category (`reason`) | HTTP response |
| --- | --- | --- |
| Provider rejects, errors, or is unreachable | `provider_error` | 503 |
| No response within 10 seconds | `timeout` | 503 |
| Blank or oversized (over 2,500 characters) output | `invalid_response` | 503 |

Every failure returns the stable message `Grammar explanation is temporarily unavailable`; fabricated explanations are never returned. Authentication and rate-limit failures keep the typed `NlpRequestError` path in the client.

The 10-second deadline aborts the in-flight provider request through the `AbortSignal` accepted by `LlmProxyService.chatCompletion`, so a timed-out call is cancelled rather than left running (and billed) in the background. The deadline is also enforced if a provider ignores the signal.

## Observability

Metrics reuse the shared NLP/AI family in `MetricsService` with `endpoint="explain-grammar"`:

- `hellotalk_reading_engine_ai_requests_total{endpoint,status}`: `200` on success, `503` on failure.
- `hellotalk_reading_engine_ai_request_duration_seconds{endpoint}`: provider latency for successes and failures.
- `hellotalk_reading_engine_ai_errors_total{endpoint,error_type}`: `timeout`, `provider_error`, or `invalid_response`.

Requests rejected before the service runs (authentication, the per-minute guard, or the daily allowance check) are not counted by these metrics; the per-minute guard writes its own warning when it rejects a request.

Each failure also writes one structured `warn` log line (pino) with `event: "grammar_explanation_failed"`, `reason`, `userId`, `latencyMs` and, when the provider call threw, `providerErrorName` (the exception class only). pino-http adds the route and timestamp, so support can match a user report to a line without database access. The line never contains the sentences, the provider message, or credentials. Suggested alerts: a sustained `503` ratio, and p95 latency approaching the 10-second deadline.

## Accessibility

- The menu is reachable from the keyboard through the "Open message actions" button (visible on focus) as well as by pointer or long-press.
- The explanation uses the shared Spartan dialog primitive: titled and described, Escape and backdrop close, focus managed by Brain.
- Loading and results are announced through one permanent polite live region; errors use `role="alert"`.
- The footer buttons stack on narrow screens, and no state relies on colour alone.

## Verification

Backend (Vitest):

- `grammar-explanation.service.spec.ts`: trimming and mapping, prompt-injection isolation, cancellable signal, deadline abort (including a provider that never settles), no leftover timer, provider rejection, blank and oversized output, exact-limit output, metrics, and proof that logs contain no sentence or provider text.
- `dto/explain-grammar.dto.spec.ts`: missing, empty, whitespace-only, non-string, over-limit, boundary, and unknown properties.
- `nlp.controller.explain-grammar.spec.ts`: quota-before-provider ordering, VIP semantics, unauthenticated short-circuit, and the HTTP boundary (route, guards, rate-limit metadata, DTO binding, `private, no-store`).
- `test/app.e2e-spec.ts`: the real controller and `GrammarExplanationService` route through `AppModule`, covering both success and the provider-failure 503 path while proving that the service's production dependencies resolve in the full module graph.
- `common/logger/logger.module.spec.ts`: the `GrammarExplanationService` logger context stays registered.

Frontend (Vitest through `ng test`):

- `chat-room.explain-correction.spec.ts`: the live room forwards the correction pair, offers **Explain this** only on corrections, and shows the AI breakdown end to end.
- `long-press-context-menu.component.spec.ts`: label, visibility rules, each error kind, live region continuity, `dir="auto"`, Retry recovery, Close, stale-response handling, abort on destroy, and text-only rendering of model output.
- `nlp.service.spec.ts`: request shape, authentication, blank and over-length input rejected before any network call, HTTP status to error-kind mapping (`400`, `401`, `403`, `429`, `500`, `503`), and response validation.

## Rollout and rollback

There is no schema migration or persisted-data change, and no new configuration. Deploy the backend and frontend normally; the request and response shapes are unchanged, so older clients keep working and the new client works against the previous backend. The new logger context is registered in `SharedLoggerModule` in the same release.

To roll back, revert this change. No data cleanup is required. A rollback must not restore the old DeepL prompt-translation implementation as a purported grammar explanation; if the configured LLM provider is unavailable the endpoint should continue to fail explicitly rather than synthesise a misleading result.

## Known limitations and follow-ups

- The explanation language follows the model's default rather than the user's interface language. An optional locale hint on the request is a possible follow-up.
- A failed provider call still consumes one free-tier daily allowance slot, as for the other NLP endpoints. A shared refund-on-failure policy would be a separate change across all AI endpoints.
- Identical correction pairs are not deduplicated or cached server-side, to avoid retaining private text.
- The signed-out error has no sign-in shortcut; it matches the Simplify dialog.
