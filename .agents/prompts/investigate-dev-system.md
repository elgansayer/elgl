# The HelloTalk AI Swarm Development System — Full Investigation & Fix

You are an AI agent tasked with understanding, auditing, and fixing the entire
HelloTalk automated development pipeline. This system comprises 14 GitHub Actions
workflows that form a fully autonomous software engineering swarm: it accepts
issues from an AI architect, writes code, verifies correctness, reviews pull
requests, fixes failures inline, and merges — all without human intervention.
When things break on `main`, a guardian detects it and reverts automatically.

Your job: investigate every component, explain how it works, find every bug,
fix every bug, and ensure the system is production-ready.

---

## 1. SYSTEM ARCHITECTURE

### The 14 Workflows

**Core AI Pipeline (6)**

```
openhands.yml        — AI Auto-Resolver (issues → code → PRs)
resolver-fast.yml    — AI Fast Resolver (same, shorter timeout)
pr-reviewer.yml      — PR Reviewer (reviews opened/reopened PRs)
reviewer-fast.yml    — Fast PR Reviewer (reviews pushes, rebases stale PRs)
scheduled-pr-fixer.yml — Stale PR Fixer (manual rebase trigger)
guardian.yml         — Build Health Monitor (reverts `main` breakage)
```

**Dispatch & Monitoring (4)**

```
auto-dispatcher.yml  — Picks 1 open issue, adds /openhands-fix comment
dispatcher-batch.yml — Batch-dispatches up to 100 issues with /fast-fix
on-failure.yml       — Reports workflow failures as informational issues
architect.yml        — Weekly codebase exploration, creates gap issues
```

**CI/CD (4)**

```
ci.yml               — Lint backend + frontend
deploy.yml           — Build, test, Docker build+publish
daily-wiki-update.yml — Updates GitHub Wiki
wiki-sync.yml        — Syncs docs to Wiki
```

### The Six Core Flows

**Flow 1: PR Opens**

```
pull_request:opened → pr-reviewer.yml
  → Checkout PR branch
  → Tier 1 (Claude): review → lint → build → test → fix inline → merge
  → Tier 2 (DeepSeek): fallback
  → Tier 3 (Gemini): last resort
  → Hard gate: if PR still OPEN → comment "needs manual review"
```

**Flow 2: Push to PR (synchronize)**

```
pull_request:synchronize → reviewer-fast.yml
  → Wait for pending checks → merge with main
  → Tier 1 (Claude) → Tier 2 (DeepSeek) → Tier 3 (Gemini)
  → Hard gate
```

**Flow 3: Issue Resolved**

```
Issue with priority:high → auto-dispatcher adds /openhands-fix
  → openhands.yml triggers on issue_comment
  → INLINE FIX PROTOCOL: check for existing PR referencing issue
  → If PR exists: checkout branch, fix inline, push
  → If no PR: create new branch + PR
  → Full verification: lint → build → test → control-flow → RTL → template
```

**Flow 4: Main Breaks**

```
guardian.yml (every 5 min) → build+test on main
  → If failure: find merge commits → git revert each → push revert
  → Create guardian-alert issue (informational, NO /openhands-fix)
  → Comment on reverted PRs
```

**Flow 5: Workflow Fails**

```
workflow_run:completed (failure) → on-failure.yml
  → Filters self-referential failures
  → Creates guardian-alert issue (NO /openhands-fix)
```

**Flow 6: Stale PRs**

```
reviewer-fast.yml fix_stale_prs (every 15 min)
  → fix-rejected-prs.sh: rebase all open PRs → push → wait for checks
  → NEVER auto-merges (only PR reviewer merges)
```

### AI Tier Fallback Chain (used by all resolvers and reviewers)

| Tier | Model                      | Fallthrough       |
| ---- | -------------------------- | ----------------- |
| 1    | Claude (Claude Code OAuth) | Fails → Tier 2    |
| 2    | DeepSeek V4 Pro            | Fails → Tier 3    |
| 3    | Gemini 3.5 Flash           | Fails → hard gate |

### Label Gating System

| Label             | Meaning                   | Dispatcher picks up?     |
| ----------------- | ------------------------- | ------------------------ |
| `priority:high`   | High-priority swarm task  | **Yes**                  |
| `priority:medium` | Medium-priority task      | **Yes**                  |
| `ai-agent-task`   | Architect-generated task  | **Yes** (via priority)   |
| `swarm-active`    | Currently being worked on | **No** (excluded)        |
| `guardian-alert`  | Informational only        | **No** (not in criteria) |

---

## 2. INVARIANTS (HARD RULES — NEVER VIOLATE)

