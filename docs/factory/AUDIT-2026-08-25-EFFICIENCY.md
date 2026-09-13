# Factory allowance-efficiency audit: 2026-08-25

## Goal

Keep the Factory productive for the full allowance window instead of maximising short bursts of agent activity and
then becoming capacity constrained. This audit focuses on controls that reduce repeated model context, unnecessary
GitHub Actions work, and duplicate control-plane activity without weakening verification, independent review, or
exact-head merge safety.

## Existing controls verified

The current Factory already contains important resource controls and they should be preserved:

- production admits one new issue per hour;
- the conservative router admits at most six AI-backed routes per hour;
- production disables immediate same-provider retries and limits each route to two provider candidates;
- global conservative agent concurrency is two, with independent review separately bounded;
- independent reviews are limited to two admissions per hour;
- implementation prompts put reusable policy/context before task-specific text to improve provider prompt-cache
  reuse;
- implementation issue bodies are already bounded to 24,000 input characters;
- pure documentation/translation changes can bypass the security-review agent when the diff is provably outside
  the security checklist's runtime scope;
- deterministic verification and quality gates run before merge, and CI repair tries mechanical formatting/lint
  repair before spending an agent route;
- expensive model tiers are already separated from the lower-cost review/repair tiers for providers that support
  phase-specific models.

These controls mean another blanket concurrency reduction or model downgrade would trade away throughput or safety
without strong evidence. The remaining high-confidence waste was repeated context and recovery automation.

## Changes made

### 1. Bound repeated phase task context

Implementation keeps the 24,000-character task-body ceiling because it is the first code-producing phase and needs
the broadest issue context. Later phases can inspect the already-created worktree and receive phase-specific
instructions/evidence, so they now use smaller task-body ceilings:

| Phase | Previous ceiling | New ceiling | Maximum repeated-body reduction |
| --- | ---: | ---: | ---: |
| Security review | 24,000 | 12,000 | 12,000 characters |
| Code review | 24,000 | 12,000 | 12,000 characters |
| Quality repair | 24,000 | 6,000 | 18,000 characters |
| CI repair | 24,000 | 6,000 | 18,000 characters |
| Architecture | 24,000 | 24,000 | unchanged |

The existing head/tail truncation remains authoritative, so large prompts retain both initial scope and trailing
acceptance criteria. Phase-specific evidence still has its separate 8,000-character bound.

For a maximum-sized issue taking the normal implementation -> security -> review path, this removes up to 24,000
replayed input characters after implementation. A job that additionally needs one quality repair and one CI repair
avoids up to another 36,000 replayed input characters. These are deterministic character reductions, not claimed
token counts, because the subscription CLIs do not expose one portable tokenizer or usage API.

### 2. Make the scheduled merge workflow a real recovery fallback

The daemon already owns healthy-path exact-head merges. The scheduled `Factory Merge Gate` exists only to recover
when the daemon is unavailable, but it was polling every ten minutes.

The schedule is now hourly. That changes the fixed recovery schedule from 144 invocations/day to 24 invocations/day:
120 fewer scheduled workflow invocations, an 83.3% reduction. The workflow still requires the same independent
review status, required CI status, clean merge state, no requested changes, and exact head SHA before merging.
Healthy-path merge latency is unchanged because the daemon remains the primary merge owner. The trade-off is that
a daemon outage can leave an otherwise eligible PR waiting up to about one hour for this fallback.

### 3. Stop impossible pull-request recovery jobs

The self-healing monitor intentionally does not create incident issues for pull-request workflow failures because
those failures are owned by the Factory PR repair lane. Its success path nevertheless started a runner for
successful PR workflows and searched up to 1,000 open issues for an incident that could never have been created.

The recovery job now applies the same `event != pull_request` boundary as incident creation. Main/deploy recovery
behaviour is unchanged. Successful PR workflow completions no longer consume a recovery runner or perform the
large issue-list query.

## Findings deliberately not changed in this pass

### Monetary budget helper is not wired to execution

`automation/openhands_factory/budget.py` has monthly/per-task USD ceiling logic, but repository search shows the
runtime does not call it. Wiring fictitious subscription-dollar consumption into the scheduler would be worse than
leaving it unused because Claude/Codex/Google/OpenCode subscription CLIs do not expose a reliable common remaining
allowance value. The durable route-admission gates are the enforceable production allowance control today.

A future change should connect this helper only when there is authoritative measured spend/cost input, or retire the
misleading monetary configuration if it cannot be made authoritative.

### Provider reasoning tiers remain unchanged

Implementation/security work still uses the stronger configured reasoning tier, while review/repair phases use
faster tiers where supported. The audit found no evidence that lowering security-critical phases further would be
a safe efficiency win. Pure docs/translations already avoid the security agent when provably exempt.

### PR convergence work is already in flight

Open PR #7897 addresses PR churn, WIP limits, duplicate/current-main replay loops, and branch convergence. This audit
does not duplicate or overwrite that work. The changes here are intentionally orthogonal: prompt input volume and
GitHub Actions recovery overhead.

## Validation contract

The change adds regression coverage for:

- phase-specific prompt budgets and head/tail preservation;
- the hourly merge-recovery schedule while retaining exact-head and required-status gates;
- the self-healing monitor's symmetric exclusion of pull-request incident creation and recovery.

The repository's normal GitHub Actions checks remain authoritative for the full Factory test suite, Ruff, mypy,
workflow policy, and clean-environment integration checks.

## Follow-up measurements

Use the existing Factory metrics/provider history to compare, over a representative period:

- successful engineering outcomes per admitted agent route;
- provider fallback frequency and quota/rate-limit downtime;
- review/repair loops per merged PR;
- time spent with every provider unavailable;
- CI repair success after the mechanical-repair pass;
- open PR queue age versus agent-route admissions.

Do not optimise for raw calls/hour. The useful target is merged, verified work per unit of constrained agent
capacity while keeping enough reserve to continue operating throughout the allowance window.
