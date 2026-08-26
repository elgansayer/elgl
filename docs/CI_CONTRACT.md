# Canonical CI contract

This document defines the merge-critical continuous-integration contract for `elgansayer/elgl`.

## Canonical workflow

`.github/workflows/ci.yml` is the canonical application CI workflow for pull requests targeting `main` and pushes to `main` or `develop`.

The workflow deliberately exposes one stable aggregate check named **`CI / required`**. Individual matrix jobs remain visible for diagnosis, but automation and branch protection should key merge eligibility to the stable aggregate check rather than to matrix-generated job names.

## Required canonical groups

`CI / required` waits for all canonical groups and fails unless every group relevant to the current change succeeds:

- `application-checks`: backend lint, build, unit and E2E checks plus frontend static analysis, build and unit checks and admin-portal lint, build and unit checks.
- `constitution`: repository policy checks, conflict-marker detection, admin-audit integrity and migration-delta integrity. This group remains unconditional.
- `database`: clean migration replay and generated schema evidence when database-sensitive paths change; its job remains present when the expensive database steps are not required.
- `factory`: frozen Python dependency sync followed by Ruff, mypy and pytest for the OpenHands Factory automation when Factory-sensitive paths change.

The aggregate job uses `if: always()` so an upstream failure produces an explicit failed `CI / required` result instead of silently skipping the merge gate.

## Pull-request impact classification

Pull requests use a fail-open impact classifier before expensive canonical groups start. It exists to avoid paying for application and Factory verification that cannot be affected by the PR while keeping one stable merge gate.

The application matrix may be skipped only when every changed path is limited to the following non-application areas:

```text
automation/
docs/
config/factory/
config/systemd/
.github/dependabot.yml
```

Any unknown or shared path requires the full application matrix. Editing `.github/workflows/ci.yml` therefore runs the full matrix rather than testing a CI change against its own skip rule.

Factory verification runs for changes under `automation/`, `config/factory/`, `config/systemd/`, or the canonical CI workflow itself. Database verification retains its narrower database-sensitive detector.

Pushes to `main`/`develop` and merge-queue candidates always run the full application and Factory groups. Path-sensitive savings apply only to pull requests, so the repository still receives a complete health check before/after integration.

When an optional-for-this-PR canonical group is skipped, `CI / required` accepts `skipped` for that group. A group classified as required must still be exactly `success`; failure, cancellation or accidental skipping fails the aggregate gate.

## Standalone workflow impact gates

Standalone application contracts such as E2E runner discovery, core product-flow discovery, Core Compose and clean-project lint keep their existing workflow triggers and check identities. Their expensive jobs use the same fail-open PR classification so Factory/docs-only changes pay only for a lightweight impact job.

This is intentionally different from workflow-level `paths-ignore`. Keeping the workflow present avoids creating a missing required-check context if repository rules later require one of these checks. Pushes and merge-queue runs still execute the full contract jobs.

## Determinism and resource bounds

Canonical Node jobs install from committed lockfiles with `npm ci`. Factory dependencies are installed from `automation/uv.lock` using `uv sync --frozen`. Jobs have explicit timeouts, and the workflows use concurrency cancellation so superseded runs for the same pull request or branch do not continue consuming CI capacity.

Failure-oriented test reports and the canonical group summary are diagnostic artifacts only. They do not weaken pass/fail semantics.

## Merge policy

A change must not be merged while `CI / required` is missing, pending, cancelled or failed. Factory merge automation also fails closed unless `CI / required` is explicitly successful.

Repository branch protection or rulesets for `main` should require the stable `CI / required` context. Workflow-specific checks such as workflow lint or admin-portal CI may additionally be required when GitHub rules can scope them reliably to relevant path changes; informational security/audit workflows should not be promoted to merge-blocking status merely to clear historical baseline debt.

The GitHub repository configuration is the source of truth for whether a required context is actually enforced. The existence of `CI / required` in the workflow alone does **not** mean branch protection is enforcing it.

## Change-management rules

When changing canonical CI:

1. Keep `CI / required` as the stable aggregate check name unless branch protection is migrated atomically.
2. Do not remove a canonical group from `required-gate.needs` without an explicit roadmap decision.
3. Fail open to the full verification set when impact classification is uncertain.
4. Do not make pull-request path savings suppress full push or merge-queue health checks.
5. Do not replace lockfile-backed installs with fresh dependency resolution.
6. Do not suppress deterministic test, lint, build or type-check failures to make CI green.
7. Prefer focused fixes and update existing work instead of creating current-main replay PRs solely because `main` advanced.
8. Merge only after the PR head SHA has completed the required checks successfully.

## Verification

For a candidate PR, verify the check rollup for its current head SHA and confirm `CI / required` is successful before merge. The canonical summary should show which groups were required for that PR. After merge, verify the canonical `CI` push run on the resulting `main` SHA. A prior green SHA is not evidence that the new `main` SHA is green.

This contract implements CI/testing hardening roadmap stage 10 from issue #5365 and complements the aggregate-gate work from #6696 and Factory merge fail-closed work from #6977.
