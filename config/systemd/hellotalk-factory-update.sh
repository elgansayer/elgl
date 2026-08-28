#!/usr/bin/env bash
# Daily factory self-update: pull main, reinstall Python package, restart.
#
# Safety contract:
#   - Never restarts while active jobs are running (checked via daemon.json).
#   - Only pulls if the remote has new commits (fast-forward only - no merges).
#   - Aborts on any error; systemd Restart=on-failure handles recovery.
#   - Logs every decision so journalctl -u hellotalk-factory-update traces the run.
#
# The unit runs as root for systemd/package operations. Repository Git
# operations run as the repository owner and use GH_TOKEN (GITHUB_TOKEN) from
# factory.env, loaded by the service unit EnvironmentFile.
set -euo pipefail

FACTORY_USER=dev
FACTORY_HOME=/home/dev
REPOSITORY=${REPO_FACTORY_CONTROL_REPOSITORY:-/var/lib/hellotalk-factory/repository}
HEARTBEAT=${REPO_FACTORY_PRIMARY_HEARTBEAT:-/var/lib/hellotalk-factory/daemon.json}
SERVICE=${REPO_FACTORY_PRIMARY_SERVICE:-hellotalk-factory.service}
SECONDARY_SERVICE=${REPO_FACTORY_SECONDARY_SERVICE:-}
SECONDARY_HEARTBEAT=${REPO_FACTORY_SECONDARY_HEARTBEAT:-}
FACTORY_VENV=/opt/hellotalk-factory/venv
RESTART_GRACE_SECONDS=${FACTORY_UPDATE_RESTART_GRACE_SECONDS:-60}
ACTIVE_JOB_WAIT_SECONDS=${FACTORY_UPDATE_ACTIVE_JOB_WAIT_SECONDS:-300}
GIT_TIMEOUT=${FACTORY_UPDATE_GIT_TIMEOUT:-120}
update_completed=false
services_stopped=false
secondary_was_active=false

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] factory-update: $*"; }

