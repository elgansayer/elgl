#!/bin/bash
# fix-rejected-prs.sh — Parallel PR fixer that NEVER commits conflict markers.
#
# Strategy: rebase each PR branch onto main. If rebase conflicts, abort and
# leave the branch as-is for the AI PR reviewer to resolve intelligently.
# NEVER commits raw conflict markers (<<<<<<<, =======, >>>>>>>).
#
# Processes PRs in parallel batches for maximum throughput.

set -e

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

cd "$REPO_DIR"

MAX_PARALLEL="${MAX_PARALLEL_PR_FIXER:-20}"

echo "=== Autonomous PR Fixer & Merger (Zero Conflict Marker Policy) ==="
echo "Strategy: rebase-only, NEVER commit conflict markers"
echo "Parallel workers: $MAX_PARALLEL"

git config user.email "swarm@hellotalk.ai" 2>/dev/null || true
git config user.name "AI Swarm" 2>/dev/null || true

OPEN_PRS=$(gh pr list --state open --json number -q '.[].number')

if [ -z "$OPEN_PRS" ]; then
  echo "No open PRs to process."
  exit 0
fi

PR_COUNT=$(echo "$OPEN_PRS" | wc -l)
echo "Found $PR_COUNT open PR(s). Processing in parallel batches of $MAX_PARALLEL..."

process_pr() {
  local pr="$1"
  local log_file="/tmp/pr_fixer_${pr}.log"

  {
    echo ""
    echo "========== Processing PR #$pr =========="

    TITLE=$(gh pr view "$pr" --json title -q '.title' 2>/dev/null || echo "Unknown")
    echo "PR #$pr: $TITLE"

    # Each worker needs a fresh worktree to avoid conflicts
    WORKDIR="/tmp/pr_work_${pr}_$$"
    rm -rf "$WORKDIR" 2>/dev/null || true
    git worktree add "$WORKDIR" --detach 2>/dev/null || {
      echo "⚠ Could not create worktree for PR #$pr — skipping"
      return 1
    }

    (
      cd "$WORKDIR"

      git fetch origin "pull/${pr}/head:pr-${pr}" 2>/dev/null || {
        echo "⚠ Could not fetch PR #$pr — skipping"
        exit 1
      }
      git checkout "pr-${pr}" 2>/dev/null || exit 1
      git fetch origin main

      # ── STEP 1: Try a clean rebase onto main ──────────────────────
      echo "[$pr] Attempting rebase onto origin/main..."
      if git rebase origin/main 2>/dev/null; then
        echo "[$pr] ✓ Clean rebase - no conflicts."

        if git push origin "pr-${pr}:refs/heads/$(gh pr view "$pr" --json headRefName -q '.headRefName' 2>/dev/null)" --force-with-lease 2>/dev/null; then
          echo "[$pr] ✓ Pushed rebased branch."

          echo "[$pr] Waiting for checks to complete..."
          gh pr checks "$pr" --watch 2>/dev/null || true

          if gh pr merge "$pr" --squash --delete-branch 2>/dev/null; then
            echo "[$pr] ✓ Merged successfully."
          else
            echo "[$pr] ⚠ Merge failed (checks may have failed) — leaving for AI review."
          fi
        else
          echo "[$pr] ⚠ Push failed — skipping."
        fi
      else
        # ── Rebase failed — ABORT, do NOT commit conflict markers ──
        echo "[$pr] ⚠ Rebase conflicts with main. Aborting rebase."
        git rebase --abort 2>/dev/null || true

        echo "[$pr] Leaving branch as-is for the AI PR reviewer to resolve."
        echo "[$pr] NEVER committing conflict markers — the reviewer will handle this."
        echo "[$pr] Run: gh pr checks $pr --watch once resolved."
      fi
    )
    rc=$?

    git worktree remove "$WORKDIR" --force 2>/dev/null || true
    rm -rf "$WORKDIR" 2>/dev/null || true

    return $rc
  } >> "$log_file" 2>&1
}

export -f process_pr
export REPO_DIR
export GH_TOKEN="${GH_TOKEN:-}"
export MAX_PARALLEL

# Process PRs in parallel batches
RUNNING=0
for pr in $OPEN_PRS; do
  process_pr "$pr" &
  RUNNING=$((RUNNING + 1))

  if [ "$RUNNING" -ge "$MAX_PARALLEL" ]; then
    wait -n 2>/dev/null || true
    RUNNING=$((RUNNING - 1))
  fi
done

# Wait for remaining jobs
wait

# Clean up any leftover worktrees
git worktree list --porcelain 2>/dev/null | grep '^worktree /tmp/pr_work_' | cut -d' ' -f2 | while read -r wt; do
  git worktree remove "$wt" --force 2>/dev/null || true
done

echo ""
echo "=== PR Fixer Completed ==="
