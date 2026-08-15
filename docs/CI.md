# Continuous integration contract

The `CI` GitHub Actions workflow is the canonical verification authority for application changes.

## Required canonical checks

The workflow runs the following independent checks so failures remain attributable:

- backend lint
- backend build
- backend unit tests
- backend E2E tests
- frontend static analysis and lint
- frontend build
- frontend unit tests
- constitution checks
- OpenHands Factory Ruff, mypy, and pytest verification

The final `CI gate` job succeeds only when all canonical groups have succeeded. Branch protection should require `CI gate` rather than depending on a moving list of implementation-level matrix job names.

## Concurrency

Superseded runs for the same pull request or branch are cancelled. This reduces runner waste and prevents stale results from competing with the newest commit. Independent matrix checks within the active run continue with `fail-fast: false`, so one failing component does not hide results from other checks.

## Deployment contract

Deployment must consume the result of canonical CI rather than maintaining a second verification pipeline. Production image workflows should build the exact commit SHA that passed CI and should not publish images from failed or cancelled CI runs.

## Dependency installation

CI should use committed lockfiles and deterministic install commands. Node workspaces should prefer `npm ci`; workflows must not use mutating lint or install commands as an implicit way to repair source files during CI.

## Workflow changes

Changes under `.github/workflows/` are validated by the `Workflow lint` actionlint check. Shell and expression values should be passed into scripts through environment variables and quoted rather than directly interpolating potentially untrusted event metadata.

## Adding or changing tests

New product behaviour should normally add or update the closest relevant unit, integration, or E2E tests. A new check should be separately visible when that improves diagnosis, but avoid introducing another duplicate implementation of the same verification contract.

## Failure policy

A failing canonical check should be fixed at its source. Do not make a required check non-blocking, add broad `continue-on-error`, reintroduce mutating CI commands, or remove test coverage merely to make Actions green.
