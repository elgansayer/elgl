# AI Swarm Workflow System

## Architecture Overview

The HelloTalk AI swarm is a fully autonomous software engineering pipeline. It accepts issues, writes code, verifies correctness, reviews pull requests, fixes failures inline, and merges - all without human intervention. When things break on `main`, it reverts automatically and notifies the responsible PR.

Every workflow enforces the same hard rule from the [AGENTS.md](../AGENTS.md) constitution: **fix in the original PR branch, never create follow-up "Fixes:" PRs.**

---

## Workflow Inventory (14 total)

### Core AI Pipeline (6 workflows)

| #   | File                     | Role                                                        | Trigger                           |
| --- | ------------------------ | ----------------------------------------------------------- | --------------------------------- |
| 1   | `openhands.yml`          | **AI Auto-Resolver** - fixes issues, creates PRs            | `/openhands-fix` comment on issue |
| 2   | `resolver-fast.yml`      | **AI Fast Resolver** - same, faster timeout                 | `/fast-fix` comment on issue      |
| 3   | `pr-reviewer.yml`        | **PR Reviewer** - reviews, fixes, merges PRs                | `pull_request:opened,reopened`    |
| 4   | `reviewer-fast.yml`      | **Fast PR Reviewer** - reviews pushes, rebases stale PRs    | `pull_request:synchronize` + cron |
| 5   | `scheduled-pr-fixer.yml` | **Stale PR Fixer** - rebases open PRs (manual trigger only) | `workflow_dispatch`               |
| 6   | `guardian.yml`           | **Build Health Monitor** - reverts `main` breakage          | cron `*/5 * * * *`                |

### Dispatch & Monitoring (4 workflows)

| #   | File                   | Role                                              | Trigger                            |
| --- | ---------------------- | ------------------------------------------------- | ---------------------------------- |
| 7   | `auto-dispatcher.yml`  | Picks 1 open issue, adds `/openhands-fix` comment | cron `*/5` + resolver-complete     |
| 8   | `dispatcher-batch.yml` | Batch-dispaches up to 100 issues with `/fast-fix` | cron `*/2` + manual                |
| 9   | `on-failure.yml`       | Reports workflow failures as informational issues | `workflow_run:completed` (failure) |
| 10  | `architect.yml`        | Weekly codebase exploration, creates gap issues   | weekly cron + manual               |

### CI/CD (4 workflows)

| #   | File                    | Role                                                   |
| --- | ----------------------- | ------------------------------------------------------ |
| 11  | `ci.yml`                | Lint backend + frontend on push/PR to `main`/`develop` |
| 12  | `deploy.yml`            | Build, test, Docker build+publish to ghcr.io           |
| 13  | `daily-wiki-update.yml` | Updates GitHub Wiki with feature lists                 |
| 14  | `wiki-sync.yml`         | Syncs docs to Wiki on push to `main`                   |

---

## The Six Core Flows

### Flow 1: PR Is Opened

```
pull_request:opened
  → pr-reviewer.yml (timeout: 60 min)
    → Checkout PR branch
    → Tier 1 (Claude): review → lint → build → test → fix inline → merge
    → Tier 2 (DeepSeek): fallback if Claude failed or PR not merged
    → Tier 3 (Gemini): last-resort fallback
    → Hard gate: if PR still OPEN → comment "needs manual review"
```

**Key properties:**

- Always works on the **same PR branch** - never creates a new branch
- Commit flow: fix → push to same branch → re-verify → merge
- `cancel-in-progress: false` - won't kill in-progress fixes
- `gh pr merge --squash --delete-branch` - only merge path for PRs

### Flow 2: Push to Open PR (synchronize)

```
pull_request:synchronize
  → reviewer-fast.yml (timeout: 45 min)
    → Wait for pending checks (max 5 min)
    → Merge PR branch with main (catches drift)
    → Tier 1 (Claude): review → lint → build → test → fix → merge
    → Tier 2 (DeepSeek): fallback
    → Tier 3 (Gemini): last resort
    → Hard gate: flag if still open
```

