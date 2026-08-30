# Factory efficiency audit: 2026-08-30

## Scope

This audit reviewed the current Repo Factory/OpenHands Factory after the latest provider-health,
prompt-budget, circuit-breaker, polling, and Factory-only CI optimisations. The review covered
production provider routing, phase model selection, prompt construction, GitHub refresh behaviour,
retry/circuit policy, concurrency, scheduled GitHub Actions, self-healing, branch hygiene, and the
current merge ruleset.

The goal remains useful engineering output per scarce subscription/provider start. Independent
review, security review, deterministic verification, exact-head merge protection, durable recovery,
and required CI remain authoritative.

## Existing allowance controls retained

The current Factory already has strong safeguards against the largest sources of model churn:

- one newly discovered issue is admitted per hour in production;
- conservative mode admits at most six real provider starts per hour globally and four per task;
- global agent concurrency is two and independent review concurrency is one;
- a phase sees at most two provider candidates in conservative mode;
- same-provider immediate retries are disabled in conservative mode;
- provider-wide failures open the circuit after the first classified failure;
- provider health/circuit state and concurrency are shared across repository instances;
- implementation task bodies are bounded to 24,000 characters, review/security to 12,000, and
  repair phases to 6,000;
- mechanical CI repair runs before an agent-backed CI repair;
- code review remains independent from the provider that mutated code whenever another provider is
  available;
- OpenHands PAYG is disabled in the production routing configuration.

Those controls are intentionally unchanged in this pass.

## Finding: primary security review used the planning-tier model for a bounded diff checklist

The production Claude policy used `opus` for planning, architecture, and security review while
implementation used `sonnet`. That did not match the execution shape of the security phase. The
security prompt is a bounded static review of the current diff against explicit secret, payment,
authorisation, validation, injection, and configuration checks. The Claude adapter already treats
security review as bounded review work and uses `medium` effort rather than the `max` effort retained
for open-ended planning, architecture, and implementation.

Using the planning-tier model for every ordinary primary security-review route therefore spent the
scarcer Opus subscription tier without adding a distinct Factory safety gate.

### Implemented change

The production Claude `security_review` phase now uses `sonnet`, matching the implementation tier.
Planning and architecture remain on `opus`. Other provider fallbacks are unchanged.

This does **not** skip or weaken the security phase:

1. the same security prompt and authoritative skill checklists are used;
2. the same Claude provider remains first in the security route;
3. the adapter retains `medium` security-review effort;
4. confirmed findings must still be repaired and tested;
5. deterministic verification still runs after the phase;
6. independent code review still runs before merge; and
7. lower-priority providers remain available if the primary provider is unavailable.

The deterministic allowance saving is one avoided Opus-tier invocation for every security-review
route successfully completed by the primary Claude provider. No token or currency number is claimed
because the subscription CLI does not expose a portable remaining-token or per-run dollar counter.

## Finding: read-only branch hygiene rebuilt its Python environment four times per day

`Branch PR Hygiene` is a read-only observability workflow. Each scheduled run performs a full-history
checkout, configures Python and uv, synchronises the Factory development environment, runs the
classifier, and uploads a machine-readable artifact. It never deletes a branch or changes a pull
request.

Running that audit every six hours was disproportionate to its read-only role and duplicated setup
work without improving Factory task throughput.

### Implemented change

The scheduled cadence is now once per day at `03:17 UTC`. Manual `workflow_dispatch` remains
available. Artifact retention is reduced from 14 days to 7 days.

Deterministic effect:

- scheduled branch-hygiene runs: **4/day -> 1/day**;
- full-history checkout + Python/uv setup cycles avoided: **3/day**;
- scheduled audit artifacts created: **4/day -> 1/day**; and
- artifact retention window: **14 days -> 7 days**.

No branch mutation or Factory safety behaviour changes because the workflow was already dry-run/read-only.

## Finding: the self-healing schedule duplicated an event-driven main-CI check every hour

`Self-Healing Workflow Monitor` already has two immediate event-driven paths:

- every push to `main` runs `ensure-main-ci` after a short registration delay; and
- completed CI/Deploy/Admin portal workflows trigger failure/recovery incident handling.

The hourly schedule only acts as a backstop for the unusual case where the event-driven path did not
leave a canonical CI run for the current `main` SHA. In the normal healthy state it allocates an
Ubuntu runner, reads the current main ref and up to 100 CI runs, classifies the state as healthy, and
exits.

### Implemented change

The backstop now runs every three hours. Push and `workflow_run` triggers are unchanged, so normal
failure detection and main-CI recovery remain event-driven rather than waiting for the schedule.

Deterministic effect:

- scheduled self-healing backstop runs: **24/day -> 8/day**;
- healthy no-op backstop runner allocations avoided: **up to 16/day**.

Together with branch hygiene, the two control-plane schedules fall from **28 scheduled runs/day to
9/day**, a **67.9% reduction** in their scheduled invocations, while retaining event-driven repair and
manual branch-hygiene execution.

## GitHub merge safety verification

The active `main` ruleset requires `CI / required`. The independent Factory review is enforced by its
separate active ruleset. None of the read-only schedules changed in this audit is a required merge
status, so reducing their schedule cannot strand pull requests waiting for a missing required check.

## Deliberately unchanged

Several tempting reductions were rejected because they would trade away useful throughput or safety:

- the six-provider-start hourly budget was not lowered further;
- implementation, planning, and architecture reasoning/model tiers were not reduced;
- security review was not skipped for executable source changes;
- independent code review was not removed or merged into implementation;
- provider diversity and first-failure circuit breaking were not weakened;
- the five-minute GitHub discovery refresh was not stretched again in this pass. The backlog is very
  large, but source-specific issue/PR refresh requires a dedicated reconciliation change so faster PR
  progress is not coupled to slower issue discovery. That needs explicit lifecycle tests before it is
  safe to deploy.

## Regression coverage

`automation/tests/test_factory_control_plane_efficiency.py` locks the three production policies:

- open-ended Claude planning/architecture remain on Opus while security review matches the Sonnet
  implementation tier;
- branch hygiene remains daily with seven-day artifacts and manual dispatch; and
- the self-healing schedule remains a three-hour backstop while push and workflow-run triggers stay
  present.

## Expected result

This pass removes recurring work that does not directly create, review, repair, or merge code, and it
stops a bounded checklist phase from consuming the primary planning-tier model. Productive Factory
throughput, provider fallback, security review, independent review, required CI, and exact-head merge
safety remain intact.
