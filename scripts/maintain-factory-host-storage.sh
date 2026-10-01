#!/usr/bin/env bash
# Keep every storage domain used by the Factory bounded without deleting
# credentials, provider history, named images, containers, or volumes.
set -euo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
JOURNAL_POLICY_SOURCE="$SCRIPT_DIRECTORY/../config/systemd/99-hellotalk-factory-storage.conf"
JOURNAL_POLICY_TARGET=/etc/systemd/journald.conf.d/99-hellotalk-factory-storage.conf
FACTORY_USER=${FACTORY_STORAGE_USER:-dev}
FACTORY_HOME=${FACTORY_STORAGE_HOME:-/home/dev}
FACTORY_VENV=${FACTORY_STORAGE_VENV:-/opt/hellotalk-factory/venv}
PRUNE_AGE=${FACTORY_CONTAINER_PRUNE_AGE:-168h}
DOCKER_CACHE_LIMIT=${FACTORY_DOCKER_CACHE_LIMIT:-2GB}
MINIMUM_FREE_GIB=${FACTORY_MINIMUM_FREE_DISK_GIB:-5}
FREE_HEADROOM_GIB=${FACTORY_STORAGE_FREE_HEADROOM_GIB:-1}
LOCK_FILE=${FACTORY_STORAGE_MAINTENANCE_LOCK:-/run/lock/hellotalk-factory-storage.lock}
APPLY=false
PRUNE_CONTAINERS=false
STORAGE_TARGET_KIB=''

usage() {
  cat <<'USAGE'
Usage: maintain-factory-host-storage.sh [--apply] [--prune-containers]

Without --apply, reports root, journal, Docker, rootless Podman, Factory-state,
and provider-home usage without changing the host.

With --apply, installs the bounded journal policy only when it changed, vacuums
archived journal entries, prunes unused uv cache records, and performs the
bounded one-time migration of a legacy verified updater into the neutral Repo
Factory runtime when that runtime is present. Add --prune-containers to remove
dangling Docker/Podman images older than seven days and bounded Docker/Podman
build cache. If either container store falls below the Factory reserve plus
headroom, the age grace is dropped for dangling images and build cache only.

The historical --prune-docker name is retained as an alias. This command never
removes volumes, named images, running/stopped containers, provider credentials,
or provider history databases.
USAGE
}

for argument in "$@"; do
  case "$argument" in
    --apply) APPLY=true ;;
    --prune-containers|--prune-docker) PRUNE_CONTAINERS=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $argument" >&2; usage >&2; exit 2 ;;
  esac
done

if [ "$PRUNE_CONTAINERS" = true ] && [ "$APPLY" != true ]; then
  echo '--prune-docker requires --apply; --prune-containers has the same requirement.' >&2
  exit 2
fi

log() { printf '[%s] factory-storage: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

calculate_storage_target() {
  awk -v reserve="$MINIMUM_FREE_GIB" -v headroom="$FREE_HEADROOM_GIB" '
    BEGIN {
      number = "^[0-9]+([.][0-9]+)?$"
      if (reserve !~ number || headroom !~ number || reserve <= 0 || headroom <= 0) {
        exit 1
      }
      printf "%.0f\n", (reserve + headroom) * 1024 * 1024
    }
  '
}

if ! STORAGE_TARGET_KIB=$(calculate_storage_target); then
  log "WARNING: invalid storage reserve/headroom; using 6 GiB target"
  STORAGE_TARGET_KIB=$((6 * 1024 * 1024))
fi

factory_uid() {
  id -u "$FACTORY_USER" 2>/dev/null
}

run_as_factory_user() {
  local uid
  uid=$(factory_uid) || return 1
  if [ "$(id -u)" -eq "$uid" ]; then
    env \
      HOME="$FACTORY_HOME" \
      XDG_RUNTIME_DIR="/run/user/$uid" \
      PATH="$FACTORY_HOME/.local/bin:$FACTORY_HOME/.opencode/bin:$FACTORY_HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin" \
      "$@"
  elif [ "$(id -u)" -eq 0 ]; then
    runuser -u "$FACTORY_USER" -- env \
      HOME="$FACTORY_HOME" \
      XDG_RUNTIME_DIR="/run/user/$uid" \
      PATH="$FACTORY_HOME/.local/bin:$FACTORY_HOME/.opencode/bin:$FACTORY_HOME/.npm-global/bin:/usr/local/bin:/usr/bin:/bin" \
      "$@"
  else
    return 1
  fi
}

filesystem_free_kib() {
  df -Pk -- "$1" 2>/dev/null | awk 'NR == 2 {print $4}'
}

filesystem_below_target() {
  local free
  free=$(filesystem_free_kib "$1") || return 1
  case "$free" in
    ''|*[!0-9]*) return 1 ;;
  esac
  [ "$free" -lt "$STORAGE_TARGET_KIB" ]
}