**Key properties:**

- Triggers on `synchronize` only (not `opened`/`reopened` - those are handled by `pr-reviewer.yml`)
- The "Safe merge with main" step prevents merge-conflict surprises
- Same inline-fix-only policy

### Flow 3: Issue Created (Resolver)

```
Issue with ai-agent-task or priority:high label
  → auto-dispatcher.yml (every 5 min, max 3 concurrent resolvers)
    → Adds /openhands-fix comment
      → openhands.yml (timeout: 60 min)
        → INLINE FIX PROTOCOL: check for existing PR first
        → If PR exists: checkout that branch, fix inline, push
        → If no PR: create new branch + PR
        → Tier 1 (Claude): lint → build → test → check:control-flow → check:rtl-logical
        → Tier 2 (DeepSeek): fallback
        → Tier 3 (Gemini): last resort
```

**Key properties:**

- **Inline-fix-first**: before creating a PR, checks `gh pr list --search "Fixes #ISSUE in:body"`
- Only creates a new PR if none exists - prevents duplicate "Fixes:" PRs
- Full verification suite (lint, build, test, control-flow, RTL, template bindings)
- No more `pull_request` or `issues` event triggers - gated by `/openhands-fix` comment only

### Flow 4: Main Breaks Post-Merge

```
guardian.yml (every 5 min)
  → Build + test backend and frontend on main
  → If failure:
    → Find merge commits from last 2 hours (or last 5 commits)
    → git revert each one (skip conflicts)
    → Push revert to main
    → Create guardian-alert issue (informational, NO /openhands-fix)
    → Comment on each reverted PR
```

**Key properties:**

- **Reverts, doesn't spawn**: pushes revert commits to main instead of creating fix issues
- `guardian-alert` label prevents auto-dispatcher from picking up the notification issue
- Loop guard: if last commit is already a `Revert "..."`, skips to avoid revert/revert cycles
- Checks for existing open issue before creating a new one (dedup)

### Flow 5: Workflow Fails

```
workflow_run:completed (failure)
  → on-failure.yml
    → Excludes: Self-Healing Workflow Monitor, AI Auto-Resolver,
      AI PR Reviewer & Fixer, Swarm Auto-Dispatcher
    → Creates guardian-alert issue (NO /openhands-fix)
```

**Key properties:**

- Purely informational - no automatic fix cascade
- Filters out self-referential failures to prevent infinite loops
- Has explicit `permissions: issues: write` block

### Flow 6: Stale PRs (Rebasing)

```
reviewer-fast.yml fix_stale_prs (every 15 min)
  → fix-rejected-prs.sh
    → List all open PRs
    → For each (parallel, max 20 workers):
      → Create git worktree → checkout PR branch
      → git rebase origin/main
      → If clean: push rebased branch → wait for checks
      → If conflicts: abort, leave for AI reviewer
    → NEVER auto-merges
```

**Key properties:**

- Rebase-only, never merge - the PR reviewer is the sole merge authority
- Never commits conflict markers (aborts on conflict)
- Also available manually via `scheduled-pr-fixer.yml` (workflow_dispatch)

---

## Label Gating System

Labels control whether an issue enters the AI pipeline:

| Label             | Meaning                                | Dispatcher picks up?            |
| ----------------- | -------------------------------------- | ------------------------------- |
| `priority:high`   | High-priority swarm task               | **Yes**                         |
| `priority:medium` | Medium-priority swarm task             | **Yes**                         |
| `priority:low`    | Low-priority swarm task                | **Yes**                         |
| `ai-agent-task`   | Architect-generated task               | **Yes** (via priority label)    |
| `swarm-active`    | Currently being worked on              | **No** (excluded by search)     |
| `guardian-alert`  | Informational only (reverts, failures) | **No** (not in search criteria) |

**Auto-dispatcher search order:**

