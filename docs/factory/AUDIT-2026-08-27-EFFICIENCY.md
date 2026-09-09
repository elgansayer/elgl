# Factory allowance-efficiency audit: 2026-08-27

## Goal

Increase useful verified engineering output per constrained subscription-agent route and GitHub Actions runner while preserving Factory safety, provider diversity for production code, independent review, deterministic verification, and exact-head merge gating.

This audit was performed against current `main` at `0e76f6630df3eccece733f3fa51229a67f3c5f5a`, including the Factory stall-detection work merged earlier on 2026-08-27 and the CI-impact optimisations from the previous daily audit.

## Existing controls revalidated

The production conservative policy remains appropriately bounded:

- at most six real provider starts per configured one-hour route window;
- at most four real provider starts per task per route window;
- at most two provider candidates per ordinary phase;
- no immediate same-provider retry in conservative mode;
- two global agent slots and one independent-review slot;
- two independent-review admissions per hour;
- one new issue per configured production intake interval;
- phase-specific provider/model ordering and timeouts;
- provider health persistence, circuit breakers, cooldowns, and capacity limits;
- mechanical CI repair before agent-backed repair;
- independent review, deterministic verification, required CI, and exact reviewed-SHA merge checks.

Further blanket throttling would reduce useful throughput without evidence that these limits are currently too loose.

## Finding 1: best-effort stall diagnosis could consume multiple scarce agent routes

Commit `db8c12f` added proactive stall detection. Once a stall episode crosses the configured threshold, the Factory first gathers deterministic host evidence and sends it to the operator, then dispatches an optional `GENERAL_ACTION` agent to reason over that evidence.

The new synthetic task uses `source="factory-internal"`, but before this audit it went through the ordinary general-action fallback chain. Under the conservative router a provider-side failure can therefore start a second distinct provider. Each real provider start is correctly charged against the six-route hourly admission budget.

That creates the wrong priority inversion: optional control-plane commentary can consume up to two scarce provider starts while real implementation, repair, or review work is waiting. If an emergency provider is added to the general-action route, an internal diagnostic could also eventually reach it even though deterministic evidence has already been delivered.

### Change

`ConfigRoutingPolicy` now treats `GENERAL_ACTION` jobs whose task source is `factory-internal` as strictly best effort:

- select at most the first healthy non-emergency provider from the configured general-action order;
- do not cascade to a second subscription when that provider fails;
- do not use an emergency/PAYG provider for this internal diagnostic;
- leave normal GitHub/user general-action work unchanged, including its fallback chain.

The current general-action order means a healthy OpenCode provider remains the first choice by default. The deterministic stall alert is sent before the agent call, so losing AI fallback does not remove the evidence needed to diagnose the incident.

### Deterministic allowance gain

A stall investigation can now start **at most one** regular provider instead of up to two under the conservative candidate cap. In the provider-failure case this saves **one of the six hourly provider-route admissions**, a maximum reduction of **50% of agent starts for that best-effort investigation**, while preserving the deterministic alert and one AI diagnosis attempt.

No token-dollar estimate is claimed because subscription CLIs do not expose a common authoritative token or monetary balance.

## Finding 2: admin governance allocated runners for ordinary Factory-created issues

`.github/workflows/admin-backlog-governance.yml` subscribes to `issues: opened, reopened, labeled`. Its existing job-level condition filtered irrelevant label events, but every ordinary opened or reopened product issue still allocated an Ubuntu runner, attempted idempotent label creation, fetched the issue, and only then discovered in Python that the title was not an admin-backlog issue.

The Factory creates a continuing stream of ordinary issues, so this was work proportional to issue throughput even though the governance workflow only acts on admin backlog titles.

### Change

The job now applies a conservative GitHub-expression prefilter before runner allocation:

- manual dispatch and workflow-file push reconciliation are unchanged;
- issue events must contain `admin` in the title before the job starts;
- labeled events must additionally be the existing `factory-ready` promotion signal;
- the Python `is_admin_issue()` check remains authoritative.

GitHub expression `contains()` is case-insensitive. The prefilter intentionally uses `contains('admin')` rather than duplicating the Python startswith/whitespace-normalisation rules. That means it may allow an occasional false-positive runner, but it cannot exclude a title that the Python check would classify as an admin issue simply because of case or whitespace normalisation.

### Deterministic Actions gain

Every opened/reopened ordinary issue whose title does not contain `admin` now consumes **zero admin-governance runner jobs** instead of one. It also avoids the workflow body's GitHub API calls for those events. Skipped workflow records/check suites may still exist because GitHub evaluates the event and job condition, but no hosted runner is allocated for the skipped job.

## Regression coverage

`automation/tests/test_control_plane_efficiency.py` covers:

- factory-internal general actions return exactly one regular candidate with healthy defaults;
- an emergency provider is not selected for factory-internal best-effort analysis;
- normal general-action tasks retain the ordinary multi-provider fallback chain;
- the admin-governance workflow retains the event prefilter and `factory-ready` promotion guard.

## Additional observations

### No-PR stall semantics deserve a separate correctness pass

`no_pr_progress_check()` currently marks an active queue with no pull request as a warning immediately, while `FactoryDaemon` separately requires that warning to persist for `stall_alert_minutes` (20 minutes by default). That means a legitimate first implementation lasting more than 20 minutes can satisfy the no-PR warning even though `max_no_pr_hours` defaults to six hours.

This audit does not silently redefine that recently introduced alert semantic because the safe choice depends on whether the intended signal is "no PR exists yet" or "no active job has progressed for max_no_pr_hours". The route change above contains its allowance impact in the meantime: even a false-positive internal diagnosis cannot cascade across subscriptions or into emergency PAYG. The next correctness change should make the signal explicitly age active-job progress and add daemon-state tests before changing production alert timing.

### Monetary budget fields remain non-authoritative for subscription CLIs

The repository still carries USD-oriented budget configuration, but the subscription-backed providers do not expose a common reliable remaining-dollar balance. Durable route admissions, provider capacity, health, circuit breaking, and measured route outcomes remain the enforceable allowance controls. No synthetic dollar accounting was added.

### CI impact optimisation from 2026-08-26 remains in place

Factory-only control-plane changes continue to avoid the unrelated application matrices through the shared fail-open impact classifier. Unknown/product paths still trigger full application verification.

## Validation expectations

The pull request is intentionally small and covered by normal Factory CI. Required validation should include Ruff formatting/linting, mypy, Factory pytest, workflow linting/governance checks, and the canonical required gate. The workflow event filter changes runner admission only; the authoritative Python governance logic is preserved.
