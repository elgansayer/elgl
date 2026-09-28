# AI grammar checker pre-send contract

Issue #1343 is implemented through the existing authenticated NLP endpoint plus the Chat and Moments composer flows. This document records the product boundary so future migrations do not split the grammar-review behavior across competing services.

## Product behavior

`POST /nlp/grammar-check` is the single backend grammar-check boundary. It accepts trimmed text plus an optional BCP 47-style language tag and returns the typed grammar result used by the frontend.

For text chat messages, the composer requests a grammar check before calling the chat send API. When the provider returns a changed sentence, the composer replaces the draft with the suggestion and stops the first submission so the learner can review the change. Submitting the accepted text again sends the message normally. A second submission while a check is already pending is ignored.

Moments use the same review model. Text posts are checked before publication, a changed sentence is written back into the draft for review, and media-only Moments skip the grammar provider entirely.

The checker is advisory. When the existing frontend degradation path returns the original text without a suggestion, learners can still send or publish their wording rather than losing access to chat or Moments because an AI provider is unavailable.

## Security and abuse boundaries

The controller is protected by `SupabaseAuthGuard` and `NlpRateLimiterGuard`. The endpoint also has a 20 requests/minute throttle and uses the existing daily AI usage policy before invoking the grammar provider. Free-tier and VIP quota behavior therefore stays centralized instead of being reimplemented in either composer.

Grammar requests are explicitly `private, no-store` through the shared cache-control interceptor. Text is bounded to 2,000 characters, the optional language tag is bounded and validated, and provider access remains server-side. Client code must not log grammar request text, authentication tokens, or provider credentials as part of new observability.

No schema or persistence migration is required. Suggested text remains ordinary user draft state until the learner submits it through the existing chat or Moments persistence path.

## Accessibility and UX

Grammar review must not silently transmit a provider suggestion. A changed sentence is returned to the existing editable composer so keyboard, screen-reader and high-zoom users can inspect and alter it using the same controls they already use for ordinary drafting. The existing draft services preserve the suggested text where those surfaces already support draft recovery.

Provider unavailability is not represented as a successful correction. The current advisory degradation contract keeps the original user text and permits submission without manufacturing a correction result.

## Verification

The cross-layer contract is covered by:

- `backend/src/nlp/grammar-check-pre-send.contract.spec.ts`
- `backend/src/nlp/nlp.controller.spec.ts`
- `backend/src/nlp/grammar-check.service.spec.ts`
- `frontend/src/app/components/chat-room/chat-room.grammar-check.spec.ts`
- `frontend/src/app/components/moments-feed/moments-feed.grammar-check.spec.ts`

Recommended focused backend command:

```bash
cd backend
npm test -- src/nlp/grammar-check-pre-send.contract.spec.ts src/nlp/nlp.controller.spec.ts src/nlp/grammar-check.service.spec.ts
```

The normal frontend unit, static-analysis and production-build jobs remain authoritative for the composer integrations.

## Rollout and rollback

This completion adds regression coverage and documentation around behavior already deployed on `main`; it does not change the API shape, provider selection, persistence schema, quota policy or UI layout. Rollback is therefore a normal code revert of the contract test/documentation only.

If the grammar provider or quota policy changes later, preserve the authenticated `/nlp/grammar-check` boundary and the explicit learner-review step unless a separately approved product change replaces this contract.
