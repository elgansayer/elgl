# Project linting contract

## Purpose

The backend and main Angular frontend both expose `npm run lint`. Historically those commands may apply safe ESLint auto-fixes, so a successful exit code alone does not prove that the checked-out revision was already lint-clean. CI therefore verifies both forms of the contract:

1. the existing non-mutating `npm run lint:check` gate must pass; and
2. the exact developer-facing `npm run lint` command must complete without changing or creating files in its project tree.

This closes the gap where CI could report a successful lint command after silently repairing source in the ephemeral runner.

## What clean means

Clean means zero ESLint errors and zero file changes. It does not mean zero warnings: neither project passes `--max-warnings`, and both keep some rules at `warn` while existing code is migrated, for example the backend `no-unsafe-*` rules in `backend/eslint.config.mjs` and the frontend production `as` assertion ban in `frontend/eslint.config.js`. Warnings appear in the lint output but do not fail `lint:check` or `npm run lint`. Promoting a rule from `warn` to `error` is a separate, deliberate change once its existing violations are migrated.

`admin-portal` exposes only the non-mutating `lint:check`, which canonical CI runs as `admin-portal / lint`. It has no auto-fixing `lint` command, so it sits outside the clean-tree workflow below.

## CI behavior

`.github/workflows/clean-project-lint.yml` runs independently for `backend` and `frontend` on pull requests, merge queues, and pushes to `main` or `develop`.

For each project the workflow:

1. checks out the submitted revision;
2. installs that project's lockfile with Node 22 and `npm ci --legacy-peer-deps`;
3. runs the project's exact `npm run lint` command; and
4. inspects the project subtree with `git status --porcelain`.

Any lint error fails immediately. If lint exits successfully but modifies a tracked file or creates an untracked file, the workflow prints a bounded project-scoped status/diff and fails. The failure message instructs the contributor to run lint locally and commit the resulting fixes.

The canonical `.github/workflows/ci.yml` continues running `lint:check`. Keeping both checks is intentional: `lint:check` gives a non-mutating static-analysis failure, while the clean-tree workflow proves that the developer-facing auto-fix command has no hidden work left to do.

## Repository guard

`npm run check:lint-contract` verifies that:

- backend and frontend keep both `lint` and non-mutating `lint:check` scripts;
- canonical CI runs each project's `lint:check` as its own matrix entry, `backend / lint` and `frontend / static-analysis`;
- the clean-lint workflow covers both projects;
- the clean-lint workflow runs `npm run lint` from the matrix project;
- the post-lint working-tree assertion remains project-scoped and failure-producing; and
- lint/clean-tree failures are not weakened with `continue-on-error` or `|| true`.

The CI check reads the `directory`, `check` and `command` fields of each matrix entry together, so a `lint:check` in another project's entry, such as `admin-portal / lint`, cannot satisfy the backend or frontend requirement. `npm run lint:check` must be a whole `&&` step of the entry's command: a look-alike such as `npm run lint:check:frontend` or a tolerated failure such as `|| true` does not count. The reader understands block-style, single-line `directory`, `check` and `command` values only and needs no YAML dependency, because the guard job installs nothing. Any other shape (flow-style entries, `>-` or `|` command scalars) fails closed with the same error, so change the guard in the same pull request as such a workflow change.

The guard has Node-native regression tests, including a fixture that mirrors the canonical matrix with its `admin-portal / lint` entry, so workflow drift fails before a misleading green lint gate can be merged.

## Local verification

From the repository root, contributors can run the read-only checks with:

```bash
npm run check:lint-contract
npm run lint:check
```

To exercise the exact commands covered by the clean-tree workflow, run:

```bash
(cd backend && npm run lint)
(cd frontend && npm run lint)
git status --short -- backend frontend
```

A clean result has no lint failure and no `git status` output for either project.

## Security, privacy, and observability

Linting is a build-time repository check. It does not access production credentials, user content, databases, or network services beyond dependency installation. Workflow permissions are read-only (`contents: read`). Failure diagnostics are limited to repository paths and source diffs already present in the submitted revision; no runtime secrets or personal data are introduced by this change.

GitHub Actions records the project matrix entry and failing step, which is sufficient to correlate a lint regression without application or database access.

## Rollout and rollback

There is no runtime, API, schema, migration, or persisted-data change. The workflow can be rolled out independently of application deployments.

Rollback is a normal revert of the workflow/guard changes. Do not replace the clean-tree assertion with a tolerated auto-fix step: that would restore the false-green condition this contract is intended to prevent.
