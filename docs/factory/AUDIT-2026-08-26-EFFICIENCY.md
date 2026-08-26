# Factory allowance-efficiency audit: 2026-08-26

## Goal

Increase verified engineering output per unit of constrained agent and CI capacity without weakening independent review, deterministic verification, exact-head merge safety, or fail-open behaviour.

This audit was performed against current `main`, after the 2026-08-25 efficiency changes were merged. The provider router, conservative admission policy, phase-specific prompt ceilings, circuit breakers, worktree lifecycle, review lane, and merge gates were rechecked before choosing another optimisation target.

## Current controls preserved

The Factory already has strong allowance controls and this pass does not reduce them further:

- at most one newly admitted issue per configured production interval;
- six AI-backed routes per hour globally under the conservative policy;
- four AI-backed routes per task per hour by default, preventing a broken task from monopolising allowance;
- two global agent slots and one independent-review slot;
- two provider candidates per route and no immediate same-provider retry in conservative production mode;
- phase-specific model/reasoning tiers and bounded prompt bodies;
- durable provider health/circuit breaking and provider-specific concurrency;
- mechanical CI repair before agent-backed CI repair;
- independent review, deterministic verification, required CI, and exact reviewed-head merge checks.

The best remaining high-confidence saving was therefore outside model routing itself: GitHub Actions fan-out caused by Factory-only workflow edits.

## Finding: Factory-only workflow changes were classified as application changes

Both `.github/workflows/ci.yml` and `.github/workflows/clean-project-lint.yml` independently implemented the same path classifier. They treated `automation/`, `docs/`, Factory configuration, systemd configuration, and Dependabot metadata as application-neutral, but every other `.github/workflows/*` path failed open to application verification.

That meant changes to control-plane workflows such as:

- `.github/workflows/factory-merge.yml`;
- `.github/workflows/factory-format-evidence.yml`;
- `.github/workflows/on-failure.yml`;
- `.github/workflows/branch-pr-hygiene.yml`;

launched the full backend/frontend/admin application matrix even though those files do not change product runtime code. The 2026-08-25 Factory efficiency PR directly demonstrated this: its Factory recovery-workflow edits caused the canonical ten-job application matrix to run.

The same classification was duplicated in Clean project lint, so a qualifying Factory-only change also launched the lint-contract job plus backend and frontend clean-lint jobs.

## Change made

### 1. One tested impact classifier

`scripts/classify-ci-impact.sh` is now the shared classifier for canonical CI and Clean project lint.

It keeps the existing conservative contract:

- application/backend/frontend/admin/shared/unknown paths require application verification;
- `automation/`, `config/factory/`, and `config/systemd/` require Factory verification without the application matrix;
- documentation and Dependabot metadata remain application-neutral;
- the four explicitly enumerated Factory/control-plane workflows are application-neutral but still require Factory verification;
- changing `.github/workflows/ci.yml` itself requires both application and Factory verification;
- an empty/unreadable diff fails open to both groups;
- unknown workflow files still fail open to application verification.

The allowlist is intentionally exact rather than treating all workflow files as safe. Product, deployment, database, frontend, backend, or future unknown workflows therefore retain the conservative full-application default.

### 2. Regression coverage runs before classification

`scripts/classify-ci-impact.test.sh` covers Factory Python/configuration, the exact Factory workflow allowlist, docs-only changes, application changes, mixed changes, the canonical CI workflow, an unknown workflow, classifier self-changes, and an empty diff.

Canonical CI runs this regression suite in its impact job before trusting the classifier output. The test uses only Bash and core utilities, so it adds no package installation or dependency-resolution step.

### 3. Removed classifier drift between workflows

Clean project lint now calls the same classifier instead of carrying its own shell `case` statement. Future path-policy changes therefore have one implementation and one regression suite rather than two subtly diverging copies.

## Deterministic efficiency gain

For a PR whose changed paths are limited to the explicitly recognised Factory/control-plane surface, the new classifier avoids:

- 10 canonical application matrix jobs: backend lint/build/unit/e2e, frontend static-analysis/build/unit, and admin lint/build/unit;
- 1 Clean project lint contract job;
- 2 Clean project lint application jobs: backend and frontend;
- 12 project dependency installations (`npm ci`) across those skipped application jobs.

That is **13 GitHub Actions runner jobs and 12 project dependency installations avoided per qualifying Factory-only PR**.

This is a deterministic job-count reduction. No runner-minute, monetary, energy, or token estimate is claimed without measured workflow-duration/billing data.

Factory Python verification, workflow-specific checks, constitution/governance checks, the canonical required gate, and fail-open behaviour remain in place. Pushes and merge-queue candidates still run full health checks.

## Other findings

### Provider/resource policy remains appropriately conservative

The current conservative router already caps global routes, per-task routes, candidate count, provider retries, global concurrency, and review concurrency. Further blanket reductions would lower useful throughput without evidence that those controls are the current source of allowance exhaustion.

### Monetary budget configuration remains non-authoritative for subscriptions

The repository still contains USD-oriented budget fields/helper logic, but subscription CLIs do not expose a common authoritative remaining-dollar balance. The durable route-admission gates remain the enforceable production allowance control. This audit does not wire invented cost estimates into scheduling.

### PR-convergence work should stay separate

The previously open PR #7897 for broader PR churn/convergence was closed without merge. Its large scope is not silently recreated here. PR backlog/convergence should be reassessed against current `main` as a separate change rather than mixing it into this CI classifier optimisation.

## Validation

The change is intentionally self-validating:

- the classifier regression suite runs before canonical CI trusts classifier output;
- this PR changes `.github/workflows/ci.yml`, so the classifier deliberately requires the full application and Factory verification groups for this PR itself;
- unknown paths and unknown workflows remain fail-open;
- pushes and merge-queue candidates remain full health checks.

GitHub Actions on the pull-request head is authoritative for workflow syntax, Factory Ruff/mypy/pytest, application verification, and repository governance checks.

## Next measurements

Continue measuring merged verified work per constrained agent route rather than raw model-call rate. Useful next signals are provider fallback frequency, routes consumed per merged PR, repair-loop count, time with all providers unavailable, queue age, and the frequency with which CI impact classification can safely avoid unrelated product jobs.
