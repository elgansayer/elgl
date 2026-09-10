# Factory efficiency audit: failed-provider cooldowns

Date: 2026-09-10

## Scope

This pass re-audited the current OpenHands Factory control plane, production provider policy, queue/review lifecycle, prompts, GitHub Actions recovery paths, host maintenance, and the live Factory control panel. It builds on the existing bounded-routing, prompt-budget, CI-repair, review-settling, event-driven merge, and storage-pressure work rather than reintroducing overlapping controls.

## Live finding

The live control panel was healthy enough to publish a fresh heartbeat but degraded and idle with 2,350 runnable jobs. Its cumulative provider outcomes showed that failed subscription probes dominate several routes:

| Provider | Calls | Success | Failure | Dominant failures |
| --- | ---: | ---: | ---: | --- |
| Claude | 647 | 39 | 608 | 344 transport, 172 quota |
| Codex | 2,721 | 90 | 2,631 | 2,127 transport, 256 rate limit, 139 auth, 72 timeout |
| Google | 239 | 99 | 140 | 76 task, 48 transport, 15 quota |
| OpenCode | 221 | 2 | 219 | 219 quota |
| Pi | 242 | 0 | 242 | 242 quota |

These counters are cumulative rather than a per-day rate, so they are evidence of repeated failure churn, not a claim about a precise daily token saving.

Production already opens a provider circuit on the first qualifying failure and performs zero immediate same-provider retries. The remaining problem was the recovery cadence: transport failures were eligible again after five minutes, rate limits and auth failures after fifteen minutes, and quota failures after one hour. With a large runnable queue, an unavailable subscription can therefore be tested again as soon as every short circuit expires even when nothing meaningful has changed.

## Change

Keep the same first-failure circuit breaker and provider pool, but make persistent subscription failure classes back off more conservatively:

| Failure | Before | After | Maximum expiry opportunities/day before other gates |
| --- | ---: | ---: | ---: |
| provider transport | 5 min | 30 min | 288 -> 48 (83.3% lower) |
| provider rate limit | 15 min | 60 min | 96 -> 24 (75% lower) |
| provider quota | 60 min | 6 h | 24 -> 4 (83.3% lower) |
| provider auth | 15 min | 6 h | 96 -> 4 (95.8% lower) |

Those figures are upper-bound expiry opportunities for a continuously failing provider with immediate demand and no longer provider-supplied retry interval. Actual provider starts remain subject to candidate routing, task/provider admission, concurrency, capacity leases, and provider health.

Provider-reported longer retry intervals still win because the circuit uses the maximum of its configured cooldown and the reported retry duration. A successful provider response or a responsive task-level result resets the circuit normally, so this does not permanently disable any subscription.

The shorter defaults for generic unavailability, timeouts, crashes, and invalid output are intentionally unchanged. Those classes can represent transient infrastructure or task-specific conditions where a long blanket lockout would reduce useful throughput.

## Expected effect

The change targets allowance spent discovering the same persistent outage repeatedly. It does not reduce the one-new-issue/hour engineering admission rate, global model concurrency, provider diversity, implementation reasoning, security review, independent review, deterministic verification, exact-head protection, or merge gates.

In particular, OpenCode and Pi remain configured and can recover automatically instead of being disabled in source merely because the current subscription state is exhausted. The trade-off is a longer worst-case delay before a provider with a previously classified quota/auth/transport failure is retried after it recovers. With multiple regular subscription providers and durable queued work, that delay is preferable to repeatedly consuming starts against a known-bad route.

## Other current findings

- The live Factory state volume remains below its configured free-space reserve. The repository already contains bounded recovery-archive retention, hourly rootless Podman/storage maintenance, and safe provider-state relocation from the merged storage-pressure work. This pass does not duplicate that implementation.
- Issue discovery is already admission-aware: when the one-new-issue/hour window is full, the daemon can reuse durable issue state while retaining faster PR reconciliation.
- Provider-backed phases already have bounded context and output capture, zero immediate same-provider retries, capacity limits, prompt-volume metrics, output-volume/truncation metrics, and mechanical CI repair before AI repair.
- Merge recovery and self-healing already use event-driven paths plus sparse scheduled backstops, so another polling reduction would mainly increase recovery latency.
- The repository still has an active GitHub ruleset requesting Copilot review in addition to the Factory's exact-head independent-review gate. That is repository-administration state rather than a Factory code path and is intentionally not worked around in application code.

## Validation and rollback

`automation/tests/test_factory_efficiency_contract.py` now locks the production first-failure, no-immediate-retry, and minimum cooldown contract. Standard Factory CI remains authoritative for JSON/schema validation, Ruff formatting/lint, mypy, pytest, and repository governance checks.

Rollback is a configuration-only revert. No migration or persisted-state transformation is required. Existing breaker state remains schema-compatible; after deployment, loaded breakers use the current production cooldown defaults while preserving their durable open/closed state and provider-reported retry information.
