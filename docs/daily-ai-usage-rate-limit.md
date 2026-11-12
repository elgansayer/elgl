# Daily AI usage limit

Issues #1340 and #1888 are implemented by `NlpService.checkRateLimit()` and are shared by the AI-backed NLP actions that call the service before provider work.

## Contract

Free-tier users may make 10 AI-backed requests per UTC calendar day. Usage is stored in Redis under:

```text
daily_ai_usage:{user_id}:{YYYY-MM-DD}
```

One Redis Lua operation checks and increments the counter atomically, so concurrent requests cannot admit more than the allowance. The first request creates the counter and gives it a 24-hour expiry. The script also repairs a missing expiry on an existing counter. Because the UTC date is part of the key, a new daily quota starts automatically when the UTC date changes even if the prior key has not expired yet.

The tenth request is allowed. A request made after the stored count has reached 10 is rejected with HTTP 429 and does not invoke the external AI provider. The response points users at the established VIP price of 8 UKP / $10 USD per month. VIP users bypass this free-tier counter and do not touch Redis.

## Failure and privacy boundaries

Redis is the authoritative quota store for free-tier AI usage. If Redis cannot be read, the request fails rather than bypassing quota enforcement. The key contains only the internal user identifier and UTC date; prompt text, translations, grammar content, audio data, and provider responses are not stored in the rate-limit key.

Quota denials, Redis failures, and invalid Redis responses emit structured logs with the UTC date and a truncated SHA-256 user reference. Logs never include the raw user identifier, Redis key, prompt, or provider response.

Provider-specific throttling and the application's general HTTP throttles remain separate concerns. This daily counter protects product-plan usage and must remain in the service boundary even when provider routing changes.

## Verification

Run the focused regression suite from the backend package:

```bash
npm test -- --run src/nlp/daily-ai-usage-rate-limit.contract.spec.ts
```

The contract covers:

- user/date-scoped Redis keys;
- first-request counter creation and expiry;
- admitting exactly 10 concurrent requests and rejecting the next one;
- rejecting over-limit requests with HTTP 429 and the VIP upgrade price;
- VIP bypass without Redis quota consumption;
- fail-closed behavior when the Redis quota store is unavailable.

Canonical pull-request CI also runs the complete backend unit, lint, build, and E2E suites.

## Rollout and rollback

This completion change makes quota admission atomic and adds regression coverage around the existing rate-limit implementation. It does not alter persisted user data, API response shapes below the existing 429 contract, Redis key naming, or VIP entitlement behavior. No schema migration is required because Redis counters remain ephemeral and expire automatically.

Rollback is a normal revert to the prior non-atomic Redis counter implementation. The rate-limit itself must not be removed because doing so would make free-tier AI usage unbounded.
