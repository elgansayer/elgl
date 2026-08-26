# Message simplification

## Product contract

The chat message context menu exposes **Simplify this text** for text messages. Choosing it closes the context menu, opens an accessible dialog, and submits the exact trimmed message to `POST /nlp/simplify`. The original message remains visible while the simplified version is loading so learners can compare meaning without mutating chat history.

The operation is read-only. It never edits, replaces, republishes, or persists a simplified chat message. Closing the dialog aborts the browser request and stale responses are ignored if the selected message changes.

## API and authorization

`POST /nlp/simplify` is protected by `SupabaseAuthGuard` and the NLP rate limiter. The request body contains one `text` string. Leading and trailing whitespace is removed before validation; empty/whitespace-only input is rejected and source text is capped at 4,000 characters.

Free-tier daily AI limits and the route throttle remain authoritative on the server. The Angular client also enforces the 4,000-character limit before network I/O and validates that a successful response correlates to the requested source text. Simplified output is bounded client-side to 8,000 characters before rendering.

## AI safety and privacy

The backend prompt explicitly treats message text as untrusted data and JSON-encodes it rather than interpolating it as instructions. The model is instructed to preserve the original language and meaning while using shorter sentences and simpler vocabulary.

Message text and model output are not written to application storage by this feature. Model failures are logged without copying the private message content. Angular renders model output using text interpolation, never raw HTML.

## Failure behavior

The UI keeps the dialog open and presents retryable states for authentication failures, NLP rate limits, empty provider output, and generic request/provider failures. Duplicate requests are suppressed while one is in flight. Request cancellation and message changes invalidate outstanding responses.

If the LLM is unavailable, the backend may use the small deterministic local English simplification fallback. If neither the model nor the fallback can produce a useful change, the endpoint returns `503 Service Unavailable` rather than pretending the original text was simplified.

## Verification

Regression coverage spans:

- DTO trimming, whitespace rejection, type validation, and the 4,000-character boundary;
- authenticated client requests, cancellation, rate limits, source/result bounds, and response correlation;
- context-menu loading, errors, retry, duplicate suppression, stale-response handling, and HTML-as-text rendering;
- backend LLM prompt/fallback behavior in the existing NLP service suite.

Run the normal repository verification pipeline and the backend/frontend unit suites before merge.

## Rollout and rollback

No schema, migration, background job, or persisted-state change is required. The feature can roll out with the normal backend/frontend deployment. Rollback is code-only: revert this PR. Existing chat messages and user data are unaffected.