1. Never create a follow-up "Fixes:" PR — fix inline in the existing branch
2. Never auto-merge after rebase — PR reviewer is the sole merge authority
3. Never commit conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
4. Never merge without full verification (lint + build + test)
5. Never use `--admin` for merge — `--squash --delete-branch` only
6. Guardian issues never trigger resolver — `guardian-alert` label isolates them
7. All AI prompts must include `npm run lint` before merge
8. All `gh pr checks --watch` calls must have `timeout 600` wrapper
9. Tier 2 must fire when `check_claude` step itself fails
10. `swarm-active` must be removable — stuck issues need a recovery path

---

## 3. KNOWN BUGS (Verified on Live System)

### Bug 1: swarm-active Label Never Removed

**Severity**: Critical
**Symptom**: Issues get dispatched once, receive `swarm-active`, and are
permanently stuck. If the resolver fails or the PR is merged/closed,
the issue can never be re-dispatched.
**Location**: `auto-dispatcher.yml:71`, `dispatcher-batch.yml:54`
**Fix needed**: Add a mechanism to remove `swarm-active` when:

- The PR is merged/closed
- The resolver fails after N attempts
- A timeout passes without resolution
  **Workaround**: Manually remove `swarm-active` label with `gh issue edit --remove-label`

### Bug 2: Guardian "Re-occurred" Comment Flood

**Severity**: High (fixed in latest code, verify)
**Symptom**: Old guardian code commented "Re-occurred" on existing issues every
5 minutes. Each comment triggers an `issue_comment` event → resolver fires →
skips (no `/openhands-fix`). This burned resolver concurrency slots.
**Location**: `guardian.yml:74` (old code)
**Fix**: New guardian exits silently when existing issue found. **Verify this is deployed.**

### Bug 3: PR Reviewer Fails Silently on Merge Conflicts

**Severity**: High
**Symptom**: PR reviewer runs show `completed/action_required`. PRs with
`mergeable: CONFLICTING` are left unreviewed indefinitely.
**Location**: Both `pr-reviewer.yml` and `reviewer-fast.yml`
**Fix**: New code adds "Safe merge with main" step in reviewer-fast, which
attempts merge and aborts on conflict (never commits markers). PR reviewer
prompts now instruct AI to resolve merge conflicts.

### Bug 4: Resolvers Skip on Non-/openhands-fix Comments

**Severity**: Low (by design, but wastes run slots)
**Symptom**: Every `issue_comment` event triggers a workflow run. Jobs with
non-`/openhands-fix` comments are skipped. This looks like errors but is
normal filtering. However, it burns the 3-slot resolver concurrency limit.
**Location**: `openhands.yml:13` — `on: issue_comment: [created]`
**Fix**: Filter at the `on:` level using `types:` or accept the waste.

### Bug 5: ci.yml Node Version Inconsistency

**Severity**: Medium
**Symptom**: Old `ci.yml` used Node 20 for both frontend and backend, but
frontend requires Node 22 (Angular v20+). Lint results differ between CI
and AI reviewers.
**Location**: `ci.yml:20`
**Fix**: New code uses matrix strategy with per-directory node versions.
**Verify frontend lint errors are pre-existing, not from the matrix change.**

### Bug 6: on-failure.yml Consistently Fails

**Severity**: Medium
**Symptom**: All recent on-failure runs show `completed/failure`. The
`guardian-alert` label may not exist when the issue is created, or the
PAT_TOKEN may lack permissions.
**Location**: `on-failure.yml:19`
**Fix**: New code adds `gh label create "guardian-alert"` before issue creation.
**Verify this is deployed and working.**

### Bug 7: fix-rejected-prs.sh Can't Handle Merge Conflicts

**Severity**: Medium
**Symptom**: When a PR has merge conflicts, rebase aborts. Script doesn't push.
No `synchronize` event fires. PR reviewer never re-reviews.
**Location**: `fix-rejected-prs.sh:77`
**Fix**: Script correctly aborts on conflict (never commits markers). But
the consequence is that conflicted PRs stall. The fix_stale_prs cron provides
the retry mechanism (every 15 min rebase attempts).

### Bug 8: Hard Failure Gate Flags Merged PRs

**Severity**: Low
**Symptom**: The hard gate runs `if: always()` after all tiers. If the PR was
merged during Tier 2 or 3 processing, the gate correctly reports "MERGED".
But if the merge happened AFTER the gate checked, the gate might still
comment "needs manual review" on a merged PR.
**Location**: `pr-reviewer.yml`, `reviewer-fast.yml` hard gate step
**Fix**: The gate checks PR state at runtime — this is correct. Verify the
`gh pr view` call includes `--repo` flag.

---

## 4. INVESTIGATION CHECKLIST

For each workflow file, verify:

### YAML & Triggers

- [ ] YAML parses without errors (`python3 -c "import yaml; yaml.safe_load(open(FILE))"`)
- [ ] `on:` triggers are correct and don't overlap with other workflows unnecessarily
- [ ] `concurrency` groups don't deadlock (different workflows = different groups)
- [ ] `cancel-in-progress: false` everywhere (no kill-mid-fix)

