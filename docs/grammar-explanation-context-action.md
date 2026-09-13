# Corrected-text grammar explanations

## Product flow

Corrected chat text already exposes the correction-only action in `LongPressContextMenuComponent`. The action is available only when the message is a correction and both the original and corrected strings are non-empty. Selecting it opens the existing accessible dialog, shows the original/corrected pair, and requests `POST /nlp/explain-grammar` through `NlpService` in the Angular client.

The endpoint now produces an actual AI grammar breakdown through the repository's `LlmProxyService`. The previous implementation sent an English instruction prompt to the DeepL translation endpoint; translating a prompt is not grammar reasoning and could return the prompt itself instead of an explanation.

## Backend contract

`POST /nlp/explain-grammar`

Request:

```json
{
  "original": "I go shop yesterday.",
  "corrected": "I went to the shop yesterday."
}
```

Successful response:

```json
{
  "original": "I go shop yesterday.",
  "corrected": "I went to the shop yesterday.",
  "explanation": "Use the past tense because yesterday places the action in the past. Add the article before shop."
}
```

Both input strings are required to contain non-whitespace text and are limited to 4,000 characters. Provider output is limited to 2,500 characters. The endpoint remains authenticated, private/no-store, subject to the existing per-minute NLP guard, and consumes the existing free-tier daily AI allowance. VIP behavior remains unchanged.

## Prompt and privacy boundary

The original and corrected sentences are private user content. They are sent only to the configured LLM provider when the user explicitly requests an explanation. They are encoded in a user-role JSON payload, while the system message explicitly treats them as untrusted data and forbids following embedded instructions. This limits prompt-injection opportunities and avoids interpolating user text into trusted instructions.

Provider failures are logged only as a generic failure category. User sentences, provider response bodies, credentials, and provider error messages are not written to application logs.

## Failure behavior

The client keeps its existing loading state, aborts superseded requests, and allows retry from the explanation dialog. Authentication and request-rate failures retain the typed `NlpRequestError` path. Provider failures, timeouts, blank responses, and oversized responses fail closed as HTTP 503 with the stable message `Grammar explanation is temporarily unavailable`; fabricated explanations are never returned.

The provider boundary has a 10-second response deadline. The HTTP response remains `Cache-Control: private, no-store`, so explanations are not cached by shared or browser HTTP caches.

## Accessibility

The existing correction action is keyboard reachable through the context-menu trigger as well as pointer/long-press access. The explanation uses the shared Spartan dialog primitive, includes original/corrected labels, announces loading/result state, supports Escape/backdrop close, and reflows at narrow widths/high zoom. No state is communicated by colour alone.

## Verification

Focused backend tests cover:

- real LLM response trimming and response mapping;
- separation of trusted system instructions from untrusted correction text;
- prompt-injection-shaped input;
- provider rejection;
- blank provider output;
- oversized provider output; and
- failure responses that do not expose private text or provider details.

Repository CI remains authoritative for backend unit/lint/build/E2E and frontend regression coverage of the existing correction context-menu/dialog flow.

## Rollout and rollback

There is no schema migration or persisted-data change. Deploy the backend normally; existing clients continue using the same `/nlp/explain-grammar` request/response shape.

To roll back, revert this change. No data cleanup is required. A rollback should not restore the old DeepL prompt-translation implementation as a purported grammar explanation; if the configured LLM provider is unavailable, the endpoint should continue to fail explicitly rather than synthesize a misleading result.
