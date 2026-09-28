# Factory efficiency audit - 2026-08-29

This audit focused on sustainable engineering throughput: preserve useful implementation and review work while removing control-plane churn and unnecessary reasoning allowance.

## Findings and changes

### 1. Backlog polling was disproportionate to admission rate

The production HelloTalk Factory admits one newly discovered issue per hour, but its GitHub refresh cadence inherited the 60-second default. At audit time the repository had 3,801 open issues and 183 open pull requests. The issue collector requests full issue bodies, labels and authors, so a continuously available daemon could scan up to 1,440 times per day.

At that snapshot size the 60-second cadence represents up to 5,473,440 issue records and 263,520 pull-request records fetched per day even though at most 24 new issues can be admitted in the same day.

Both production instances now explicitly use `FACTORY_COOLDOWN_SECONDS=300`. This reduces full refresh cycles from 1,440 to 288 per day, an 80% reduction. Existing jobs continue to progress between refreshes from durable local state; the trade-off is only up to five minutes of discovery/external-state latency.

A future improvement can split issue discovery from pull-request/check refreshes so active PRs remain highly responsive without rescanning the entire issue backlog. That is deliberately not mixed into this low-risk configuration change.

### 2. Provider-wide failures could consume a second scarce route

Conservative production policy admits only six real provider starts per hour. The production circuit breaker previously required two provider-side failures before opening, so a quota, auth, outage or rate-limit condition could consume another scarce start merely to rediscover the same provider-wide problem.

Production now opens a provider circuit after the first classified provider-side failure. This can save one redundant provider start per provider-wide incident, which is as much as one sixth of an hourly route budget. Rate-limit fallback without an explicit provider retry time now cools down for 15 minutes instead of five; explicit retry-after data still remains authoritative.

Fallback to a different healthy provider remains intact. Task, test, repository and policy failures are still not treated as provider outages.

### 3. Codex reasoning was oversized for bounded loops

Codex is the first production route for quality repair, code review and CI repair. Quality repair and CI repair are constrained by deterministic findings or failed checks and are followed by verification and re-review. Independent code review retains a stronger reasoning floor because it must discover issues that deterministic checks missed.

Codex now uses:

- maximum reasoning for planning, architecture, implementation and security review;
- medium reasoning for independent code review and general action;
- low reasoning for quality repair and CI repair.

This is a deterministic reduction in requested reasoning tier on bounded repair loops without weakening independent review or security analysis. No token percentage is claimed because subscription CLIs do not expose a portable, trustworthy token/allowance meter.

## Safeguards intentionally preserved

The audit did not weaken the Factory's existing safety or throughput controls. Production retains one new issue per hour, six real provider starts per hour, four starts per task per hour, two provider candidates per route, no immediate same-provider retry under conservative policy, provider concurrency limits, independent review, prompt-size bounds, mechanical CI repair before agent repair, exact-head review/merge protection, required CI, and disabled PAYG OpenHands execution.

The changes are configuration and provider-effort controls around the existing architecture. They do not bypass Factory verification, independent review, worktree isolation, CI repair, or merge safety.
