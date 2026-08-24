# Factory allowance and efficiency audit — 2026-08-24

## Goal

Keep the OpenHands Factory continuously productive without allowing a large issue/PR backlog, provider failure cascade, oversized prompt, or GitHub automation storm to exhaust subscription allowance in a short burst.

The desired operating point is deliberately conservative: steady useful production over the whole day is more valuable than a short high-concurrency burst followed by hours with every subscription rate-limited or quota-exhausted.

## Scope reviewed

This audit covered:

- Factory daemon scheduling and worker concurrency
- issue admission and PR review admission
- provider routing, health, circuit breakers and failover
- provider model/effort selection
- prompt construction and context volume
- implementation, security review, quality repair and independent review loops
- CI repair behavior
- deterministic verification
- worktree/task durability
- weekly architect work
- production Factory environment defaults
- GitHub Actions mutation policy and canonical CI behavior
- Dependabot update cadence and PR pressure
- current repository CI health signals

## Current architecture is already strong

The Factory on `main` has already converged on most of the intended multi-provider design. This PR does **not** replace that architecture.

Existing strengths retained by this audit include:

1. OpenHands Factory remains the orchestrator; Claude, Codex, Google, OpenCode, Pi and optional OpenHands are provider adapters beneath it.
2. Provider routing is phase-specific and cross-provider review is preferred.
3. Expensive models are already concentrated in architecture/implementation/security while routine review and repair use lower-cost/low-effort tiers where supported.
4. OpenHands PAYG is disabled by default and marked emergency-only.
5. Provider concurrency, health, cooldowns and circuit breakers already exist.
6. New issue intake is restart-safe and limited to one issue per hour in production.
7. Independent code review is separately limited to two new PR head SHAs per hour and one concurrent review agent.
8. Mechanical CI repair is attempted before spending an agent call.
9. Deterministic verification is path-aware and most checks can run without holding scarce agent capacity.
10. Implementation context already avoids unconditional `README.md` injection and uses stable-prefix prompt construction for provider prompt-cache reuse.
11. Provider-capacity failures defer jobs instead of consuming task attempts and permanently quarantining otherwise healthy work.
12. GitHub merge safety remains exact-head/review-SHA based and is not weakened by this optimization work.

These controls should remain. Replacing them with a single provider, raising concurrency to match provider count, or bypassing review/CI would reduce reliability rather than improve throughput.

## Main allowance risk found: one issue/hour was not an AI budget

The largest gap was the mismatch between **issue admission** and **agent execution**.

A newly admitted issue can fan out into several AI-backed phases:

```text
implementation
  -> security review
  -> verification
  -> quality repair (when needed)
  -> independent review
  -> CI repair (when needed)
  -> independent review again
```

Before this PR, the conservative router limited each phase to two providers, but the base routing policy still allowed an immediate same-provider transient retry. A single logical phase could therefore start up to four provider processes:

```text
primary attempt
primary retry
fallback attempt
fallback retry
```

There was no durable hourly cap covering the sum of implementation, security, repair, review and architect routes. Consequently, `1 issue/hour` could still produce a large and unpredictable number of subscription-consuming provider attempts.

### Change

This PR adds a restart-safe global AI-route gate:

```text
FACTORY_AGENT_ROUTE_INTERVAL_SECONDS=3600
FACTORY_AGENT_ROUTES_PER_INTERVAL=6
```

The state is persisted in:

```text
agent-route-admissions.json
```

The gate sits outside the normal task-attempt accounting. Exhaustion raises `ProviderCapacityUnavailable`, so the job remains recoverable and is scheduled for the persisted next admission expiry instead of being counted as a failed implementation.

Six route starts per hour is intended to support the normal successful issue path plus the two-review lane and still retain some recovery capacity.

## Provider failure burst risk

Immediate same-provider retry is useful in an unconstrained service but inefficient when the limiting resource is a human subscription allowance.

### Change

Under the conservative production policy:

- immediate same-provider retry is forced to `0`;
- the preferred provider is attempted once;
- at most one distinct fallback provider may be attempted in the same route;
- durable scheduler retries can revisit providers after cooldown/health changes.

This changes the worst-case route cascade from four immediate provider starts to two while preserving fallback diversity.

With six route admissions/hour, the hard pathological upper bound is therefore 12 provider starts/hour if every route reaches its fallback. Healthy first-choice execution normally consumes six or fewer starts. This is intentionally a route-level budget because the current provider-neutral router owns fallback internally.

### Recommended later refinement

