#!/usr/bin/env bash
# Daily factory self-update: pull main, reinstall Python package, restart.
#
# Safety contract:
#   - Never restarts while active jobs are running (checked via daemon.json).
#   - Only pulls if the remote has new commits (fast-forward only - no merges).
#   - Materialises root-owned runtime scripts and provider policy from immutable
#     Git blobs, never from the Factory-user-writable working tree.
#   - Three-way provider-policy reconciliation preserves host overrides while
#     adopting repository changes the host had not overridden.
#   - Provider config is schema-validated after package refresh and rolled back
#     automatically if any later update step or service restart fails.
#   - Aborts on any error; the EXIT trap restores services stopped by an update.
#   - Logs every decision so journalctl -u hellotalk-factory-update traces the run.
# FACTORY_PROVIDER_CONFIG_RECONCILIATION_V1
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
REPO_RUNTIME_ROOT=/opt/repo-factory
RUNTIME_SOURCE_SHA_FILE="$RUNTIME_ROOT/runtime-source.sha"
RUNTIME_MAINTENANCE="$RUNTIME_ROOT/scripts/maintain-factory-host-storage.sh"
AGENTS_CONFIG=${FACTORY_AGENTS_CONFIG:-/etc/hellotalk-factory/agents.json}
AGENTS_CONFIG_SOURCE=config/factory/agents.production.json
RESTART_GRACE_SECONDS=${FACTORY_UPDATE_RESTART_GRACE_SECONDS:-60}
ACTIVE_JOB_WAIT_SECONDS=${FACTORY_UPDATE_ACTIVE_JOB_WAIT_SECONDS:-300}
GIT_TIMEOUT=${FACTORY_UPDATE_GIT_TIMEOUT:-120}
MAINTENANCE_ONLY=false
update_completed=false
services_stopped=false
secondary_was_active=false
agents_config_changed=false
agents_config_backup=

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

validate_agents_config() {
  "$FACTORY_VENV/bin/python" - "$AGENTS_CONFIG" <<'PY'
import sys
from pathlib import Path

from openhands_factory.config import AgentsConfig

AgentsConfig.model_validate_json(Path(sys.argv[1]).read_text(encoding="utf-8"))
PY
}

restore_agents_config_on_failure() {
  if [ "$agents_config_changed" != true ]; then
    return 0
  fi
  log 'Update failed after provider-config reconciliation - restoring previous config'
  if [ "$agents_config_backup" = __absent__ ]; then
    if ! rm -f -- "$AGENTS_CONFIG"; then
      log 'ERROR: could not remove newly installed provider config during rollback'
      return 1
    fi
    log 'ERROR: previous provider config was absent; refusing automatic service restart'
    return 1
  fi
  if [ -z "$agents_config_backup" ] || [ ! -f "$agents_config_backup" ]; then
    log 'ERROR: provider-config rollback copy is missing; refusing service restart'
    return 1
  fi
  if ! mv -fT -- "$agents_config_backup" "$AGENTS_CONFIG"; then
    log 'ERROR: could not restore previous provider config; refusing service restart'
    return 1
  fi
  if ! chown "root:$FACTORY_USER" "$AGENTS_CONFIG" || ! chmod 0640 "$AGENTS_CONFIG"; then
    log 'ERROR: could not restore provider-config access metadata; refusing service restart'
    return 1
  fi
  if ! validate_agents_config; then
    log 'ERROR: restored provider config is invalid under the installed schema; refusing restart'
    return 1
  fi
  agents_config_changed=false
  return 0
}

