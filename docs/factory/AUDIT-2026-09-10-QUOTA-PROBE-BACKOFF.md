# Factory allowance audit: repeated quota probes

Date: 2026-09-10

## Scope

This pass re-audited provider routing and reasoning selection, retry and failover behavior,
duplicate-work controls, prompt/context limits, CI and independent-review loops,
concurrency/admission policy, GitHub Actions interaction, stalled-task recovery, and the
provider circuit breaker. The architectural constraints remain unchanged: the Factory must
recover autonomously, must not require human triage or quarantine, and must preserve local
verification, security review, independent review, reviewed-SHA protection, and required
merge checks.

## Finding

The provider circuit breaker persisted `consecutive_failures`, but quota failures reset that
counter to the configured failure threshold every time. A subscription that remained quota
exhausted therefore received another half-open probe at the same fixed cadence forever.
That is useful for a transient first failure but wasteful once repeated probes have already
proved that the subscription is still exhausted.

The live Factory evidence that motivated the separate cooldown-floor change in #8893 also
shows why a bounded repeated-probe policy is useful: OpenCode recorded 219 quota failures in
221 calls, while Pi recorded 242 quota failures and no successes. #8893 lengthens the first
production quota cooldown; this change is complementary and does not depend on that PR. It
reduces repeated probes only after a half-open quota probe fails again.

A review of the first implementation found an important integration detail: the router keeps
the breaker's generic default at five minutes and supplies the failure-specific quota floor
through `retry_after_seconds`. Multiplying only `cooldown_seconds` would therefore have left a
one-hour production quota floor at one hour forever because the 1x/2x/4x generic values
(5/10/20 minutes) never exceeded that floor. The corrected implementation backs off from the
**effective** floor, so the policy works in the real router rather than only in isolated unit
tests.

## Change

Quota failures now retain a restart-safe streak and apply bounded exponential growth to the
effective cooldown:

- first quota failure: 1x effective quota floor;
- second consecutive quota failure: 2x;
- third and later consecutive quota failures: 4x maximum.

The effective floor is the larger of the generic breaker cooldown and the current retry-after
floor. Production uses that retry-after field for the configured failure-specific cooldown,
so current `main` follows 1h -> 2h -> 4h. If #8893's six-hour production quota floor lands
independently, the same policy becomes 6h -> 12h -> 24h. The multiplier remains bounded and
the absolute circuit delay remains capped by the existing seven-day retry-after ceiling, so a
provider is never permanently abandoned.

A provider-reported longer retry interval remains authoritative as the starting floor. If the
provider is still quota-exhausted when that longer interval expires, the failed half-open
probe backs off from that effective floor as well. This is intentional: the new evidence is
that waiting the provider's own interval was still insufficient. Any successful provider call
immediately clears the failure streak and returns the next quota event to the normal 1x
cooldown. Authentication, rate-limit, transport, timeout, crash, invalid-output, and
generic-unavailable cooldown behavior is unchanged.

## Autonomy and engineering-quality invariants

The provider remains enabled and is automatically half-opened again after the bounded
cooldown. Other healthy providers remain available through the existing routing/failover
policy while one subscription is cooling down. The existing restart-safe half-open probe
lease remains unchanged, so a daemon crash cannot strand a provider indefinitely.

This change does not alter provider ordering, model choice, reasoning effort, prompts,
verification, security review, independent review, reviewed-head protection, mergeability
checks, or `CI / required`. It introduces no manual release state, quarantine, or human
interaction.

## Verification

Focused regression coverage proves that:

- repeated quota failures grow 1x -> 2x -> 4x and remain bounded at 4x;
- the real production-style failure-specific floor is scaled, even when the generic breaker
  default is lower;
- a successful call resets the quota backoff immediately;
- a longer retry floor is respected first and then scaled only after another failed probe;
- non-quota failures do not inherit this exponential policy;
- the quota streak survives `AgentHealthStore` persistence and restart.

The canonical Factory CI on the exact pull-request head remains authoritative for Ruff
formatting, Ruff lint, mypy, the complete Factory pytest suite, repository governance, and
`CI / required`.