1. `priority:high` (without `swarm-active`)
2. Unlabelled (without `swarm-active` or any priority)
3. `priority:medium` (without `swarm-active`)
4. `priority:low` (without `swarm-active`)

Each issue gets `swarm-active` label when dispatched, preventing duplicate dispatch.

---

## AI Tier Fallback Chain

Every resolver and reviewer uses a 3-tier AI fallback chain:

| Tier | Model                      | Action                    | Fallthrough condition                                                                            |
| ---- | -------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| 1    | Claude (Claude Code OAuth) | Primary resolver/reviewer | `primary.outcome == 'failure'`                                                                   |
| 2    | DeepSeek V4 Pro            | Heavy-lifting fallback    | `primary.outcome == 'failure' \|\| check_claude.outcome == 'failure' \|\| pr not merged/created` |
| 3    | Gemini 3.5 Flash           | Last resort               | `secondary.outcome == 'failure'`                                                                 |

**Hard gate** (reviewers only): After all 3 tiers, if PR is still `OPEN`, comments "needs manual review."

**Critical condition details:**

- Tier 2 always fires if `check_claude` step itself fails (e.g., gh CLI auth error)
- Tier 2 fires if Claude "succeeded" but PR was not merged/created
- Tier 3 has no `continue-on-error` - if it fails, the workflow fails (correctly)

---

## Verification Gates

Each resolver/reviewer tier runs verification before committing:

### Resolver (openhands.yml) - Full Suite in Tier 1

```
1. cd backend && npm run lint && npm run build && npm test
2. cd frontend && npm run lint && npx ng build && npm test -- --watch=false
3. npm run check:control-flow
4. npm run check:rtl-logical
5. npm run check:template-bindings
6. Scan for conflict markers (<<<<<<<, =======, >>>>>>>)
```

### PR Reviewer (pr-reviewer.yml + reviewer-fast.yml) - Core Suite

```
1. cd backend && npm run lint && npm run build && npm test
2. cd frontend && npm run lint && npx ng build && npm test -- --watch=false
3. Remove conflict markers
```

### Loop: Fix → Verify → Repeat

If ANY step fails, the AI fixes the code and restarts from step 1. Only proceeds when ALL steps pass.

---

## Race Condition Mitigations

| Risk                                                | Mitigation                                                                                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| PR reviewer + fast reviewer both merge same PR      | `pr-reviewer` handles `opened`, `reviewer-fast` handles `synchronize`. Push from pr-reviewer triggers reviewer-fast, but `check_merged` catches already-merged PRs |
| Guardian reverts while reviewer fixes               | Reviewer re-verifies before merging (build+test on latest main). If fix is wrong, guardian reverts again. Dedup prevents duplicate issues                          |
| Multiple `/openhands-fix` on same issue             | Per-issue concurrency with `cancel-in-progress: false`. Second run queues                                                                                          |
| `fix-rejected-prs.sh` rebases while reviewer merges | Script only rebases, never merges. Reviewer handles merge independently                                                                                            |
| `gh pr checks --watch` hangs                        | Wrapped in `timeout 600` (10 min max)                                                                                                                              |

---

## Secrets & Environment Variables

| Secret/Var                | Used by                                              | Purpose                                   |
| ------------------------- | ---------------------------------------------------- | ----------------------------------------- |
| `PAT_TOKEN`               | All AI workflows                                     | `gh` CLI operations (issues, PRs, merges) |
| `CLAUDE_CODE_OAUTH_TOKEN` | resolver-fast, reviewer-fast, openhands, pr-reviewer | Claude Code OAuth authentication          |
| `DEEPSEEK_API_KEY`        | resolver-fast, reviewer-fast, openhands, pr-reviewer | DeepSeek V4 Pro API                       |
| `GEMINI_API_KEY`          | resolver-fast, reviewer-fast, openhands, pr-reviewer | Gemini 3.5 Flash API                      |
| `vars.SKIP_CLAUDE`        | resolver-fast, reviewer-fast                         | Repo variable to bypass Claude tier       |

