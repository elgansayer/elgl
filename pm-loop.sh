#!/bin/bash
# pm-loop.sh - GitHub Issue Sync Agent
#
# Polls GitHub Issues API and imports new issues into TODO.md.
# Uses jq for reliable JSON parsing and flock for atomic TODO.md writes.
#
# Env vars: SWARM_REPO_OWNER, SWARM_REPO_NAME, PM_SYNC_INTERVAL, GITHUB_TOKEN

export PATH="$HOME/.local/bin:$PATH"
source "$(dirname "$(realpath "$0")")/scripts/swarm-env.sh"
source "$SWARM_SCRIPTS/swarm-tasks.sh"

GIT_LOCK="/tmp/ai_swarm_git.lock"

git_locked() { flock -w 120 "$GIT_LOCK" git "$@"; }

REPO_FULL="${SWARM_REPO_OWNER}/${SWARM_REPO_NAME}"
API_URL="https://api.github.com/repos/${REPO_FULL}/issues?state=open&per_page=20"

echo "Starting PM Swarm for $REPO_FULL (sync every ${PM_SYNC_INTERVAL}s)..."

while true; do
    echo "========================================"
    echo "PM STAGE: GITHUB ISSUE SYNC"
    echo "========================================"

    response=""
    curl_opts=(-sf -H "Accept: application/vnd.github+json")
    if [ -n "$GITHUB_TOKEN" ]; then
        curl_opts+=(-H "Authorization: Bearer $GITHUB_TOKEN")
    fi
    response=$(curl "${curl_opts[@]}" "$API_URL" 2>/dev/null || echo "[]")

    if [ "$response" = "[]" ] || [ -z "$response" ]; then
        echo "No open issues found (or API unavailable)."
        echo "Sleeping for ${PM_SYNC_INTERVAL} seconds..."
        sleep "$PM_SYNC_INTERVAL"
        continue
    fi

    issue_count=$(echo "$response" | jq -r '.[].title' 2>/dev/null | wc -l)
    echo "Found $issue_count open issues."

    imported=0
    while IFS= read -r title; do
        [ -z "$title" ] && continue

        if grep -qF "$title" TODO.md 2>/dev/null; then
            continue
        fi

        echo "  + Importing: $title"

        # Write to .tasks/pending/ (primary task source)
        swarm_task_add "$title" "0000"

        imported=$((imported + 1))
    done < <(echo "$response" | jq -r '.[].title' 2>/dev/null)

    if [ "$imported" -gt 0 ]; then
        git_locked add .tasks/
        git_locked commit -m "ci(pm): imported $imported task(s) from GitHub issues" || true
        git_locked push "$SWARM_GIT_REMOTE" "$(git rev-parse --abbrev-ref HEAD)" || true
        echo "Imported $imported new task(s)."
    else
        echo "No new issues to import."
    fi

    echo "Sleeping for ${PM_SYNC_INTERVAL} seconds before next PM sync..."
    sleep "$PM_SYNC_INTERVAL"
done
