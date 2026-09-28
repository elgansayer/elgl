# Factory allowance and efficiency audit - 2026-08-24

## Objective

Optimize the OpenHands Factory for steady verified production over a full day rather than short bursts that exhaust subscription allowance and leave the daemon unable to work.

The primary efficiency metric should be **merged, verified work per provider start**, not raw agent calls, raw concurrency or PR count.

## Scope

Reviewed:

- daemon scheduling and concurrency
- issue and PR admission
- provider routing, health, circuit breakers, cooldowns and failover
- phase/model selection
- prompt construction and context volume
- implementation, security, quality, review and CI-repair loops
- deterministic/mechanical verification and repair
- durable job/worktree state
- architect scheduling
- production environment defaults
- canonical and standalone GitHub Actions workflows
- Dependabot cadence and PR pressure
- current repository CI health

## Existing architecture worth preserving

Current `main` already implements most of the intended provider-neutral architecture:

- OpenHands Factory remains the scheduler/orchestrator.
- Claude, Codex, Google, OpenCode, Pi and optional OpenHands are interchangeable provider adapters.
- Routing is phase-specific.
- Cross-provider independent review is preferred.
- Provider health, cooldowns, circuit breakers and concurrency limits exist.
- PAYG OpenHands is disabled by default and emergency-only.
- Expensive model tiers are concentrated in architecture, implementation and security; cheaper tiers already handle routine review/repair where supported.
- Mechanical CI repair runs before AI-backed CI repair.
- Provider-capacity failures defer work instead of consuming task-failure attempts.
- Verification, exact reviewed-SHA protection and merge safety are already strong.

The audit therefore hardens the current Factory rather than replacing it or reviving the historical swarm architecture.

## Finding 1: one issue/hour was not an allowance budget

Production already admitted one new issue per hour, but one issue can fan out into multiple AI phases:

```text
implementation
  -> security review
  -> verification
  -> quality repair when needed
  -> independent review
  -> CI repair when needed
  -> review again
```

The conservative router allowed two provider candidates and the base router allowed one same-provider retry. A single logical phase could therefore start four provider processes:

```text
primary
primary retry
fallback
fallback retry
```

There was no durable hourly cap spanning all AI-backed phases.

### Implemented

Production defaults now include:

```text
FACTORY_AGENT_ROUTE_INTERVAL_SECONDS=3600
FACTORY_AGENT_ROUTES_PER_INTERVAL=6
```

Admissions persist in `agent-route-admissions.json`, so daemon restart does not reset the allowance.

Under the conservative policy:

- same-provider immediate retry is forced to zero;
- the preferred provider is attempted once;
- at most one distinct fallback provider remains available;
- budget exhaustion raises `ProviderCapacityUnavailable` and defers the job;
- the retry time is derived from the persisted next admission expiry when possible.

This changes the Factory from burst-oriented to rate-oriented operation while preserving fallback diversity.

The current limit is route-level. A pathological route can still reach one fallback, so six admitted routes can start up to twelve provider processes if every first provider fails. The exact provider-process admission boundary is a recommended follow-up.

## Finding 2: provider input could grow without a useful bound

The prior implementation allowed a 160,000-character shared context budget while GitHub task bodies and phase-specific evidence were effectively unbounded outside that budget.

Large generated issues, release notes, copied logs or repair evidence could therefore dominate a small task.

### Implemented

Provider input is now bounded before invocation:

```text
implementation prompt/context total budget: 48,000 characters
GitHub task/PR body:                         24,000 characters
phase-specific evidence:                      8,000 characters
```

Oversized untrusted input preserves the informative beginning and end with an explicit omission marker.

These are deterministic character budgets, not invented token counts. The subscription CLIs do not expose one portable tokenizer or exact remaining-quota API.

Stable-prefix prompt construction remains in place so repeated Factory instructions can benefit from provider prompt caching.

## Finding 3: GitHub Actions did expensive application work for unrelated PRs

Canonical CI ran ten backend/frontend/admin application matrix jobs on every pull request. Separate E2E, Compose and clean-lint workflows also ran on Factory/docs-only changes.

The repository already has the correct merge abstraction: one stable aggregate check named `CI / required`.

### Implemented: canonical CI impact classification

Pull requests now classify change impact before expensive groups start.

The application matrix can be skipped only when **every** changed path is limited to:

```text
automation/
docs/
config/factory/
config/systemd/
.github/dependabot.yml
```

Unknown/shared paths fail open to full application verification.

Factory verification runs for Factory-sensitive paths. Constitution/governance remains unconditional. Database verification keeps its database-specific detector.

Safety properties:

- editing `ci.yml` runs the full matrix;
- pushes to `main` and `develop` run the full application and Factory groups;
- merge-queue candidates run the full application and Factory groups;
- `CI / required` remains the stable aggregate gate;
- a failed impact-classification job explicitly fails `CI / required`;
- a group classified as required must be `success`;
- only groups explicitly classified as irrelevant may be `skipped`.