Move the durable admission hook one level deeper, immediately before each `provider.run()`, so production can optionally enforce an exact provider-process-attempt budget rather than the current route budget. That requires a provider-attempt admission hook in the base router and should be implemented with focused concurrency tests rather than by wrapping provider objects or weakening failure classification.

## Prompt volume risk

Provider allowance is consumed not only by how often agents run but by how much text the Factory sends on every call.

The previous implementation permitted:

- up to 160,000 characters of shared implementation context;
- an unbounded GitHub issue/PR body outside that context cap;
- unbounded phase-specific `extra` evidence.

Large generated issue bodies, Dependabot release notes, copied logs, or long repair evidence could therefore dominate an otherwise small task.

### Change

The Factory now bounds provider input deterministically:

```text
shared implementation prompt/context: 48,000 characters total budget
GitHub task/PR body:               24,000 characters
phase-specific evidence:            8,000 characters
```

Oversized task/evidence text keeps the beginning and the end with an explicit omission marker. This is preferable to keeping only the beginning because acceptance criteria and verification/rollback notes are often appended near the end of generated issues and PR bodies.

These are character limits rather than invented token numbers. Claude, Codex, Google, OpenCode and Pi do not expose one common exact tokenizer or reliable remaining-subscription-quota API.

## Model-tier audit

No provider-order rewrite is required in this PR.

The production configuration already does the important thing:

- Claude architecture/planning uses Opus, implementation uses Sonnet, review/repair use Haiku-class tiers.
- Google uses Pro/high for build-critical phases and Flash/low for repair/review/general work.
- Pi similarly splits Opus/Sonnet/Haiku by phase.
- OpenCode is a fast subscription fallback.
- OpenHands PAYG is disabled by default.

Changing all phases to the cheapest model would save allowance but would likely increase review rejection and repair loops, which can cost more total calls. The current phase-tiering should remain while route/prompt budgets control volume.

## GitHub Actions audit

### Canonical CI

The main `.github/workflows/ci.yml` already uses workflow concurrency with `cancel-in-progress: true`. Superseded commits on the same pull request therefore do not need another optimization layer in this PR.

The canonical matrix remains intentionally comprehensive. This audit does **not** remove backend/frontend/admin unit, lint, build, Factory, governance or merge-safety checks merely to make the Factory look faster. Deterministic CI is much cheaper than discovering defects through repeated agents.

### Mutation boundary

`scripts/audit-workflows.mjs` enforces the correct architecture: GitHub Actions must not commit/push application repository code. Current code search found application-repository `git commit` use only in the explicitly allowlisted GitHub Wiki publishers. The previously reported legacy branch-patch workflows are no longer present on current `main`.

That boundary should remain:

```text
GitHub Actions -> deterministic checks / reporting / narrowly scoped control-plane jobs
Factory on VPS  -> code mutation / repair / review / PR lifecycle
```

Reintroducing autonomous code-patching Actions would duplicate the Factory, create branch races, spend Actions minutes, and make allowance accounting incomplete.

## Dependency automation pressure

The repository currently has a substantial set of Dependabot PRs, including major-version updates. Dependabot itself is not trusted Factory intake by default, so this is not primarily an LLM-token leak. It is, however, a GitHub Actions and operator-attention multiplier because every routine dependency PR can execute the full required matrix.

### Change

Routine npm, Python and GitHub Actions version scans are changed from daily to a staggered weekly Monday window, and open PR ceilings are reduced:

```text
npm:            8 open PRs
pip:            3 open PRs
GitHub Actions: 3 open PRs
```

Docker remains weekly and is aligned into the same maintenance wave.

Security updates retain separate security grouping. Routine dependency freshness moves from continuous churn to a predictable weekly maintenance wave.

## Current main CI health

At audit time, PR #7860 is already the focused repair branch for frontend unit-test failures inherited from `main`. Its diagnosis reports a documentation-only PR reproducing 29 frontend failures across 17 suites while the other major lanes pass.

This matters to the Factory because a failed shared baseline can make unrelated PRs look repairable when their branch did not introduce the defect.

### Immediate recommendation

Treat #7860 as a high-priority repository-health fix and avoid creating a second overlapping repair in this optimization PR.

### Recommended Factory follow-up

Add **base-branch CI failure attribution** before AI-backed CI repair:

1. record/cache failing required checks for the current `origin/main` SHA;
2. when a PR fails, separate failures also failing on that exact base SHA from branch-only failures;
3. do not repeatedly ask the PR worker to repair a known base-only failure;
4. route a single dedicated `main` health repair task instead;
5. invalidate the baseline cache when `main` changes.