---

## Audit Trail (What Changed)

### Original problems (pre-audit):

1. "Fixes:" PRs created for issues that already had open PRs
2. Guardian detected `main` failure → spawned `/openhands-fix` → generated follow-up fix PRs
3. `fix-rejected-prs.sh` auto-merged PRs after rebase, bypassing AI reviewer verification
4. Both PR reviewers fired on identical triggers (double-run)
5. `pull_request` and `issues` event triggers bypassed dispatcher gating

### Fixes applied (this audit):

1. **Inline-fix protocol**: All resolver tiers check for existing PR before creating new
2. **Guardian reverts, not spawns**: Pushes `git revert` to main, uses `guardian-alert` label
3. **No auto-merge in fixer**: Script only rebases, PR reviewer handles all merges
4. **Distinct PR reviewer triggers**: `pr-reviewer` on `opened`, `reviewer-fast` on `synchronize`
5. **Gated resolver**: Only `/openhands-fix` comments trigger, not `issues` or `pull_request` events
6. **Label isolation**: `guardian-alert` label prevents dispatcher from picking up informational issues
7. **Lint coverage**: Added `npm run lint` to all `reviewer-fast` tier prompts
8. **Hard failure gates**: All reviewers report if PR still open after 3 tiers exhaust
9. **Timeout wrappers**: `timeout 600` on all `gh pr checks --watch` calls
10. **Condition hardening**: Tier 2 fires when `check_claude` itself fails
11. **`set -e` safety**: `wait || true` in `fix-rejected-prs.sh` final wait
12. **Label creation**: Guardian and on-failure create `guardian-alert` label before using
13. **Missing timeout**: Added `timeout-minutes: 60` to `openhands.yml`
14. **Missing permissions**: Added `permissions: issues: write` to `on-failure.yml`
15. **Stuck Label Cleanup**: Added `always()` step to `openhands.yml` and `resolver-fast.yml` to remove `swarm-active` if the resolver fails without creating a PR.
16. **Strict Dispatcher Isolation**: Added `-label:guardian-alert` to dispatcher search queries to prevent the batch dispatcher from picking up informational alerts.
17. **Automated Conflict Resolution**: `fix-rejected-prs.sh` now automatically pushes an empty commit using `PAT_TOKEN` to trigger `pull_request:synchronize` and wake up the AI Reviewer when it encounters a rebase conflict.
18. **Reviewer Lint Coverage**: Enforced `npm run lint` across all Tiers (2 and 3) of `pr-reviewer.yml` and `reviewer-fast.yml`.

---

## Quick Reference: Trigger Map

```
pull_request:opened           → pr-reviewer.yml
pull_request:reopened         → pr-reviewer.yml
pull_request:synchronize      → reviewer-fast.yml
/opendhands-fix comment       → openhands.yml
/fast-fix comment             → resolver-fast.yml
cron */5 (guardian)           → guardian.yml
cron */15 (stale PR fixer)    → reviewer-fast.yml fix_stale_prs
cron */5 (dispatcher)         → auto-dispatcher.yml
cron */2 (batch dispatcher)   → dispatcher-batch.yml
workflow_run (failure)        → on-failure.yml
workflow_dispatch             → scheduled-pr-fixer.yml
```

---

## Invariants (Hard Rules)

1. **Never create a follow-up "Fixes:" PR** - fix inline in the existing branch
2. **Never auto-merge after rebase** - the PR reviewer is the sole merge authority
3. **Never commit conflict markers** (`<<<<<<<`, `=======`, `>>>>>>>`)
4. **Never merge without full verification** (lint + build + test)
5. **Never use `--admin` for merge** - `--squash --delete-branch` only
6. **Guardian issues never trigger resolver** - `guardian-alert` label isolates them
7. **No `console.log` in code** - `no-console: error` in ESLint
8. **No `any` type** - `@typescript-eslint/no-explicit-any: error`