restore_services_on_failure() {
  if [ "$services_stopped" = true ] && [ "$update_completed" = false ]; then
    if ! restore_agents_config_on_failure; then
      log 'ERROR: provider config rollback was not confirmed; services remain stopped'
      return 1
    fi
    log "Update failed after service stop - restarting services against restored config"
    systemctl reset-failed "$SERVICE" || true
    systemctl restart "$SERVICE" || true
    if [ "$secondary_was_active" = true ]; then
      systemctl reset-failed "$SECONDARY_SERVICE" || true
      systemctl restart "$SECONDARY_SERVICE" || true
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
  if ! actual=$(
    factory_git_read cat-file commit "$commit" | git hash-object -t commit --stdin
  ); then
    return 1
  fi
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

canonical_agents_config_path() {
  local candidate=${1:-$AGENTS_CONFIG}
  local canonical
  canonical=$(readlink -m -- "$candidate") || return 1
  case "$canonical" in
    /etc/repo-factory/*|/etc/hellotalk-factory/*) printf '%s\n' "$canonical" ;;
    *)
      log "Refusing provider-config path outside an approved /etc Factory root: $candidate"
      return 1
      ;;
  esac
}

agents_config_metadata_current() {
  local config=$1
  local factory_gid parent
  factory_gid=$(id -g "$FACTORY_USER") || return 1
  parent=$(dirname -- "$config")
  [ -f "$config" ] || return 1
  [ "$(stat -Lc '%u:%g:%a' -- "$config")" = "0:${factory_gid}:640" ] || return 1
  [ -d "$parent" ] || return 1
  [ "$(stat -Lc '%u:%g:%a' -- "$parent")" = "0:${factory_gid}:750" ]
}

repo_runtime_root_safe() {
  [ -d "$REPO_RUNTIME_ROOT" ] || return 1
  [ ! -L "$REPO_RUNTIME_ROOT" ] || return 1
  [ "$(readlink -f -- "$REPO_RUNTIME_ROOT")" = "$REPO_RUNTIME_ROOT" ] || return 1
  [ "$(stat -Lc '%u:%g:%a' -- "$REPO_RUNTIME_ROOT")" = '0:0:755' ]
}

install_runtime_file_from_commit() {
  local commit=$1
  local relative_path=$2
  local destination=$3
  local mode=$4
  local owner=${5:-root}
  local group=${6:-root}
  local directory_mode=${7:-0755}
  local actual_blob expected_blob temporary

  if ! expected_blob=$(factory_git_read rev-parse "${commit}:${relative_path}"); then
    log "Could not resolve $relative_path from verified commit $commit"
    return 1
  fi
  [[ "$expected_blob" =~ ^[0-9a-f]{40,64}$ ]] || {
    log "Invalid blob identity for $relative_path"
    return 1
  }
  if ! install -d -o "$owner" -g "$group" -m "$directory_mode" \
    "$(dirname "$destination")"; then
    return 1
  fi
  if ! temporary=$(mktemp "${destination}.new.XXXXXX"); then
    return 1
  fi
  if ! factory_git_read cat-file blob "$expected_blob" > "$temporary"; then
    rm -f "$temporary"
    return 1
  fi
  if ! actual_blob=$(git hash-object "$temporary"); then
    rm -f "$temporary"
    return 1
  fi
  if [ "$actual_blob" != "$expected_blob" ]; then
    rm -f "$temporary"
    log "Blob verification failed for $relative_path"
    return 1
  fi
  if [ -f "$destination" ] && cmp -s "$temporary" "$destination"; then
    rm -f "$temporary"
    chown "$owner:$group" "$destination" && chmod "$mode" "$destination"
    return
  fi
  if ! chown "$owner:$group" "$temporary" || \
    ! chmod "$mode" "$temporary" || \
    ! mv -fT -- "$temporary" "$destination"; then
    rm -f "$temporary"
    return 1
  fi
}

record_runtime_commit() {
  local commit=$1
  local temporary
  if ! temporary=$(mktemp "${RUNTIME_SOURCE_SHA_FILE}.new.XXXXXX"); then
    return 1
  fi
  if ! printf '%s\n' "$commit" > "$temporary" || \
    ! chown root:root "$temporary" || \
    ! chmod 0644 "$temporary" || \
    ! mv -fT -- "$temporary" "$RUNTIME_SOURCE_SHA_FILE"; then
    rm -f "$temporary"
    return 1
  fi
}

install_runtime_bundle() {
  local commit=$1
  verify_commit_identity "$commit" || return 1
  install_runtime_file_from_commit \
    "$commit" scripts/maintain-factory-host-storage.sh \
    "$RUNTIME_MAINTENANCE" 0755 || return 1
  install_runtime_file_from_commit \
    "$commit" config/systemd/99-hellotalk-factory-storage.conf \
    "$RUNTIME_ROOT/config/systemd/99-hellotalk-factory-storage.conf" 0644 || return 1
  install_runtime_file_from_commit \
    "$commit" config/systemd/hellotalk-factory-watchdog.sh \
    "$RUNTIME_ROOT/hellotalk-factory-watchdog.sh" 0755 || return 1
  install_runtime_file_from_commit \
    "$commit" config/systemd/hellotalk-factory-update.sh \
    "$RUNTIME_ROOT/hellotalk-factory-update.sh" 0755 || return 1

  if [ -e "$REPO_RUNTIME_ROOT" ]; then
    if ! repo_runtime_root_safe; then
      log "Refusing to refresh unsafe neutral runtime root: $REPO_RUNTIME_ROOT"
      return 1
    fi
    install_runtime_file_from_commit \
      "$commit" config/systemd/repo-factory-watchdog.sh \
      "$REPO_RUNTIME_ROOT/repo-factory-watchdog.sh" 0755 || return 1
    install_runtime_file_from_commit \
      "$commit" config/systemd/hellotalk-factory-update.sh \
      "$REPO_RUNTIME_ROOT/repo-factory-update.sh" 0755 || return 1
  fi

  record_runtime_commit "$commit" || return 1
}

reconcile_agents_config_from_commits() {
  local base_commit=$1
  local desired_commit=$2
  local canonical parent workspace temporary

  verify_commit_identity "$base_commit" || return 1
  verify_commit_identity "$desired_commit" || return 1
  canonical=$(canonical_agents_config_path "$AGENTS_CONFIG") || return 1
  AGENTS_CONFIG=$canonical
  parent=$(dirname -- "$AGENTS_CONFIG")
  install -d -o root -g "$FACTORY_USER" -m 0750 "$parent"

  workspace=$(mktemp -d /run/repo-factory-agents.XXXXXX) || return 1
  chmod 0700 "$workspace"
  if ! install_runtime_file_from_commit \
    "$base_commit" "$AGENTS_CONFIG_SOURCE" "$workspace/base.json" 0600 root root 0700 || \
    ! install_runtime_file_from_commit \
    "$desired_commit" "$AGENTS_CONFIG_SOURCE" "$workspace/desired.json" 0600 root root 0700; then
    rm -rf -- "$workspace"
    return 1
  fi

  if [ -f "$AGENTS_CONFIG" ]; then
    cp -- "$AGENTS_CONFIG" "$workspace/local.json"
  else
    cp -- "$workspace/base.json" "$workspace/local.json"
  fi

  if ! "$FACTORY_VENV/bin/python" -m openhands_factory.config_reconcile \
    "$workspace/base.json" "$workspace/local.json" \
    "$workspace/desired.json" "$workspace/merged.json"; then
    rm -rf -- "$workspace"
    return 1
  fi

  if [ -f "$AGENTS_CONFIG" ] && cmp -s "$workspace/merged.json" "$AGENTS_CONFIG" && \
    agents_config_metadata_current "$AGENTS_CONFIG"; then
    rm -rf -- "$workspace"
    validate_agents_config
    return
  fi

  if [ -f "$AGENTS_CONFIG" ]; then
    agents_config_backup=$(mktemp "${AGENTS_CONFIG}.rollback.XXXXXX")
    cp --preserve=mode,ownership -- "$AGENTS_CONFIG" "$agents_config_backup"
  else
    agents_config_backup=__absent__
  fi
  agents_config_changed=true

  temporary=$(mktemp "${AGENTS_CONFIG}.new.XXXXXX") || {
    rm -rf -- "$workspace"
    return 1
  }
  if ! install -o root -g "$FACTORY_USER" -m 0640 \
    "$workspace/merged.json" "$temporary" || \
    ! mv -fT -- "$temporary" "$AGENTS_CONFIG"; then
    rm -f -- "$temporary"
    rm -rf -- "$workspace"
    return 1
  fi
  rm -rf -- "$workspace"
  validate_agents_config
}

run_storage_maintenance() {
  local commit
  commit=$(trusted_runtime_commit) || {
    log 'No verified runtime commit is available; refusing root maintenance refresh'
    return 1
  }
  install_runtime_bundle "$commit" || return 1
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
config_is_current=false
config_path=$(canonical_agents_config_path "$AGENTS_CONFIG" 2>/dev/null || true)
if [ -n "$config_path" ] && agents_config_metadata_current "$config_path"; then
  AGENTS_CONFIG=$config_path
  if validate_agents_config; then
    config_is_current=true
  fi
fi

if [ "$local_sha" = "$remote_sha" ] && [ "$config_is_current" = true ]; then
  log "Already up to date at ${local_sha:0:12} with valid provider config - no restart needed"
  exit 0
fi

if [ "$local_sha" = "$remote_sha" ]; then
  log "Repository is current at ${local_sha:0:12}, but provider config needs repair"
else
  log "New commits on main: ${local_sha:0:12} -> ${remote_sha:0:12}"
  merge_base=$(factory_git_read merge-base HEAD origin/main)
  if [ "$merge_base" != "$local_sha" ]; then
    log "ERROR: local main has diverged from origin/main (merge-base=${merge_base:0:12}) - refusing non-fast-forward update"
    exit 1
  fi
fi
verify_commit_identity "$local_sha" || {
  log 'ERROR: current checkout identity could not be verified'
  exit 1
}
verify_commit_identity "$remote_sha" || {
  log 'ERROR: origin/main identity could not be verified'
  exit 1
}

log 'Stopping factory service'
systemctl stop "$SERVICE" || true
services_stopped=true
if [ -n "$SECONDARY_SERVICE" ] && systemctl is-active --quiet "$SECONDARY_SERVICE"; then
  secondary_was_active=true
  systemctl stop "$SECONDARY_SERVICE" || true
fi

if [ "$local_sha" != "$remote_sha" ]; then
  log 'Pulling main'
  timeout "${GIT_TIMEOUT}s" \
    runuser -u "$FACTORY_USER" -- env \
    HOME="$FACTORY_HOME" GH_TOKEN="${GITHUB_TOKEN:-}" \
    git -c credential.helper='!gh auth git-credential' \
    -C "$REPOSITORY" pull --ff-only origin main
fi

pulled_sha=$(factory_git_read rev-parse HEAD)
if [ "$pulled_sha" != "$remote_sha" ] || ! verify_commit_identity "$pulled_sha"; then
  log 'ERROR: deployed checkout does not match the verified origin/main identity'
  exit 1
fi
log "Deploying verified commit ${pulled_sha:0:12}"

log 'Refreshing root-owned Factory runtime scripts from verified Git blobs'
if ! install_runtime_bundle "$pulled_sha"; then
  log 'ERROR: could not install the verified runtime bundle'
  exit 1
fi

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

log 'Reconciling repository provider policy while preserving host overrides'
reconcile_agents_config_from_commits "$local_sha" "$pulled_sha"

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
  if [ -n "$agents_config_backup" ] && [ "$agents_config_backup" != __absent__ ]; then
    rm -f -- "$agents_config_backup" || \
      log 'WARNING: could not remove successful provider-config rollback copy'
  fi
else
  log "ERROR: factory failed to start after update - check journalctl -u $SERVICE"
  exit 1
fi
