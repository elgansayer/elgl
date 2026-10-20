#!/usr/bin/env bash
# Unattended Claude Design automation, run from cron on the factory host.
#
#   scripts/design-sync/run-automation.sh sync      nightly two-way Claude Design sync
#   scripts/design-sync/run-automation.sh improve   weekly design audit + critique + follow-ups
#
# Each run uses a fresh worktree at origin/main so local checkouts are never touched. The Claude
# Design connection uses this host's claude.ai login (/design-login); when that is missing the run
# opens a single "Claude Design sync blocked" issue instead of failing silently.
set -euo pipefail

mode="${1:?usage: run-automation.sh sync|improve}"
repo="${HELLOTALK_REPO:-$HOME/hellotalk}"
state_dir="${DESIGN_AUTOMATION_HOME:-$HOME/.cache/hellotalk-design-automation}"
log_dir="$state_dir/logs"
mkdir -p "$log_dir"
log="$log_dir/$mode-$(date -u +%Y%m%dT%H%M%SZ).log"
exec > >(tee -a "$log") 2>&1

exec 9>"$state_dir/$mode.lock"
flock -n 9 || { echo "another $mode run is active"; exit 0; }

worktree="$state_dir/worktree-$mode"
git -C "$repo" fetch --quiet origin main
git -C "$repo" worktree remove --force "$worktree" 2>/dev/null || rm -rf "$worktree"
git -C "$repo" worktree prune
git -C "$repo" worktree add --quiet --detach "$worktree" origin/main
trap 'git -C "$repo" worktree remove --force "$worktree" >/dev/null 2>&1 || true' EXIT
ln -s "$repo/node_modules" "$worktree/node_modules"
cd "$worktree"

work="$(mktemp -d "$state_dir/$mode-work.XXXXXX")"
export DESIGN_SYNC_WORK="$work"

blocked_issue() {
  local title="Claude Design sync blocked: authorization required"
  local existing
  existing="$(gh issue list --state open --search "\"$title\" in:title" --json number -q '.[0].number' || true)"
  local body="The unattended Claude Design sync on $(hostname) could not authenticate (last attempt $(date -u +%FT%TZ)).

Run \`/design-login\` once in Claude Code on that host (as user \`$(whoami)\`). The next nightly run will push all pending design-sync items and close this issue.

Log: \`$log\`"
  if [[ -n "$existing" ]]; then gh issue comment "$existing" --body "Still blocked at $(date -u +%FT%TZ)."
  else gh issue create --title "$title" --body "$body" --label needs-human --assignee @me; fi
}

run_claude() {
  timeout 3600 claude -p "$1" \
    --permission-mode bypassPermissions \
    --output-format text \
    --max-turns 200
}

case "$mode" in
  sync)
    output="$(run_claude "$(cat scripts/design-sync/sync-agent.prompt.md)" || true)"
    echo "$output"
    if grep -qE 'SYNC_BLOCKED: design-login|needs design-system authorization|/design-login' <<<"$output" \
      && ! grep -q 'SYNC_DONE' <<<"$output"; then
      blocked_issue
    fi
    ;;
  improve)
    node scripts/design-sync/audit-design.mjs --write
    PLAYWRIGHT_BROWSERS_PATH="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}" \
      node scripts/design-sync/render-previews.mjs || echo "render audit unavailable; continuing with static audit"
    # Rotate three manifest IDs per ISO week so every artefact is critiqued regularly.
    export DESIGN_FOCUS="$(node -e "
      const ids = require('./design-sync.manifest.json').items.map((i) => i.id);
      const week = Math.floor(Date.now() / 604800000);
      console.log([0, 1, 2].map((k) => ids[(week * 3 + k) % ids.length]).join(','));
    ")"
    echo "focus: $DESIGN_FOCUS"
    run_claude "$(cat scripts/design-sync/improve-agent.prompt.md)

DESIGN_FOCUS=$DESIGN_FOCUS"
    ;;
  *) echo "unknown mode $mode" >&2; exit 2 ;;
esac

rm -rf "$work"
find "$log_dir" -name '*.log' -mtime +30 -delete
