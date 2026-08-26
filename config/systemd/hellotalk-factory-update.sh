#!/usr/bin/env bash
# Daily factory self-update: pull main, reinstall Python package, restart.
#
# Safety contract:
#   - Never restarts while active jobs are running (checked via daemon.json).
#   - Only pulls if the remote has new commits (fast-forward only - no merges).
#   - A failure trap restores the primary service and any active repository service.
#   - Logs every decision so journalctl -u hellotalk-factory-update traces the run.
#
# The unit runs as root for systemd/package operations. Repository Git
# operations run as the repository owner and use GH_TOKEN (GITHUB_TOKEN) from
# factory.env, loaded by the service unit EnvironmentFile.
set -euo pipefail

FACTORY_USER=dev
FACTORY_HOME=/home/dev
REPOSITORY=/var/lib/hellotalk-factory/repository
HEARTBEAT=/var/lib/hellotalk-factory/daemon.json
SERVICE=hellotalk-factory.service
WORKOUT_SERVICE=workout-agent-factory.service
WORKOUT_HEARTBEAT=/var/lib/workout-agent-factory/daemon.json
FACTORY_VENV=/opt/hellotalk-factory/venv
SERVICES_STOPPED=false
WORKOUT_WAS_ACTIVE=false
RESTART_GRACE_SECONDS=${FACTORY_UPDATE_RESTART_GRACE_SECONDS:-60}
ACTIVE_JOB_WAIT_SECONDS=${FACTORY_UPDATE_ACTIVE_JOB_WAIT_SECONDS:-300}
GIT_TIMEOUT=${FACTORY_UPDATE_GIT_TIMEOUT:-120}

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] factory-update: $*"; }

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 1. Wait for the daemon to be idle (no active jobs).
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
service_idle() {
  python3 - "$1" <<'PY'
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
while ! service_idle "$HEARTBEAT" || {
  systemctl is-active --quiet "$WORKOUT_SERVICE" &&
    ! service_idle "$WORKOUT_HEARTBEAT"
}; do
  if [ "$waited" -ge "$ACTIVE_JOB_WAIT_SECONDS" ]; then
    log "Active jobs still running after ${ACTIVE_JOB_WAIT_SECONDS}s - skipping update, will retry tomorrow"
    exit 0
  fi
  sleep 15
  waited=$((waited + 15))
done
log "Factory instances are idle"

recover_services() {
  exit_status=$?
  trap - EXIT
  if [ "$SERVICES_STOPPED" = true ]; then
    log "Update interrupted; restoring factory services"
    systemctl reset-failed "$SERVICE" || true
    systemctl start "$SERVICE" || true
    if [ "$WORKOUT_WAS_ACTIVE" = true ]; then
      systemctl reset-failed "$WORKOUT_SERVICE" || true
      systemctl start "$WORKOUT_SERVICE" || true
    fi
  fi
  exit "$exit_status"
}
trap recover_services EXIT

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 2. Fetch and check whether main has moved.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Fetching origin/main"
timeout "${GIT_TIMEOUT}s" \
  runuser -u "$FACTORY_USER" -- env \
    HOME="$FACTORY_HOME" GH_TOKEN="${GITHUB_TOKEN:-}" \
    git -c credential.helper='!gh auth git-credential' \
    -C "$REPOSITORY" fetch --quiet origin main

local_sha=$(runuser -u "$FACTORY_USER" -- git -C "$REPOSITORY" rev-parse HEAD)
remote_sha=$(runuser -u "$FACTORY_USER" -- git -C "$REPOSITORY" rev-parse origin/main)

if [ "$local_sha" = "$remote_sha" ]; then
  log "Already up to date at ${local_sha:0:12} - no restart needed"
  exit 0
fi

log "New commits on main: ${local_sha:0:12} -> ${remote_sha:0:12}"

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 3. Verify the pull will be a clean fast-forward.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
merge_base=$(runuser -u "$FACTORY_USER" -- git -C "$REPOSITORY" merge-base HEAD origin/main)
if [ "$merge_base" != "$local_sha" ]; then
  log "ERROR: local main has diverged from origin/main (merge-base=${merge_base:0:12}) - manual intervention required"
  exit 1
fi

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 4. Stop the factory before touching the package.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Stopping factory services that share the installed runtime"
SERVICES_STOPPED=true
if systemctl is-active --quiet "$WORKOUT_SERVICE"; then
  WORKOUT_WAS_ACTIVE=true
  systemctl stop "$WORKOUT_SERVICE"
fi
systemctl stop "$SERVICE" || true

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 5. Pull and reinstall.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Pulling main"
timeout "${GIT_TIMEOUT}s" \
  runuser -u "$FACTORY_USER" -- env \
    HOME="$FACTORY_HOME" GH_TOKEN="${GITHUB_TOKEN:-}" \
    git -c credential.helper='!gh auth git-credential' \
    -C "$REPOSITORY" pull --ff-only origin main

pulled_sha=$(runuser -u "$FACTORY_USER" -- git -C "$REPOSITORY" rev-parse HEAD)
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
log "Starting factory services"
systemctl reset-failed "$SERVICE" || true
systemctl start "$SERVICE"
if [ "$WORKOUT_WAS_ACTIVE" = true ]; then
  systemctl reset-failed "$WORKOUT_SERVICE" || true
  systemctl start "$WORKOUT_SERVICE"
fi

sleep "$RESTART_GRACE_SECONDS"

if ! systemctl is-active --quiet "$SERVICE"; then
  log "ERROR: factory failed to start after update - check journalctl -u $SERVICE"
  exit 1
fi
if [ "$WORKOUT_WAS_ACTIVE" = true ] &&
  ! systemctl is-active --quiet "$WORKOUT_SERVICE"; then
  log "ERROR: Workout Agent factory failed to restart - check journalctl -u $WORKOUT_SERVICE"
  exit 1
fi

SERVICES_STOPPED=false
trap - EXIT
log "Factory services restarted successfully at ${pulled_sha:0:12}"
