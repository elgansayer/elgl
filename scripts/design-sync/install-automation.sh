#!/usr/bin/env bash
# Idempotently installs the design automation cron entries for the current user.
#   nightly 02:30 UTC  - two-way Claude Design sync
#   Monday  04:00 UTC  - design audit, critique and improvement follow-ups
# Each entry runs the runner as committed on origin/main, so the automation always uses merged code
# and is unaffected by whatever state the local checkout is in.
set -euo pipefail
repo="${HELLOTALK_REPO:-$(cd "$(dirname "$0")/../.." && git rev-parse --path-format=absolute --git-common-dir | xargs dirname)}"
marker='# hellotalk-design-automation'
path_line="PATH=$(dirname "$(command -v node)"):$(dirname "$(command -v claude)"):/usr/local/bin:/usr/bin:/bin"

entry() {
  local schedule="$1" mode="$2"
  echo "$schedule $path_line HELLOTALK_REPO=$repo bash -c 'f=\$(mktemp) && git -C $repo fetch -q origin main && git -C $repo show origin/main:scripts/design-sync/run-automation.sh > \$f && bash \$f $mode; rm -f \$f' >/dev/null 2>&1 $marker"
}

current="$(crontab -l 2>/dev/null | grep -v "$marker" || true)"
{
  printf '%s\n' "$current"
  entry '30 2 * * *' sync
  entry '0 4 * * 1' improve
} | sed '/^$/d' | crontab -
crontab -l | grep "$marker"