report_provider_home() {
  local path size source
  for path in \
    "$FACTORY_HOME/.cache" \
    "$FACTORY_HOME/.local" \
    "$FACTORY_HOME/.gemini" \
    "$FACTORY_HOME/.pi" \
    "$FACTORY_HOME/.codex" \
    "$FACTORY_HOME/.claude" \
    "$FACTORY_HOME/.npm" \
    "$FACTORY_HOME/.npm-global" \
    "$FACTORY_HOME/.opencode" \
    "$FACTORY_HOME/.config"; do
    [ -e "$path" ] || continue
    size=$(du -sh "$path" 2>/dev/null | awk '{print $1}' || printf '?')
    source=$(findmnt -no SOURCE -T "$path" 2>/dev/null || printf 'unknown')
    printf '%-36s %8s  %s\n' "$path" "$size" "$source"
  done
}

report_usage() {
  echo 'Root filesystem:'
  df -h /
  if [ -e /var/lib/hellotalk-factory ]; then
    echo 'Factory-state filesystem:'
    df -h /var/lib/hellotalk-factory
  fi
  printf 'Container pressure target: %s GiB reserve + %s GiB headroom\n' \
    "$MINIMUM_FREE_GIB" "$FREE_HEADROOM_GIB"
  journalctl --disk-usage || true

  if command -v docker >/dev/null 2>&1; then
    echo 'Docker storage:'
    if ! docker system df; then
      echo 'Docker usage requires access to the Docker daemon.' >&2
    fi
  else
    echo 'Docker: not installed'
  fi

  if command -v podman >/dev/null 2>&1 && factory_uid >/dev/null; then
    echo 'Rootless Podman storage:'
    if ! run_as_factory_user "$(command -v podman)" system df; then
      echo 'Rootless Podman usage could not be inspected.' >&2
    fi
  else
    echo 'Rootless Podman: not installed or Factory user missing'
  fi

  echo 'Provider and tool state:'
  report_provider_home
}

install_journal_policy() {
  if [ ! -r "$JOURNAL_POLICY_SOURCE" ]; then
    echo "Missing journal policy: $JOURNAL_POLICY_SOURCE" >&2
    return 1
  fi
  if ! install -d -o root -g root -m 0755 /etc/systemd/journald.conf.d; then
    return 1
  fi
  if [ ! -f "$JOURNAL_POLICY_TARGET" ] || ! cmp -s "$JOURNAL_POLICY_SOURCE" "$JOURNAL_POLICY_TARGET"; then
    if ! install -o root -g root -m 0644 "$JOURNAL_POLICY_SOURCE" "$JOURNAL_POLICY_TARGET"; then
      return 1
    fi
    if ! systemctl restart systemd-journald.service; then
      return 1
    fi
    if ! journalctl --rotate; then
      return 1
    fi
    log 'Installed updated journal retention policy'
  fi
  journalctl --vacuum-size=512M --vacuum-time=14day
}

prune_uv_cache() {
  local uv="$FACTORY_VENV/bin/uv"
  if [ ! -x "$uv" ] || ! factory_uid >/dev/null; then
    return 0
  fi
  if ! run_as_factory_user "$uv" cache prune; then
    log 'WARNING: uv cache prune failed'
  fi
}

bootstrap_repo_factory_updater() {
  local legacy=/opt/hellotalk-factory/hellotalk-factory-update.sh
  local neutral_root=/opt/repo-factory
  local neutral="$neutral_root/repo-factory-update.sh"
  local marker=FACTORY_PROVIDER_CONFIG_RECONCILIATION_V1

  [ -e "$neutral_root" ] || return 0
  if [ ! -d "$neutral_root" ] || [ -L "$neutral_root" ] || \
    [ "$(readlink -f -- "$neutral_root")" != "$neutral_root" ] || \
    [ "$(stat -Lc '%u:%g:%a' -- "$neutral_root")" != '0:0:755' ]; then
    log "WARNING: neutral Repo Factory runtime root is not a safe root-owned directory"
    return 1
  fi
  if [ ! -f "$legacy" ] || [ -L "$legacy" ] || \
    [ "$(stat -Lc '%u:%g:%a' -- "$legacy")" != '0:0:755' ]; then
    log 'WARNING: verified legacy updater is unavailable for neutral-runtime bootstrap'
    return 1
  fi
  if [ -L "$neutral" ]; then
    log 'WARNING: refusing to replace symlinked neutral Repo Factory updater'
    return 1
  fi
  if [ -f "$neutral" ] && grep -q "$marker" "$neutral"; then
    return 0
  fi
  if ! grep -q "$marker" "$legacy"; then
    # The old updater installs the new verified legacy runtime after its first
    # pull. A later bounded maintenance pass sees the marker and completes the
    # one-time neutral-runtime migration without copying stale code.
    return 0
  fi
  if ! install -o root -g root -m 0755 "$legacy" "$neutral"; then
    log 'WARNING: failed to bootstrap the neutral Repo Factory updater'
    return 1
  fi
  log 'Bootstrapped neutral Repo Factory updater from verified legacy runtime'
}

