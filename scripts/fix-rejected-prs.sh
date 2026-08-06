#!/bin/bash
# fix-rejected-prs.sh - Autonomous script to fix rejected/conflicting PRs and merge them into main.

set -e

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
REPO_DIR="$(dirname "$SCRIPT_DIR")"

cd "$REPO_DIR"

echo "=== Autonomous PR Fixer & Merger ==="

# Get all open PR numbers
OPEN_PRS=$(gh pr list --state open --json number -q '.[].number')

if [ -z "$OPEN_PRS" ]; then
  echo "No open PRs to process."
  exit 0
fi

for pr in $OPEN_PRS; do
  echo "========== Processing PR #$pr =========="
  
  TITLE=$(gh pr view "$pr" --json title -q '.title' 2>/dev/null || echo "Unknown")
  echo "PR #$pr: $TITLE"

  # Checkout PR branch
  gh pr checkout "$pr" || continue

  # Fetch main and attempt merge
  git fetch origin main
  if ! git merge origin/main --no-edit -X ours 2>/dev/null; then
    echo "Resolving conflicts for PR #$pr..."
    git status --short | grep "^UU" | awk '{print $2}' | xargs -r git checkout --ours 2>/dev/null || true
    git add .
    git commit -m "fix: auto-resolve merge conflicts with main" 2>/dev/null || true
  fi

  # Push resolved changes to branch
  git push origin HEAD 2>/dev/null || true

  # Merge PR
  if gh pr merge "$pr" --squash --delete-branch 2>/dev/null; then
    echo "✓ Successfully merged PR #$pr"
  else
    echo "⚠ Could not auto-merge PR #$pr"
  fi

  # Sync local main
  git checkout main 2>/dev/null || true
  git pull origin main 2>/dev/null || true
done

echo "=== PR Fixer Completed ==="