### Permissions

- [ ] Job-level `permissions:` block present for all jobs that use `gh` CLI
- [ ] Top-level `permissions:` present for `on-failure.yml` (uses `issues: write`)
- [ ] `secrets.PAT_TOKEN` referenced everywhere `gh` commands run

### Conditions

- [ ] Tier 2 fires when `check_claude` step itself fails (not just Claude outcome)
- [ ] Tier 2 fires when Claude silently succeeds but created no PR/no merge
- [ ] No empty fallthrough paths (every tier failure has a next tier or hard gate)
- [ ] `if:` expressions use `!= 'true'` not `== 'false'` for boolean outputs (handles undefined)

### Prompts

- [ ] All tiers include `npm run lint` before merge
- [ ] All resolver prompts include INLINE FIX PROTOCOL (check existing PR first)
- [ ] All prompts include "checkout + fix inline" instruction for existing PRs
- [ ] All prompts include "remove conflict markers" instruction
- [ ] All prompts include `timeout 600` on `gh pr checks --watch`

### Error Handling

- [ ] Job-level `timeout-minutes` set on every workflow
- [ ] `continue-on-error: true` on Tier 1 and Tier 2 (not Tier 3)
- [ ] Hard failure gate after Tier 3 (`if: always()`)
- [ ] `set -e` in scripts has `|| true` on final `wait`

### Labels

- [ ] Guardian creates `guardian-alert` label before using it
- [ ] on-failure creates `guardian-alert` label before using it
- [ ] Dispatcher searches exclude `swarm-active` and don't match `guardian-alert`

---

## 5. VERIFICATION COMMANDS

Run these after making changes:

```bash
# Validate all YAML
for f in .github/workflows/*.yml; do
  python3 -c "import yaml; yaml.safe_load(open('$f'))" && echo "OK: $f" || echo "FAIL: $f"
done

# Check for any remaining /openhands-fix in guardian or on-failure
grep -rn "/openhands-fix" .github/workflows/guardian.yml .github/workflows/on-failure.yml && echo "FAIL" || echo "PASS"

# Check fix-rejected-prs.sh for auto-merge
grep -c "gh pr merge" scripts/fix-rejected-prs.sh && echo "FAIL: still auto-merges" || echo "PASS"

# Check all resolver prompts for inline-fix protocol
grep -c "INLINE FIX PROTOCOL" .github/workflows/openhands.yml
grep -c "INLINE FIX PROTOCOL" .github/workflows/resolver-fast.yml

# Check all reviewer prompts for lint
grep -c "npm run lint" .github/workflows/pr-reviewer.yml
grep -c "npm run lint" .github/workflows/reviewer-fast.yml

# Check timeouts
for f in openhands resolver-fast pr-reviewer reviewer-fast; do
  echo -n "$f: "
  grep "timeout-minutes" .github/workflows/$f.yml | head -1 || echo "MISSING"
done

# Check gh pr checks --watch wrappers
grep -c "timeout 600.*gh pr checks" .github/workflows/pr-reviewer.yml
grep -c "timeout 600.*gh pr checks" .github/workflows/reviewer-fast.yml

# Live system check
gh pr list --state open --json number,title,mergeable,updatedAt
gh run list --limit 10 --json name,status,conclusion,workflowName

# Check stuck issues (have swarm-active but no open PR)
gh issue list --label "swarm-active" --state open --json number,title
```

---

## 6. RECOVERY PROCEDURES

### Unstick a swarm-active issue

```bash
gh issue edit ISSUE_NUM --remove-label "swarm-active"
# Dispatcher will pick it up within 5 minutes
```

### Force-review a stuck PR

```bash
# Push an empty commit to trigger synchronize event
BRANCH=$(gh pr view PR_NUM --json headRefName -q '.headRefName')
git fetch origin "$BRANCH" && git checkout "$BRANCH"
git commit --allow-empty -m "chore: trigger synchronize for PR reviewer"
git push origin "$BRANCH"
git checkout main
```

### Manually trigger resolver for an issue

```bash
gh issue comment ISSUE_NUM --body "/openhands-fix"
```

### Recover from guardian revert loop

```bash
# If guardian keeps reverting the same commit:
gh issue list --search "Guardian:" --state open --json number
# Close all duplicate guardian issues
gh issue close ISSUE_NUM
# Guardian will not create new issues for the same failure if existing is closed
```

---

## 7. DELIVERABLES

After investigation, produce:

1. **Bug list**: Every bug found, with severity, location, and root cause
2. **Fix commits**: Each fix in a separate commit with descriptive message
3. **Verification report**: All YAML valid, all checks pass
4. **Live system status**: Current PRs, recent workflow runs, any stuck issues
5. **Updated AI-WORKFLOW.md**: Any architectural changes reflected in docs