### Implemented: standalone workflow impact gates

The following workflows retain their existing PR triggers/check identities but skip expensive jobs for Factory/docs-only PRs:

- E2E Runner Context
- E2E Core Product Flows Contract
- Core Compose Contract
- Clean project lint

This is intentionally safer than broad workflow-level `paths-ignore`, which can create missing check contexts under some branch-protection/ruleset configurations.

`cancel-in-progress` remains enabled, so superseded revisions also stop consuming runner capacity.

## Finding 4: routine dependency churn multiplied full CI work

Routine dependency version scans were generating a continuous stream of PRs, each capable of exercising the full matrix.

### Implemented

Routine npm, Python and GitHub Actions version updates are moved to a staggered weekly Monday maintenance wave with lower open-PR ceilings. Docker remains weekly and is aligned to the same window.

Security updates retain separate security grouping.

## Finding 5: Actions and Factory ownership boundaries are correct

The repository's workflow audit already enforces the right split:

```text
GitHub Actions -> deterministic checks, reports and narrow control-plane work
Factory on VPS -> autonomous code mutation, repair, review and PR lifecycle
```

Historical branch-patching workflows are no longer present on current `main`. Previously created optimization branches for token/reviewer/dependency behavior are ancestors of current `main`, not missing work to resurrect.

Do not reintroduce application-code mutation from Actions. It would duplicate the Factory, create branch races and make allowance accounting incomplete.

## Finding 6: shared base-branch CI failures can waste many agent repairs

At audit time, PR #7860 is already the focused repair for frontend unit failures reported as reproducible on the shared base. Creating another overlapping repair in this PR would be counterproductive.

### Recommended next change

Add exact base-branch CI failure attribution before AI-backed PR repair:

1. record failing required checks for the exact `origin/main` SHA;
2. compare a PR failure with that exact baseline;
3. do not ask every PR worker to repair a known base-only failure;
4. route one dedicated `main` health repair task instead;
5. invalidate the baseline whenever `main` advances.

This is one of the largest remaining token-saving opportunities, but it must fail closed so a branch regression is never hidden merely because it shares a check name with a base failure.

## Finding 7: architect work should remain discretionary

The weekly architect/gap-analysis cycle uses the same shared router, so the new route budget already prevents it from escaping allowance controls.

Recommended follow-up: make architect scheduling explicitly idle/backlog-aware so implementation, review and repair work wins when productive work is already queued.

## Recommended production operating point

```text
new issue intake:          1/hour
fresh PR reviews:          2/hour
AI-backed route starts:    6/hour
agent concurrency:         2
review concurrency:        1
providers per route:       2 maximum
same-provider retry:       0 immediate
routine dependency scans:  weekly
```

The values should be tuned from production evidence, not increased simply because more providers are authenticated.

## Metrics to add next

Exact cross-provider token accounting is not portable, but useful allowance proxies are:

- prompt characters by phase/provider
- AI route admissions/hour
- provider process starts/hour
- first-provider success rate
- fallback rate
- repair loops per merged PR
- review rejection rate
- CI repairs caused by base-only failures
- issue-admission to reviewed-PR wall time
- merged PRs per 24 hours

The target is better **verified output per provider start**.

## Follow-up priority

### P0

- Land/fix the focused shared-main frontend CI repair (#7860).
- Deploy this PR's route/prompt/CI impact controls and observe production throughput.

### P1

- Add base-branch CI failure attribution plus one dedicated main-health repair path.
- Move durable admission to the exact provider-process boundary for a strict provider-start budget.
- Expose prompt-size, route, fallback and repair efficiency in Factory doctor/status output.

### P2

- Make weekly architect scheduling explicitly idle/backlog-aware.
- Tune provider phase ordering from measured success/repair data.
- Consider task-complexity routing only after the simple rate policy has enough production evidence.

## Acceptance criteria

- [x] Existing provider-neutral Factory architecture preserved.
- [x] One issue/hour intake preserved.
- [x] Global AI route rate durably bounded.
- [x] Immediate same-provider retry removed in conservative production mode.
- [x] One fallback provider preserved.
- [x] Prompt/context volume bounded.
- [x] Review rate and cross-provider review safety preserved.
- [x] Canonical `CI / required` merge gate preserved.
- [x] PR CI becomes impact-sensitive while push/merge-queue CI remains full.
- [x] Impact classification fails closed.
- [x] Standalone application workflows stop doing expensive work for Factory/docs-only PRs.
- [x] Routine dependency churn batched.
- [x] Resource exhaustion remains a recoverable deferral.
- [x] Tests cover route budgeting and prompt truncation.
- [x] Higher-risk base-failure attribution is documented rather than implemented by weakening current merge safety.
