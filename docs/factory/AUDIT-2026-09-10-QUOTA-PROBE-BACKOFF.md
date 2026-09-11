# Factory allowance audit: subscription failure backoff

Date: 2026-09-11

## Scope

This pass re-audited current provider routing, retries, failover, health/circuit behavior,
concurrency/admission, prompt/output telemetry, CI/review loops, recovery scheduling, GitHub
Actions, and the live Factory control panel. The safety contract is unchanged: autonomous
recovery, deterministic verification, security review, independent exact-head review,
reviewed-SHA protection, mergeability, and required CI remain mandatory.

## Live evidence

The live control panel still has a very large runnable queue and cumulative provider failures
are dominated by persistent subscription/provider conditions rather than useful engineering
work. In particular, OpenCode has recorded 219 quota failures in 221 calls, Pi has recorded
242 quota failures with no successes, Codex has recorded 2,127 transport failures plus 256
rate-limit and 139 authentication failures, and Claude has recorded 344 transport plus 172
quota failures. These cumulative counters justify reducing repeated outage discovery; they are
not a claim about a precise token-saving percentage.

The Factory already opens provider circuits on the first qualifying production failure and
performs zero immediate same-provider retries. The remaining waste was how soon a known-bad
subscription became eligible for another probe, and how repeated quota failures were treated
as if each one were the first failure.

## Changes

### Conservative first-failure cooldowns

Production cooldown floors now match the persistence of the observed failure classes:

- transport: 5 minutes -> 30 minutes;
- rate limit: 15 minutes -> 60 minutes;
- quota: 60 minutes -> 6 hours;
- authentication: 15 minutes -> 6 hours.

Provider-supplied longer retry intervals remain authoritative. Generic unavailability,
timeouts, crashes, and invalid output keep their shorter existing cooldowns so transient
infrastructure/task-specific failures can recover quickly.

Before other admission gates, those changes reduce the maximum expiry opportunities for a
continuously failing route by 83.3%, 75%, 83.3%, and 95.8% respectively. They do not reduce
productive issue admission, healthy-provider concurrency, provider diversity, or reasoning
quality.

### Bounded repeated quota backoff

Quota failures retain a restart-safe streak and scale the **effective** cooldown floor 1x ->
2x -> 4x. With the consolidated six-hour production quota floor, a continuously exhausted
subscription follows 6h -> 12h -> 24h and remains bounded there, reducing steady-state
recovery opportunities from four per day to one per day (75%) once the bound is reached.
The absolute retry interval remains capped by the existing seven-day safety ceiling.

A stronger provider-supplied quota retry floor is preserved across the unresolved quota
streak instead of being replaced by a shorter local floor. A successful real provider
operation resets the streak immediately.

### Half-open recovery ownership

A shallow CLI/auth health probe does not prove that quota/rate allowance has recovered, so it
no longer closes a half-open circuit. The half-open lease remains authoritative until the
actual routed provider operation records success/failure; concurrent routed callers stay
ineligible during that lease.

The deeper integration audit found an important interaction with daemon scheduling: the
control loop calls `health_snapshot()` immediately before refreshing and dispatching work. If
a diagnostic snapshot itself transitioned a due circuit to half-open, monitoring could take
the only 60-second recovery lease immediately before the worker that could actually use it.
At the normal five-minute control refresh this could repeatedly suppress a recovered provider
at dispatch time.

`health_snapshot()` is therefore observational for open/half-open circuits. It can still probe
closed providers and record newly observed failures, but it cannot consume or renew a recovery
lease. Actual routing remains the owner of the single half-open probe.

## Validation contract

Regression coverage now locks all of the following:

- production uses first-failure threshold 1 and zero immediate same-provider retries;
- conservative production transport/rate/quota/auth cooldown floors remain in place;
- repeated quota failures grow 1x -> 2x -> 4x and remain bounded;
- production-style failure-specific retry floors are the values that get scaled;
- a provider-supplied stronger quota retry floor is retained across the unresolved streak;
- successful real provider execution resets the quota streak;
- non-quota failures do not inherit exponential quota policy;
- quota streak state survives the durable health store/restart;
- shallow healthy CLI/auth probes do not erase a quota streak;
- monitoring snapshots do not consume the single half-open recovery lease;
- concurrent routing remains blocked while a half-open recovery operation is leased.

No persisted-state migration is required. Existing health-store fields are reused and remain
backward compatible. The canonical Factory CI remains authoritative for Ruff formatting/lint,
mypy, the complete pytest suite, governance checks, and `CI / required`.

## Other current audit findings

The live control panel is fresh but scheduling is currently storage-blocked: the Factory state
volume has 3.9 GiB free against the configured 5 GiB reserve, leaving 2,350 runnable jobs and
no active tasks. The repository already contains the merged bounded archive retention,
pressure eviction, rootless Podman maintenance, watchdog cleanup, and provider-state
relocation work. Without host-level storage attribution it would be unsafe to lower the
reserve or delete additional state blindly, so this change does not weaken that protection.

Automatic GitHub Copilot PR review is also still generating redundant attempts even though
the Factory has its own authoritative exact-head independent-review gate; recent attempts are
failing because the Copilot review quota is exhausted. That setting lives in repository
administration/ruleset state and is not worked around in Factory code.
