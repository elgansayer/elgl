#!/usr/bin/env bash
set -euo pipefail

: "${REPOSITORY:?REPOSITORY is required}"
: "${BASE_BRANCH:?BASE_BRANCH is required}"
: "${GITHUB_STEP_SUMMARY:?GITHUB_STEP_SUMMARY is required}"

git fetch --prune origin '+refs/heads/*:refs/remotes/origin/*'

mapfile -t branches < <(
  gh api --paginate "repos/${REPOSITORY}/branches?per_page=100" --jq '.[].name'
)

integrated=0
active_pr=0
orphaned=0

{
  echo '### Branch PR hygiene'
  echo
  echo 'This audit is intentionally read-only. Branch existence alone must never create implementation work.'
  echo
  echo '| Branch | Classification | Commits ahead |'
  echo '| --- | --- | ---: |'
} >> "$GITHUB_STEP_SUMMARY"

for branch in "${branches[@]}"; do
  if [[ -z "$branch" || "$branch" == "$BASE_BRANCH" ]]; then
    continue
  fi

  remote_ref="refs/remotes/origin/${branch}"
  if ! git show-ref --verify --quiet "$remote_ref"; then
    continue
  fi

  ahead=$(git rev-list --count "origin/${BASE_BRANCH}..${remote_ref}")
  if [[ "$ahead" -eq 0 ]]; then
    integrated=$((integrated + 1))
    printf '| %s | integrated | %s |\n' "$branch" "$ahead" >> "$GITHUB_STEP_SUMMARY"
    continue
  fi

  existing=$(gh pr list \
    --repo "$REPOSITORY" \
    --head "$branch" \
    --state open \
    --json number \
    --jq 'length')

  if [[ "$existing" -gt 0 ]]; then
    active_pr=$((active_pr + 1))
    printf '| %s | active PR | %s |\n' "$branch" "$ahead" >> "$GITHUB_STEP_SUMMARY"
  else
    orphaned=$((orphaned + 1))
    printf '| %s | orphaned | %s |\n' "$branch" "$ahead" >> "$GITHUB_STEP_SUMMARY"
  fi
done

{
  echo
  printf '%s\n' "- Integrated branches: $integrated"
  printf '%s\n' "- Branches with active PRs: $active_pr"
  printf '%s\n' "- Orphaned ahead branches: $orphaned"
  echo
  echo 'Orphaned branches are reported for convergence/cleanup only. This workflow does not create, modify, reopen, or merge pull requests.'
} >> "$GITHUB_STEP_SUMMARY"
