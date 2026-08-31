# Project linting contract

## Purpose

The backend and main Angular frontend both expose `npm run lint`. Historically those commands may apply safe ESLint auto-fixes, so a successful exit code alone does not prove that the checked-out revision was already lint-clean. CI therefore verifies both forms of the contract:

1. the existing non-mutating `npm run lint:check` gate must pass; and
2. the exact developer-facing `npm run lint` command must complete without changing or creating files in its project tree.

This closes the gap where CI could report a successful lint command after silently repairing source in the ephemeral runner.

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
- canonical CI continues to run each project's `lint:check`;
- the clean-lint workflow covers both projects;
- the clean-lint workflow runs `npm run lint` from the matrix project;
- the post-lint working-tree assertion remains project-scoped and failure-producing; and
- lint/clean-tree failures are not weakened with `continue-on-error` or `|| true`.

The guard has Node-native regression tests so workflow drift fails before a misleading green lint gate can be merged.

## Local verification

From the repository root, contributors can run the read-only checks with:

```bash
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
