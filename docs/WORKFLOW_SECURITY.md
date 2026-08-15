# GitHub Actions security and supply-chain audit

Audit date: 2026-08-15.

This document records the current workflow security contract and the findings that should remain true as CI evolves.

## Trigger safety

A repository-wide search found no `pull_request_target` workflow usage. Keep it that way unless a narrowly reviewed use case requires it: `pull_request_target` executes in the base-repository security context and must never run untrusted PR code with repository secrets or write permissions.

Privileged OpenHands dispatch is intentionally explicit and restricted to trusted collaborators. Public issue or review content must not by itself grant access to write-capable workflows or privileged AI credentials.

## Shell and event-data handling

Do not interpolate user-controlled GitHub event values directly into shell programs. Pass repository, issue, pull-request, branch, title, body, and similar values through step environment variables and quote all shell expansions.

Do not use shell `eval` for GitHub event content. Treat issue bodies, PR titles, comments, labels, branch names, and API responses as untrusted input.

## Permissions

Use the smallest `GITHUB_TOKEN` permission set that allows the job to work. Read-only validation jobs should declare `contents: read`. Write permissions belong only on jobs that actually publish packages, update repository state, or perform an explicitly privileged automation task.

Prefer `GITHUB_TOKEN` over a PAT whenever its permissions and event semantics are sufficient. PAT-backed workflows require a specific documented reason because their credentials can outlive a workflow run and may have broader scope.

## Action dependencies

Current high-impact action families include:

- `actions/checkout`
- `actions/setup-node`
- `actions/setup-python`
- Docker build/login/build-push actions in the production image workflow
- `anthropics/claude-code-action` in AI planning/resolution/review workflows
- `xinbenlv/openhands-action` in AI fallback workflows

Dependabot should track GitHub Actions updates. Third-party actions should move toward immutable commit-SHA pinning, especially actions with repository write access or secret access. Version tags are easier to maintain but are mutable references and therefore weaker supply-chain boundaries.

## Production dependency installation

Both production Docker build paths are lockfile based:

- `backend/Dockerfile` copies `package*.json` and uses `npm ci` for build/development and `npm ci --only=production` for the production stage.
- `frontend/Dockerfile` copies `package*.json` and uses `npm ci` for build/development before copying the built Angular assets into Nginx.

Do not replace these with `npm install` in production images. A production image must be derived from the dependency graph committed in the lockfile.

## CI mutation policy

Validation jobs must not repair the checkout. In permanent CI workflows:

- do not run ESLint/Prettier with `--fix`;
- do not generate lockfiles as a side effect of verification;
- prefer `npm ci` to `npm install` when a lockfile exists;
- do not commit or push from test/lint/build jobs;
- isolate one-off maintenance workflows and delete them immediately after use.

## Deployment trust boundary

Deployment consumes the successful canonical `CI` result on `main` and builds the exact `workflow_run.head_sha` that passed verification. Failed or cancelled CI runs must never publish production images.

## Follow-up hardening

The remaining supply-chain work is to complete an exhaustive action-reference inventory, pin appropriate third-party actions to immutable commit SHAs, keep those pins updated automatically, review PAT usage, and add non-mutating dependency/container vulnerability reporting.
