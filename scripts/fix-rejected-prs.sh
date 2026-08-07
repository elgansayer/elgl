#!/bin/bash
# fix-rejected-prs.sh - Parallel PR rebaser that NEVER commits conflict markers
# and NEVER auto-merges. Merging is left exclusively to the AI PR reviewer.
#
# Strategy: rebase each PR branch onto main. If rebase conflicts, abort and
# leave the branch as-is for the AI PR reviewer to resolve intelligently.
# NEVER commits raw conflict markers.

set -e

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

cd "$REPO_DIR"

MAX_PARALLEL="${MAX_PARALLEL_PR_FIXER:-20}"

echo "=== Autonomous PR Rebasing ==="
echo "Strategy: rebase-only, NEVER commit conflict markers, NEVER auto-merge"
echo "Parallel workers: $MAX_PARALLEL"

git config user.email "swarm@hellotalk.ai" 2>/dev/null || true
git config user.name "AI Swarm" 2>/dev/null || true

OPEN_PRS=$(gh pr list --state open --json number -q '.[].number')

if [ -z "$OPEN_PRS" ]; then
  echo "No open PRs to process."
  exit 0
fi

PR_COUNT=$(echo "$OPEN_PRS" | wc -l)
echo "Found $PR_COUNT open PR(s). Processing..."

process_pr() {
  local pr="$1"
  local log_file="/tmp/pr_fixer_${pr}.log"

  {
    echo ""
    echo "========== Processing PR #$pr =========="

    TITLE=$(gh pr view "$pr" --json title -q '.title' 2>/dev/null || echo "Unknown")
    echo "PR #$pr: $TITLE"

    WORKDIR="/tmp/pr_work_${pr}_$$"
    rm -rf "$WORKDIR" 2>/dev/null || true
    git worktree add "$WORKDIR" --detach 2>/dev/null || {
      echo "WARN: Could not create worktree for PR #$pr - skipping"
      return 1
    }

    (
      cd "$WORKDIR"

      git fetch origin "pull/${pr}/head:pr-${pr}" 2>/dev/null || {
        echo "WARN: Could not fetch PR #$pr - skipping"
        exit 1
      }
      git checkout "pr-${pr}" 2>/dev/null || exit 1
      git fetch origin main

      echo "[$pr] Attempting rebase onto origin/main..."
      if git rebase origin/main 2>/dev/null; then
        echo "[$pr] Clean rebase - no conflicts."

        HEAD_REF=$(gh pr view "$pr" --json headRefName -q '.headRefName' 2>/dev/null)
        if git push origin "pr-${pr}:refs/heads/${HEAD_REF}" --force-with-lease 2>/dev/null; then
          echo "[$pr] Pushed rebased branch."
          echo "[$pr] Waiting for checks to pass..."
          gh pr checks "$pr" --watch 2>/dev/null || true
          echo "[$pr] Checks completed. Leaving for PR reviewer to verify and merge."
          echo "[$pr] NEVER auto-merging - the PR reviewer must re-verify inline."
        else
          echo "[$pr] WARN: Push failed - skipping."
        fi
      else
        echo "[$pr] WARN: Rebase conflicts with main. Aborting rebase."
        git rebase --abort 2>/dev/null || true
        
        # Automate un-sticking conflicts: Push an empty commit with PAT to trigger the AI PR Reviewer
        LAST_COMMIT_MSG=$(git log -1 --format=%s 2>/dev/null || echo "")
        if [ "$LAST_COMMIT_MSG" != "chore: trigger synchronize for AI reviewer" ]; then
          echo "[$pr] Triggering AI PR Reviewer by pushing an empty commit..."
          git commit --allow-empty -m "chore: trigger synchronize for AI reviewer" 2>/dev/null || true
          HEAD_REF=$(gh pr view "$pr" --json headRefName -q '.headRefName' 2>/dev/null)
          # Use GH_TOKEN (PAT) so GitHub Actions triggers the pull_request:synchronize event
          git push "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git" "HEAD:refs/heads/${HEAD_REF}" 2>/dev/null || true
        else
          echo "[$pr] Already pushed empty commit. Waiting for AI PR Reviewer to finish."
        fi
        
        echo "[$pr] Leaving branch as-is for the AI PR reviewer to resolve."
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

RUNNING=0
for pr in $OPEN_PRS; do
  process_pr "$pr" &
  RUNNING=$((RUNNING + 1))
  if [ "$RUNNING" -ge "$MAX_PARALLEL" ]; then
    wait -n 2>/dev/null || true
    RUNNING=$((RUNNING - 1))
  fi
done

wait || true

git worktree list --porcelain 2>/dev/null | grep '^worktree /tmp/pr_work_' | cut -d' ' -f2 | while read -r wt; do
  git worktree remove "$wt" --force 2>/dev/null || true
done

echo ""
echo "=== PR Fixer Completed ==="
