# CI determinism audit: roadmap stages 5-8

This document records the repository-wide audit for CI/testing hardening roadmap stages 5 through 8.

## Stage 5: npm installation determinism

Audit target: every npm-based GitHub Actions job.

Findings:

- Canonical backend and frontend CI installs dependencies with `npm ci --legacy-peer-deps` against committed lockfiles.
- Canonical constitution/governance CI installs root dependencies with `npm ci --ignore-scripts`.
- Admin portal CI uses `npm ci --no-audit --no-fund` against `admin-portal/package-lock.json`.
- Admin backend jobs use `npm ci --legacy-peer-deps` against `backend/package-lock.json`.
- The workflow audit found no remaining `npm install` command in `.github/workflows` that should be converted to `npm ci`.

Contract: CI must use `npm ci` for npm workspaces with committed lockfiles. `npm install` is not an accepted CI dependency-install command because it may mutate lock resolution.

## Stage 6: Python dependency determinism

Audit target: every Python CI job.

Findings:

- The canonical Factory job uses Python 3.13 with `astral-sh/setup-uv` pinned to an immutable action SHA.
- Factory dependencies are installed from `automation/uv.lock` using `uv sync --frozen --extra development`.
- Ruff, mypy, and pytest execute with `uv run --frozen`, preventing resolver drift during verification.
- No additional Python dependency-resolution path is required for canonical CI.

Contract: Python CI must consume the committed `automation/uv.lock` in frozen mode. New Python CI jobs must not introduce unpinned ad-hoc resolver installs where the locked Factory environment can be reused.

## Stage 7: duplicate non-canonical verification

Audit target: non-canonical workflows that repeat canonical verification without adding a narrower product boundary or independent signal.

Findings:

- Canonical application verification remains owned by `.github/workflows/ci.yml`.
- Admin portal CI retains scoped portal and admin-backend checks because they provide path-focused, separately named signals for the admin surface rather than replacing canonical CI.
- The former duplicate full-backend build in Admin portal CI has already been removed; backend build authority remains canonical CI.
- Workflow-specific validation remains in its owning workflow only where it protects that workflow's distinct responsibility.

Contract: non-canonical workflows may run focused checks for their own surface, but must not duplicate the full canonical backend/frontend verification matrix merely as an additional merge gate.

## Stage 8: deploy the exact tested SHA

Audit target: every deploy/release path that publishes production images.

Findings:

- `Deploy` is triggered from successful completion of canonical `CI` on `main`.
- The deploy job captures `github.event.workflow_run.head_sha` as the tested SHA.
- Before building, the workflow verifies that the tested SHA is still the current `main` SHA and skips stale successful runs.
- Checkout explicitly uses `ref: ${{ github.event.workflow_run.head_sha }}`.
- Production API and web images are tagged with that same tested SHA in addition to `latest`.
- Shared deployment concurrency cancels older in-progress main deployments so stale commits cannot race a newer tested commit for `latest`.

Contract: deploy/release workflows must build and publish the exact SHA that passed the required CI gate. They must not re-resolve a moving branch name after CI completion.

## Re-audit triggers

Re-run this audit whenever any of the following changes:

- a new npm or Python workspace is added;
- a workflow introduces a new dependency-install command;
- a non-canonical workflow begins running backend/frontend verification;
- deploy/release trigger, checkout, image-tag, or concurrency semantics change.
