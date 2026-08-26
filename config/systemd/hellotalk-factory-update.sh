#!/usr/bin/env bash
# Daily factory self-update: pull main, reinstall Python package, restart.
#
# Safety contract:
#   - Never restarts while active jobs are running (checked via daemon.json).
#   - Only pulls if the remote has new commits (fast-forward only - no merges).
#   - Aborts on any error; systemd Restart=on-failure handles recovery.
#   - Logs every decision so journalctl -u hellotalk-factory-update traces the run.
#
# Runs as root. Git auth uses GH_TOKEN (GITHUB_TOKEN) from factory.env,
# loaded by the service unit EnvironmentFile.
set -euo pipefail

REPOSITORY=/var/lib/hellotalk-factory/repository
HEARTBEAT=/var/lib/hellotalk-factory/daemon.json
SERVICE=hellotalk-factory.service
FACTORY_VENV=/opt/hellotalk-factory/venv
RESTART_GRACE_SECONDS=${FACTORY_UPDATE_RESTART_GRACE_SECONDS:-60}
ACTIVE_JOB_WAIT_SECONDS=${FACTORY_UPDATE_ACTIVE_JOB_WAIT_SECONDS:-300}

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] factory-update: $*"; }

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 1. Wait for the daemon to be idle (no active jobs).
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
active_jobs() {
  python3 - "$HEARTBEAT" <<'PY'
import json, sys
from pathlib import Path
try:
    d = json.loads(Path(sys.argv[1]).read_text())
    jobs = d.get("active_jobs", [])
    raise SystemExit(0 if not jobs else 1)
except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
    raise SystemExit(0)
PY
}

log "Waiting up to ${ACTIVE_JOB_WAIT_SECONDS}s for factory to be idle"
waited=0
while ! active_jobs; do
  if [ "$waited" -ge "$ACTIVE_JOB_WAIT_SECONDS" ]; then
    log "Active jobs still running after ${ACTIVE_JOB_WAIT_SECONDS}s - skipping update, will retry tomorrow"
    exit 0
  fi
  sleep 15
  waited=$((waited + 15))
done
log "Factory is idle"

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 2. Fetch and check whether main has moved.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Fetching origin/main"
# safe.directory: repo is owned by dev but this script runs as root.
# GH_TOKEN auth mirrors the factory_git pattern in deploy-and-start-factory.sh.
GH_TOKEN="${GITHUB_TOKEN:-}" \
  git -c safe.directory="$REPOSITORY" \
  -c credential.helper='!gh auth git-credential' \
  -C "$REPOSITORY" fetch --quiet origin main

local_sha=$(git -c safe.directory="$REPOSITORY" -C "$REPOSITORY" rev-parse HEAD)
remote_sha=$(git -c safe.directory="$REPOSITORY" -C "$REPOSITORY" rev-parse origin/main)

if [ "$local_sha" = "$remote_sha" ]; then
  log "Already up to date at ${local_sha:0:12} - no restart needed"
  exit 0
fi

log "New commits on main: ${local_sha:0:12} -> ${remote_sha:0:12}"

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 3. Verify the pull will be a clean fast-forward.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
merge_base=$(git -c safe.directory="$REPOSITORY" -C "$REPOSITORY" merge-base HEAD origin/main)
if [ "$merge_base" != "$local_sha" ]; then
  log "ERROR: local main has diverged from origin/main (merge-base=${merge_base:0:12}) - manual intervention required"
  exit 1
fi

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 4. Stop the factory before touching the package.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Stopping factory service"
systemctl stop "$SERVICE" || true

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 5. Pull and reinstall.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Pulling main"
git -c safe.directory="$REPOSITORY" -C "$REPOSITORY" reset --hard HEAD
GH_TOKEN="${GITHUB_TOKEN:-}" \
  git -c safe.directory="$REPOSITORY" \
  -c credential.helper='!gh auth git-credential' \
  -C "$REPOSITORY" pull --ff-only origin main

pulled_sha=$(git -c safe.directory="$REPOSITORY" -C "$REPOSITORY" rev-parse HEAD)
log "Pulled to ${pulled_sha:0:12}"

log "Reinstalling factory Python package"
VIRTUAL_ENV="$FACTORY_VENV" \
  "$FACTORY_VENV/bin/uv" sync \
    --active --frozen --inexact --no-editable --extra development \
    --project "$REPOSITORY/automation"
# uv sync ran as root - restore ownership so the factory service (runs as dev) can execute.
chown -R dev:dev "$FACTORY_VENV"

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 6. Restart and verify.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Starting factory service"
systemctl reset-failed "$SERVICE" || true
systemctl start "$SERVICE"

sleep "$RESTART_GRACE_SECONDS"

if systemctl is-active --quiet "$SERVICE"; then
  log "Factory restarted successfully at ${pulled_sha:0:12}"
else
  log "ERROR: factory failed to start after update - check journalctl -u $SERVICE"
  exit 1
fi
