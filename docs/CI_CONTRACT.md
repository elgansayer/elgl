# Canonical CI contract

This document defines the merge-critical continuous-integration contract for `elgansayer/elgl`.

## Canonical workflow

`.github/workflows/ci.yml` is the canonical application CI workflow for pull requests targeting `main` and pushes to `main` or `develop`.

The workflow deliberately exposes one stable aggregate check named **`CI / required`**. Individual matrix jobs remain visible for diagnosis, but automation and branch protection should key merge eligibility to the stable aggregate check rather than to matrix-generated job names.

## Required canonical groups

`CI / required` waits for all of these groups and fails unless every group succeeds:

- `application-checks`: backend lint, build, unit and E2E checks plus frontend static analysis, build and unit checks.
- `constitution`: repository policy checks, conflict-marker detection, admin-audit integrity and migration-delta integrity.
- `factory`: frozen Python dependency sync followed by Ruff, mypy and pytest for the OpenHands Factory automation.

The aggregate job uses `if: always()` so an upstream failure produces an explicit failed `CI / required` result instead of silently skipping the merge gate.

## Determinism and resource bounds

Canonical Node jobs install from committed lockfiles with `npm ci`. Factory dependencies are installed from `automation/uv.lock` using `uv sync --frozen`. Jobs have explicit timeouts, and the workflow uses concurrency cancellation so superseded runs for the same pull request or branch do not continue consuming CI capacity.

Failure-oriented test reports and the canonical group summary are diagnostic artifacts only. They do not weaken pass/fail semantics.

## Merge policy

A change must not be merged while `CI / required` is missing, pending, cancelled or failed. Factory merge automation also fails closed unless `CI / required` is explicitly successful.

Repository branch protection or rulesets for `main` should require the stable `CI / required` context. Workflow-specific checks such as workflow lint or admin-portal CI may additionally be required when GitHub rules can scope them reliably to relevant path changes; informational security/audit workflows should not be promoted to merge-blocking status merely to clear historical baseline debt.

The GitHub repository configuration is the source of truth for whether a required context is actually enforced. The existence of `CI / required` in the workflow alone does **not** mean branch protection is enforcing it.

## Change-management rules

When changing canonical CI:

1. Keep `CI / required` as the stable aggregate check name unless branch protection is migrated atomically.
2. Do not remove a canonical group from `required-gate.needs` without an explicit roadmap decision.
3. Do not replace lockfile-backed installs with fresh dependency resolution.
4. Do not suppress deterministic test, lint, build or type-check failures to make CI green.
5. Prefer focused fixes and update existing work instead of creating current-main replay PRs solely because `main` advanced.
6. Merge only after the PR head SHA has completed the required checks successfully.

## Verification

For a candidate PR, verify the check rollup for its current head SHA and confirm `CI / required` is successful before merge. After merge, verify the canonical `CI` push run on the resulting `main` SHA. A prior green SHA is not evidence that the new `main` SHA is green.

This contract implements CI/testing hardening roadmap stage 10 from issue #5365 and complements the aggregate-gate work from #6696 and Factory merge fail-closed work from #6977.
