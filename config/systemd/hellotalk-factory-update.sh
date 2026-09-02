#!/usr/bin/env bash
# Daily factory self-update: pull main, reinstall Python package, restart.
#
# Safety contract:
#   - Never restarts while active jobs are running (checked via daemon.json).
#   - Only pulls if the remote has new commits (fast-forward only - no merges).
#   - Materialises root-owned runtime scripts from immutable Git blobs, never
#     from the Factory-user-writable working tree.
#   - Aborts on any error; the EXIT trap restores services stopped by an update.
#   - Logs every decision so journalctl -u hellotalk-factory-update traces the run.
set -euo pipefail

FACTORY_USER=dev
FACTORY_HOME=/home/dev
REPOSITORY=${REPO_FACTORY_CONTROL_REPOSITORY:-/var/lib/hellotalk-factory/repository}
HEARTBEAT=${REPO_FACTORY_PRIMARY_HEARTBEAT:-/var/lib/hellotalk-factory/daemon.json}
SERVICE=${REPO_FACTORY_PRIMARY_SERVICE:-hellotalk-factory.service}
SECONDARY_SERVICE=${REPO_FACTORY_SECONDARY_SERVICE:-}
SECONDARY_HEARTBEAT=${REPO_FACTORY_SECONDARY_HEARTBEAT:-}
FACTORY_VENV=/opt/hellotalk-factory/venv
RUNTIME_ROOT=/opt/hellotalk-factory
RUNTIME_SOURCE_SHA_FILE="$RUNTIME_ROOT/runtime-source.sha"
RUNTIME_MAINTENANCE="$RUNTIME_ROOT/scripts/maintain-factory-host-storage.sh"
RESTART_GRACE_SECONDS=${FACTORY_UPDATE_RESTART_GRACE_SECONDS:-60}
ACTIVE_JOB_WAIT_SECONDS=${FACTORY_UPDATE_ACTIVE_JOB_WAIT_SECONDS:-300}
GIT_TIMEOUT=${FACTORY_UPDATE_GIT_TIMEOUT:-120}
MAINTENANCE_ONLY=false
update_completed=false
services_stopped=false
secondary_was_active=false

case "${1:-}" in
  '') ;;
  --maintenance-only) MAINTENANCE_ONLY=true ;;
  *) echo "Unknown argument: $1" >&2; exit 2 ;;
esac
if [ "$#" -gt 1 ]; then
  echo 'Too many arguments.' >&2
  exit 2
fi

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

factory_git_read() {
  runuser -u "$FACTORY_USER" -- env \
    HOME="$FACTORY_HOME" PATH=/usr/local/bin:/usr/bin:/bin \
    git -C "$REPOSITORY" "$@"
}

verify_commit_identity() {
  local actual commit=$1
  [[ "$commit" =~ ^[0-9a-f]{40,64}$ ]] || return 1
  actual=$(factory_git_read cat-file commit "$commit" | git hash-object -t commit --stdin)
  [ "$actual" = "$commit" ]
}

trusted_runtime_commit() {
  local branch head recorded tracking
  branch=$(factory_git_read symbolic-ref --quiet --short HEAD 2>/dev/null || true)
  head=$(factory_git_read rev-parse --verify HEAD 2>/dev/null || true)
  tracking=$(
    factory_git_read rev-parse --verify refs/remotes/origin/main 2>/dev/null || true
  )
  if [ "$branch" = main ] && [ -n "$head" ] && [ "$head" = "$tracking" ] && \
    verify_commit_identity "$head"; then
    printf '%s\n' "$head"
    return 0
  fi

  if [ -r "$RUNTIME_SOURCE_SHA_FILE" ]; then
    read -r recorded < "$RUNTIME_SOURCE_SHA_FILE" || recorded=''
    if verify_commit_identity "$recorded"; then
      printf '%s\n' "$recorded"
      return 0
    fi
  fi
  return 1
}

install_runtime_file_from_commit() {
  local commit=$1
  local relative_path=$2
  local destination=$3
  local mode=$4
  local actual_blob expected_blob temporary

  expected_blob=$(factory_git_read rev-parse "${commit}:${relative_path}")
  [[ "$expected_blob" =~ ^[0-9a-f]{40,64}$ ]] || {
    log "Invalid blob identity for $relative_path"
    return 1
  }
  install -d -o root -g root -m 0755 "$(dirname "$destination")"
  temporary=$(mktemp "${destination}.new.XXXXXX")
  if ! factory_git_read cat-file blob "$expected_blob" > "$temporary"; then
    rm -f "$temporary"
    return 1
  fi
  actual_blob=$(git hash-object "$temporary")
  if [ "$actual_blob" != "$expected_blob" ]; then
    rm -f "$temporary"
    log "Blob verification failed for $relative_path"
    return 1
  fi
  if [ -f "$destination" ] && cmp -s "$temporary" "$destination"; then
    rm -f "$temporary"
    return 0
  fi
  chown root:root "$temporary"
  chmod "$mode" "$temporary"
  # Replace paths instead of truncating running script inodes. Current updater
  # and watchdog processes can finish while the next invocation sees new code.
  mv -fT -- "$temporary" "$destination"
}

record_runtime_commit() {
  local commit=$1
  local temporary
  temporary=$(mktemp "${RUNTIME_SOURCE_SHA_FILE}.new.XXXXXX")
  printf '%s\n' "$commit" > "$temporary"
  chown root:root "$temporary"
  chmod 0644 "$temporary"
  mv -fT -- "$temporary" "$RUNTIME_SOURCE_SHA_FILE"
}

