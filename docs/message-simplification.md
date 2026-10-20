# Message simplification

## Scope

The **Simplify this text** action helps a learner understand a complex text chat message without changing or sending the original message. It is a presentation-only language-learning aid: selecting the action opens a separate Spartan dialog containing the source message and a simpler rewrite.

This document records the production contract for issue #1676 and the verification boundary that prevents the feature from silently disappearing or weakening.

## User flow

1. Open the context menu for a text message by the existing long-press, context-menu, or keyboard-accessible action.
2. Choose **Simplify this text**.
3. The context menu closes and a named Spartan dialog opens immediately.
4. The original message remains visible while the simplification request is pending.
5. A successful response is rendered as plain text. The original chat message is never replaced or mutated.
6. Authentication, rate-limit, empty-result, and request failures remain in the dialog with a Retry action.
7. Closing the dialog cancels the in-flight request and stale responses are ignored.

Non-text messages do not expose the Simplify action.

## API and authorization contract

The Angular `NlpService` sends `POST /api/nlp/simplify` with `{ text }` and the current Supabase Bearer token. Browser caching is disabled for the request.

The NestJS `POST /nlp/simplify` route is protected by `SupabaseAuthGuard` and `NlpRateLimiterGuard`, has a 10 requests/minute endpoint throttle, uses the NLP rate-limit policy, and emits `Cache-Control: private, no-store` through the shared cache interceptor.

Source text is trimmed, required, and capped at 4,000 characters on both the Angular and NestJS boundaries. The Angular client also rejects malformed responses, a response whose `original` value does not match the requested source, and unexpectedly large simplified output.

## AI and failure behavior

`NlpService.simplify()` consumes the normal daily AI allowance for free users and uses the existing VIP quota bypass. The prompt explicitly treats message content as untrusted data and JSON-encodes the source text before it is sent through the shared LLM proxy.

If the LLM provider fails or returns no useful change, the backend may apply the bounded local vocabulary simplifier. If neither path can produce a useful simplification, the API returns a service-unavailable error. It must not claim that the original text is a successful simplification.

Diagnostics use fixed messages only. Message text, user identifiers, credentials, tokens, and provider payloads must not be written to logs.

## Security and privacy

- The feature is authenticated and inherits the existing NLP quota and abuse controls.
- Message content is sent only when the learner explicitly invokes Simplify.
- Simplifications are not persisted by this feature and are not written to browser storage.
- Provider output is rendered through Angular text interpolation, never as trusted HTML.
- The source message is treated as untrusted prompt data rather than as model instructions.

## Accessibility and interaction

The context-menu action and dialog controls use Spartan Helm buttons with the repository touch-target contract. The result dialog has a semantic dialog title, pending content uses a polite status announcement, and failures use an alert. Retry and Close remain keyboard-operable native button interactions. The existing Relay surfaces support light/dark themes, RTL-safe layout, and high-zoom reflow without a separate simplification-specific visual system.

## Verification

Run the cross-layer contract without installing project dependencies:

```bash
node --test scripts/verify-simplify-text-contract.test.mjs
```

The contract verifies:

- the text-only context-menu action and named result dialog;
- authenticated, bounded, no-store Angular requests and response validation;
- NestJS authentication, throttling, private caching, and DTO validation;
- daily quota enforcement, prompt-injection boundary, local fallback, and honest unavailability;
- regression coverage for exact source text, duplicate requests, stale responses, typed failures, and text-safe rendering.

The normal repository CI remains authoritative for Angular unit/static-analysis/build, backend unit/lint/build/E2E, dependency review, translation safety, and design-system governance.

## Rollout and rollback

This completion adds verification and documentation only because the production Simplify flow is already present on `main`. There is no schema, route, persisted-data, or provider migration.

Rollback is a normal revert of the verification commit. Do not remove or weaken the authenticated `/nlp/simplify` boundary, the explicit no-store policy, stale-response cancellation, or plain-text rendering as part of a rollback.
