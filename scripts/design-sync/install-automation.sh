#!/usr/bin/env bash
# Idempotently installs the design automation cron entries for the current user.
#   nightly 02:30 UTC  - two-way Claude Design sync
#   Monday  04:00 UTC  - design audit, critique and improvement follow-ups
set -euo pipefail
repo="$(cd "$(dirname "$0")/../.." && pwd)"
runner="$repo/scripts/design-sync/run-automation.sh"
marker='# hellotalk-design-automation'
path_line="PATH=$HOME/.local/bin:$HOME/.nvm/versions/node/$(node -v)/bin:/usr/local/bin:/usr/bin:/bin"

current="$(crontab -l 2>/dev/null | grep -v "$marker" || true)"
{
  printf '%s\n' "$current"
  echo "30 2 * * * $path_line HELLOTALK_REPO=$repo $runner sync >/dev/null 2>&1 $marker"
  echo "0 4 * * 1 $path_line HELLOTALK_REPO=$repo $runner improve >/dev/null 2>&1 $marker"
} | sed '/^$/d' | crontab -
crontab -l | grep "$marker"