install_runtime_bundle() {
  local commit=$1
  verify_commit_identity "$commit"
  install_runtime_file_from_commit \
    "$commit" scripts/maintain-factory-host-storage.sh \
    "$RUNTIME_MAINTENANCE" 0755
  install_runtime_file_from_commit \
    "$commit" config/systemd/99-hellotalk-factory-storage.conf \
    "$RUNTIME_ROOT/config/systemd/99-hellotalk-factory-storage.conf" 0644
  install_runtime_file_from_commit \
    "$commit" config/systemd/hellotalk-factory-watchdog.sh \
    "$RUNTIME_ROOT/hellotalk-factory-watchdog.sh" 0755
  install_runtime_file_from_commit \
    "$commit" config/systemd/hellotalk-factory-update.sh \
    "$RUNTIME_ROOT/hellotalk-factory-update.sh" 0755
  record_runtime_commit "$commit"
}

run_storage_maintenance() {
  local commit
  commit=$(trusted_runtime_commit) || {
    log 'No verified runtime commit is available; refusing root maintenance refresh'
    return 1
  }
  install_runtime_bundle "$commit"
  "$RUNTIME_MAINTENANCE" --apply --prune-containers
}

if [ "$(id -u)" -ne 0 ]; then
  echo 'Factory update and maintenance must run as root.' >&2
  exit 1
fi

# Host maintenance runs before the idle/update gates and from root-owned,
# blob-verified runtime code. The watchdog calls the same bounded entry point
# hourly with --maintenance-only.
if [ "$MAINTENANCE_ONLY" = true ]; then
  run_storage_maintenance
  exit 0
fi
log 'Running host storage maintenance'
run_storage_maintenance || \
  log 'WARNING: host storage maintenance failed - continuing with the update'

active_jobs() {
  python3 - "$1" <<'PY'
import json
import sys
from pathlib import Path

try:
    data = json.loads(Path(sys.argv[1]).read_text())
    jobs = data.get("active_jobs", [])
    raise SystemExit(0 if not jobs else 1)
except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
    # Unknown state is not idle. Failing closed prevents a corrupt, missing or
    # temporarily unreadable heartbeat from authorising an in-place update.
    raise SystemExit(1)
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
log 'Factory is idle'

log 'Fetching origin/main'
timeout "${GIT_TIMEOUT}s" \
  runuser -u "$FACTORY_USER" -- env \
    HOME="$FACTORY_HOME" GH_TOKEN="${GITHUB_TOKEN:-}" \
    git -c credential.helper='!gh auth git-credential' \
    -C "$REPOSITORY" fetch --quiet origin main

local_sha=$(factory_git_read rev-parse HEAD)
remote_sha=$(factory_git_read rev-parse origin/main)

if [ "$local_sha" = "$remote_sha" ]; then
  log "Already up to date at ${local_sha:0:12} - no restart needed"
  exit 0
fi

log "New commits on main: ${local_sha:0:12} -> ${remote_sha:0:12}"
merge_base=$(factory_git_read merge-base HEAD origin/main)
if [ "$merge_base" != "$local_sha" ]; then
  log "ERROR: local main has diverged from origin/main (merge-base=${merge_base:0:12}) - manual intervention required"
  exit 1
fi

log 'Stopping factory service'
systemctl stop "$SERVICE" || true
services_stopped=true
if [ -n "$SECONDARY_SERVICE" ] && systemctl is-active --quiet "$SECONDARY_SERVICE"; then
  secondary_was_active=true
  systemctl stop "$SECONDARY_SERVICE" || true
fi

log 'Pulling main'
timeout "${GIT_TIMEOUT}s" \
  runuser -u "$FACTORY_USER" -- env \
    HOME="$FACTORY_HOME" GH_TOKEN="${GITHUB_TOKEN:-}" \
    git -c credential.helper='!gh auth git-credential' \
    -C "$REPOSITORY" pull --ff-only origin main

pulled_sha=$(factory_git_read rev-parse HEAD)
if [ "$pulled_sha" != "$remote_sha" ] || ! verify_commit_identity "$pulled_sha"; then
  log 'ERROR: pulled commit does not match the verified origin/main identity'
  exit 1
fi
log "Pulled to ${pulled_sha:0:12}"

log 'Refreshing root-owned Factory runtime scripts from verified Git blobs'
install_runtime_bundle "$pulled_sha"

log 'Reinstalling factory Python package'
# Ensure dev can write the venv before uv runs as dev. Running uv as root with
# HOME=/home/dev previously created unreadable root-owned cache entries there.
chown -R dev:dev "$FACTORY_VENV"
runuser -u "$FACTORY_USER" -- env \
  HOME="$FACTORY_HOME" VIRTUAL_ENV="$FACTORY_VENV" \
  "$FACTORY_VENV/bin/uv" sync \
    --active --frozen --inexact --no-editable --extra development \
    --project "$REPOSITORY/automation"
runuser -u "$FACTORY_USER" -- env HOME="$FACTORY_HOME" \
  "$FACTORY_VENV/bin/uv" cache prune || true

log 'Rebuilding the shared Factory worker image'
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
chown -R dev:dev "$REPOSITORY"

log 'Starting factory service'
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