restore_services_on_failure() {
  if [ "$services_stopped" = true ] && [ "$update_completed" = false ]; then
    log "Update failed after service stop - restoring previously running services"
    systemctl reset-failed "$SERVICE" || true
    systemctl start "$SERVICE" || true
    if [ "$secondary_was_active" = true ]; then
      systemctl reset-failed "$SECONDARY_SERVICE" || true
      systemctl start "$SECONDARY_SERVICE" || true
    fi
  fi
}
trap restore_services_on_failure EXIT

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 1. Host storage maintenance - runs every day, before the idle wait below
#    and regardless of whether main has moved. It touches only dangling/
#    unreferenced resources (journal, Docker build cache, unused uv cache
#    entries), never anything an active job holds open, so it doesn't need
#    the daemon idle or stopped. A busy factory can legitimately never go
#    idle within ACTIVE_JOB_WAIT_SECONDS (a healthy, always-working queue
#    looks identical to a stuck one from this script's point of view), and
#    the "already up to date" branch further down exits early on most days -
#    so anything placed after either gate would rarely run at all. This was
#    previously the only path for this maintenance, and it was manual-only:
#    a human had to remember to run it with --apply.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Running host storage maintenance"
"$REPOSITORY/scripts/maintain-factory-host-storage.sh" --apply --prune-docker || \
  log "WARNING: host storage maintenance failed - continuing with the update"

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 2. Wait for the daemon to be idle (no active jobs).
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
active_jobs() {
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

all_factories_idle() {
  active_jobs "$HEARTBEAT" || return 1
  if [ -n "$SECONDARY_HEARTBEAT" ]; then
    active_jobs "$SECONDARY_HEARTBEAT" || return 1
  fi
}

log "Waiting up to ${ACTIVE_JOB_WAIT_SECONDS}s for factory to be idle"
waited=0
while ! all_factories_idle; do
  if [ "$waited" -ge "$ACTIVE_JOB_WAIT_SECONDS" ]; then
    log "Active jobs still running after ${ACTIVE_JOB_WAIT_SECONDS}s - skipping update, will retry tomorrow"
    exit 0
  fi
  sleep 15
  waited=$((waited + 15))
done
log "Factory is idle"

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 3. Fetch and check whether main has moved.
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
# 4. Verify the pull will be a clean fast-forward.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
merge_base=$(runuser -u "$FACTORY_USER" -- git -C "$REPOSITORY" merge-base HEAD origin/main)
if [ "$merge_base" != "$local_sha" ]; then
  log "ERROR: local main has diverged from origin/main (merge-base=${merge_base:0:12}) - manual intervention required"
  exit 1
fi

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 5. Stop the factory before touching the package.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Stopping factory service"
systemctl stop "$SERVICE" || true
services_stopped=true
if [ -n "$SECONDARY_SERVICE" ] && systemctl is-active --quiet "$SECONDARY_SERVICE"; then
  secondary_was_active=true
  systemctl stop "$SECONDARY_SERVICE" || true
fi

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 6. Pull and reinstall.
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
# Ensure dev can write the venv before uv runs as dev, regardless of what
# owned it coming in - then the sync itself runs end to end as dev, so it
# never creates root-owned files under $FACTORY_VENV or ~dev/.cache/uv the
# way running it as root (even with HOME=$FACTORY_HOME set) previously did.
# That HOME override doesn't change the process UID, so uv's cache writes
# came out owned by root while sitting inside the dev user's home directory -
# unreadable by the dev-run factory service and silently piling up until it
# tripped the disk-space reserve that gates scheduling.
chown -R dev:dev "$FACTORY_VENV"
runuser -u "$FACTORY_USER" -- env \
  HOME="$FACTORY_HOME" VIRTUAL_ENV="$FACTORY_VENV" \
  "$FACTORY_VENV/bin/uv" sync \
    --active --frozen --inexact --no-editable --extra development \
    --project "$REPOSITORY/automation"

# Routine maintenance: drop cache entries no longer referenced by any
# environment. Safe - never touches entries a future sync still needs -
# and keeps the wheel cache from growing indefinitely across daily runs.
runuser -u "$FACTORY_USER" -- env HOME="$FACTORY_HOME" "$FACTORY_VENV/bin/uv" cache prune || true

log "Rebuilding the shared Factory worker image"
install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0750 \
  /opt/hellotalk-factory/build-context
rsync -a --delete \
  --exclude=.mypy_cache --exclude=.pytest_cache --exclude=.venv \
  --exclude=__pycache__ \
  "$REPOSITORY/automation/" /opt/hellotalk-factory/build-context/
chown -R "$FACTORY_USER:$FACTORY_USER" /opt/hellotalk-factory/build-context
# The quoted script is evaluated by the inner bash process, where $1 is set.
# shellcheck disable=SC2016
runuser -u "$FACTORY_USER" -- env HOME="$FACTORY_HOME" \
  bash -c 'cd "$1" && exec podman build --cgroup-manager=cgroupfs \
    --tag localhost/hellotalk-factory-worker:current \
    --tag localhost/repo-factory-worker:current \
    --file "$1/Containerfile" "$1"' _ \
  /opt/hellotalk-factory/build-context
# Repository git ops above already ran as dev via runuser; this stays as a
# defensive backstop in case anything else touched it.
chown -R dev:dev "$REPOSITORY"

# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
# 7. Restart and verify.
# - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -
log "Starting factory service"
systemctl reset-failed "$SERVICE" || true
systemctl start "$SERVICE"
if [ "$secondary_was_active" = true ]; then
  systemctl reset-failed "$SECONDARY_SERVICE" || true
  systemctl start "$SECONDARY_SERVICE"
fi

sleep "$RESTART_GRACE_SECONDS"

if systemctl is-active --quiet "$SERVICE"; then
  if [ "$secondary_was_active" = true ] && ! systemctl is-active --quiet "$SECONDARY_SERVICE"; then
    log "ERROR: secondary Factory failed to start after update - check journalctl -u $SECONDARY_SERVICE"
    exit 1
  fi
  log "Factory restarted successfully at ${pulled_sha:0:12}"
  update_completed=true
else
  log "ERROR: factory failed to start after update - check journalctl -u $SERVICE"
  exit 1
fi