prune_docker_storage() {
  local docker docker_root
  docker=$(command -v docker 2>/dev/null) || {
    log 'Docker not installed; skipping Docker cleanup'
    return 0
  }
  if ! "$docker" info >/dev/null 2>&1; then
    log 'Docker daemon unavailable; skipping Docker cleanup'
    return 0
  fi
  docker_root=$("$docker" info --format '{{.DockerRootDir}}' 2>/dev/null || true)

  if ! "$docker" image prune --force --filter "until=$PRUNE_AGE"; then
    log 'WARNING: Docker image prune failed'
  fi
  # docker builder prune owns --keep-storage; --max-used-space belongs to
  # buildx and made the prior maintenance path version-dependent.
  if ! "$docker" builder prune --force --filter "until=$PRUNE_AGE" \
    --keep-storage "$DOCKER_CACHE_LIMIT"; then
    log 'WARNING: Docker builder prune failed'
  fi

  if [ -n "$docker_root" ] && [ -d "$docker_root" ] && \
    filesystem_below_target "$docker_root"; then
    log 'Docker filesystem is below target; dropping age grace for dangling/build cache'
    "$docker" image prune --force || log 'WARNING: pressure Docker image prune failed'
    "$docker" builder prune --force --keep-storage "$DOCKER_CACHE_LIMIT" || \
      log 'WARNING: pressure Docker builder prune failed'
  fi
}

prune_podman_storage() {
  local podman graph_root supports_build_cache=false
  podman=$(command -v podman 2>/dev/null) || {
    log 'Podman not installed; skipping rootless Podman cleanup'
    return 0
  }
  if ! factory_uid >/dev/null; then
    log "Factory user $FACTORY_USER is missing; skipping rootless Podman cleanup"
    return 0
  fi
  if ! run_as_factory_user "$podman" info >/dev/null 2>&1; then
    log 'Rootless Podman unavailable; skipping Podman cleanup'
    return 0
  fi
  graph_root=$(
    run_as_factory_user "$podman" info --format '{{.Store.GraphRoot}}' 2>/dev/null || true
  )

  local -a arguments=(image prune --force --filter "until=$PRUNE_AGE")
  if run_as_factory_user "$podman" image prune --help 2>/dev/null | grep -q -- '--build-cache'; then
    supports_build_cache=true
    arguments+=(--build-cache)
  fi
  if ! run_as_factory_user "$podman" "${arguments[@]}"; then
    log 'WARNING: rootless Podman image/build-cache prune failed'
  fi

  # Podman exposes no keep-storage budget for image prune. Bound a burst inside
  # the seven-day grace with filesystem pressure: remove every dangling image
  # and persistent build-cache entry, while still preserving named images,
  # containers, and volumes.
  if [ -n "$graph_root" ] && [ -d "$graph_root" ] && \
    filesystem_below_target "$graph_root"; then
    log 'Podman filesystem is below target; dropping age grace for dangling/build cache'
    local -a pressure_arguments=(image prune --force)
    if [ "$supports_build_cache" = true ]; then
      pressure_arguments+=(--build-cache)
    fi
    if ! run_as_factory_user "$podman" "${pressure_arguments[@]}"; then
      log 'WARNING: pressure rootless Podman image/build-cache prune failed'
    fi
    if filesystem_below_target "$graph_root"; then
      log 'WARNING: Podman filesystem remains below target after safe cache eviction'
    fi
  fi
}

if [ "$APPLY" != true ]; then
  report_usage
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run --apply with sudo.' >&2
  exit 1
fi

install -d -o root -g root -m 0755 "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log 'Another storage-maintenance pass is already active; skipping'
  exit 0
fi

if ! bootstrap_repo_factory_updater; then
  log 'WARNING: neutral Repo Factory updater bootstrap failed'
fi
if ! install_journal_policy; then
  log 'WARNING: journal policy/vacuum maintenance failed'
fi
prune_uv_cache
if [ "$PRUNE_CONTAINERS" = true ]; then
  prune_docker_storage
  prune_podman_storage
fi

root_summary=$(df -hP / | awk 'NR == 2 {printf "%s used, %s free", $5, $4}')
state_summary='not present'
if [ -e /var/lib/hellotalk-factory ]; then
  state_summary=$(df -hP /var/lib/hellotalk-factory | awk 'NR == 2 {printf "%s used, %s free", $5, $4}')
fi
log "maintenance complete: root=$root_summary; factory-state=$state_summary"