This is potentially one of the largest remaining token savings because one broken base check can otherwise cause many unrelated PR repair loops. It should be implemented as a separate focused change because merge-safety attribution must be exact and must never hide a branch regression that merely shares a check name.

## Architect cycle

The weekly architect/gap-analysis agent is valuable, but it is discretionary compared with implementation, review and CI repair.

### Recommendation

Make architect admission explicitly backlog-aware and idle-first:

- do not launch it while production AI capacity is busy;
- count it against the same global AI-route budget (this PR already does this through the shared conservative router);
- defer it when the route allowance is exhausted;
- prefer useful queued issue/review/repair work over speculative new backlog generation.

The shared route budget already prevents the architect from escaping allowance limits. A later daemon change can make the scheduling preference explicit without coupling the router to queue policy.

## Retry and quarantine audit

The existing separation between provider-capacity failure and task failure is correct and should be preserved.

Recommended behavior remains:

```text
provider busy/quota/rate limit/global budget -> defer, do not burn task attempt
repository/test/policy defect                -> normal bounded task/repair flow
repeated identical task failure              -> quarantine cooldown/recovery
```

The new global route gate follows this model and returns the persisted next-slot expiry where available instead of a blind one-minute retry loop.

## Deterministic-first repair audit

The CI repair state already invokes `attempt_mechanical_repair()` before an LLM. Keep expanding this pattern where confidence is high:

- formatter auto-fixes
- generated-file refreshes with deterministic generators
- lockfile normalization
- known codegen drift
- simple conflict-marker rejection

Do **not** turn semantic compiler/test failures into regex-driven auto-edits just to save tokens. A cheap incorrect repair creates another CI + review cycle and spends more allowance overall.

## Review strategy audit

Two reviews/hour is a sensible complement to one new issue/hour because review throughput must be able to clear newly created work plus externally opened PRs.

Keep:

- one concurrent AI reviewer;
- SHA-scoped durable review admission;
- cross-provider independence where possible;
- structured `.factory-review.json` as the authoritative contract;
- exact reviewed-head status before merge.

Do not raise review concurrency merely because several subscriptions are authenticated. Rate, not maximum burst parallelism, is the target.

## Metrics worth adding next

Exact cross-provider token accounting is not reliably portable, but the Factory can still measure useful allowance proxies without secrets:

- prompt characters by phase/provider
- AI route admissions/hour
- provider process starts/hour
- fallback rate
- successful first-provider rate
- repair loops per merged PR
- review rejection rate
- CI repairs caused by base-only failures
- wall-clock time from issue admission to reviewed PR
- merged PRs per 24 hours

The primary optimization objective should be **merged, verified work per provider start**, not raw agent call count or raw PR count.

## Recommended operating policy

For the current repository and subscription-backed provider pool:

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

This gives the Factory enough throughput to keep shipping while making consumption smooth and recoverable rather than bursty.

## Follow-up priority

### P0

- Land/fix the shared `main` frontend CI baseline (#7860) so unrelated PRs stop inheriting red unit checks.
- Deploy this PR's global route/prompt budget and observe merged work/provider-start ratio for several days.

### P1

- Implement base-branch CI failure attribution and one dedicated main-health repair path.
- Add provider-attempt-level durable admission hook for an exact process-start budget.
- Add prompt-character and route/fallback efficiency metrics to doctor/status output.

### P2

- Make the weekly architect explicitly idle/backlog-aware in daemon scheduling.
- Use measured provider success/fallback/repair data to tune phase ordering, without ML or opaque scoring.
- Consider task-complexity tiers only after the simple rate policy has enough production data.

## Acceptance criteria for this audit PR

- [x] Existing multi-provider architecture preserved.
- [x] One issue/hour remains the new-work intake rate.
- [x] Global AI-backed route rate is durably bounded.
- [x] Immediate same-provider retry is removed under conservative production policy.
- [x] One distinct fallback remains available.
- [x] Prompt/context volume is bounded before provider execution.
- [x] Review rate and cross-provider review safety are preserved.
- [x] GitHub Actions required CI is not weakened.
- [x] Routine Dependabot churn is batched.
- [x] Resource exhaustion remains a deferral, not a permanent task failure.
- [x] Tests cover route budgeting and prompt truncation.
- [x] Remaining higher-risk optimizations are documented separately rather than being smuggled into merge-safety code.
