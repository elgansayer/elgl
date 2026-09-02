#!/usr/bin/env bash
# Move growth-prone subscription-agent and tool state off the non-resizable
# root filesystem while preserving every provider's normal path and ownership.
set -euo pipefail

FACTORY_USER=${RELOCATE_CACHE_USER:-dev}
FACTORY_HOME=${RELOCATE_CACHE_HOME:-/home/dev}
SERVICE=${RELOCATE_CACHE_SERVICE:-hellotalk-factory.service}
# The Factory state/log volume is already attached and mounted in production.
# It is a usable default now that recovery archives are independently bounded.
MOUNT_POINT=${RELOCATE_CACHE_MOUNT_POINT:-/mnt/HC_Volume_106574422}
DEVICE_BY_ID=${RELOCATE_CACHE_DEVICE_BY_ID:-}
CACHE_ROOT=${RELOCATE_CACHE_ROOT:-$MOUNT_POINT/provider-home}
APPLY=false
SERVICE_WAS_ACTIVE=false
MIGRATION_STARTED=false
MIGRATION_SUCCEEDED=false

# These paths contain provider credentials/history or reproducible tool caches
# known to grow during continuous multi-provider operation. Bind mounts keep the
# original CLI paths stable. They are migrated, never pruned as opaque data.
RELOCATABLE_DIRECTORIES=(
  .cache
  .local
  .gemini
  .pi
  .codex
  .claude
  .npm
  .npm-global
  .opencode
  .config
)

usage() {
  cat <<'USAGE'
Usage: relocate-home-cache-to-second-disk.sh [--apply]

Without --apply, reports the mounted backing filesystem and which growth-prone
provider/tool directories still consume root storage.

With --apply (must run as root), migrates each path to the already-mounted
secondary volume, verifies the copy with a dry-run checksum comparison, creates
an idempotent bind mount, restores ownership, and returns the Factory service to
its prior running/stopped state.

The default target is /mnt/HC_Volume_106574422, the existing Factory secondary
volume. To prepare a different unformatted attached disk, set both
RELOCATE_CACHE_MOUNT_POINT and RELOCATE_CACHE_DEVICE_BY_ID; the latter is never
required or formatted when the mount point is already active.
USAGE
}

for argument in "$@"; do
  case "$argument" in
    --apply) APPLY=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $argument" >&2; usage >&2; exit 2 ;;
  esac
done

log() { printf '[%s] relocate-provider-home: %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*"; }

source_for() {
  findmnt -no SOURCE -T "$1" 2>/dev/null || printf 'unmounted'
}

report_status() {
  local directory size source target
  if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
    log "Secondary volume mounted at $MOUNT_POINT ($(source_for "$MOUNT_POINT"))"
    df -h "$MOUNT_POINT"
  else
    log "Secondary volume is not mounted at $MOUNT_POINT"
    if [ -n "$DEVICE_BY_ID" ]; then
      if [ -e "$DEVICE_BY_ID" ]; then
        log "Configured device is present: $DEVICE_BY_ID -> $(readlink -f "$DEVICE_BY_ID")"
      else
        log "Configured device is absent: $DEVICE_BY_ID"
      fi
    fi
  fi

  for directory in "${RELOCATABLE_DIRECTORIES[@]}"; do
    target="$FACTORY_HOME/$directory"
    if mountpoint -q "$target" 2>/dev/null; then
      log "$target: relocated ($(source_for "$target"))"
    elif [ -e "$target" ]; then
      size=$(du -sh "$target" 2>/dev/null | awk '{print $1}' || printf '?')
      source=$(source_for "$target")
      log "$target: not bind-mounted ($size on $source)"
    else
      log "$target: absent"
    fi
  done
}

restore_service_on_failure() {
  if [ "$MIGRATION_STARTED" = true ] && \
    [ "$MIGRATION_SUCCEEDED" = false ] && \
    [ "$SERVICE_WAS_ACTIVE" = true ]; then
    log 'Migration failed; restoring the previously running Factory service'
    systemctl reset-failed "$SERVICE" || true
    systemctl start "$SERVICE" || true
  fi
}
trap restore_service_on_failure EXIT

if [ "$APPLY" != true ]; then
  report_status
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run --apply with sudo.' >&2
  exit 1
fi
if ! id "$FACTORY_USER" >/dev/null 2>&1; then
  echo "Factory user does not exist: $FACTORY_USER" >&2
  exit 1
fi

if ! mountpoint -q "$MOUNT_POINT"; then
  if [ -z "$DEVICE_BY_ID" ] || [ ! -e "$DEVICE_BY_ID" ]; then
    echo "Secondary volume is not mounted at $MOUNT_POINT." >&2
    echo 'Mount it first, or configure an attached RELOCATE_CACHE_DEVICE_BY_ID.' >&2
    exit 1
  fi
  if ! blkid "$DEVICE_BY_ID" >/dev/null 2>&1; then
    log "Formatting explicitly configured device $DEVICE_BY_ID as ext4"
    mkfs.ext4 -q "$DEVICE_BY_ID"
  fi
  mkdir -p "$MOUNT_POINT"
  fstab_source=$(awk -v target="$MOUNT_POINT" '$2 == target {print $1; exit}' /etc/fstab)
  if [ -z "$fstab_source" ]; then
    device_uuid=$(blkid -s UUID -o value "$DEVICE_BY_ID")
    if [ -z "$device_uuid" ]; then
      echo "Could not read a filesystem UUID from $DEVICE_BY_ID" >&2
      exit 1
    fi
    printf 'UUID=%s %s ext4 defaults,nofail 0 2\n' "$device_uuid" "$MOUNT_POINT" >> /etc/fstab
  fi
  mount "$MOUNT_POINT"
fi

mount_source=$(source_for "$MOUNT_POINT")
if [ "$mount_source" = unmounted ]; then
  echo "Could not resolve a mounted source for $MOUNT_POINT" >&2
  exit 1
fi
install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0750 "$CACHE_ROOT"

pending=()
for directory in "${RELOCATABLE_DIRECTORIES[@]}"; do
  target="$FACTORY_HOME/$directory"
  if mountpoint -q "$target" 2>/dev/null; then
    continue
  fi
  pending+=("$directory")
done

if [ "${#pending[@]}" -eq 0 ]; then
  log 'Nothing to relocate; every existing provider/tool directory is bind-mounted'
  MIGRATION_SUCCEEDED=true
  report_status
  exit 0
fi

if systemctl is-active --quiet "$SERVICE"; then
  SERVICE_WAS_ACTIVE=true
  log 'Stopping Factory service for a consistent provider-state migration'
  systemctl stop "$SERVICE"
fi
MIGRATION_STARTED=true

for directory in "${pending[@]}"; do
  target="$FACTORY_HOME/$directory"
  destination="$CACHE_ROOT/$directory"
  install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0700 "$destination"
  if [ -e "$target" ]; then
    log "Copying $target -> $destination"
    rsync -aHAX --delete "$target/" "$destination/"
    # A checksum dry run must exit cleanly and report no difference before the
    # root copy moves. Keep command failure distinct from content mismatch.
    verification=$(mktemp)
    if ! rsync -aHAXnci --delete "$target/" "$destination/" > "$verification"; then
      rm -f "$verification"
      echo "Verification command failed while migrating $target" >&2
      exit 1
    fi
    if [ -s "$verification" ]; then
      rm -f "$verification"
      echo "Verification found differences while migrating $target" >&2
      exit 1
    fi
    rm -f "$verification"
    rm -rf --one-file-system -- "${target:?}"
  fi
  install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0700 "$target"
  chown -R "$FACTORY_USER:$FACTORY_USER" "$destination"

  fstab_line="$destination $target none bind,nofail,x-systemd.requires-mounts-for=$MOUNT_POINT 0 0"
  if ! grep -qF "$destination $target " /etc/fstab; then
    printf '%s\n' "$fstab_line" >> /etc/fstab
    log "Added persistent bind mount for $target"
  fi
  mount "$target"
  if ! mountpoint -q "$target"; then
    echo "Bind mount did not activate: $target" >&2
    exit 1
  fi
done

if [ "$SERVICE_WAS_ACTIVE" = true ]; then
  log 'Restarting Factory service'
  systemctl reset-failed "$SERVICE" || true
  systemctl start "$SERVICE"
fi
MIGRATION_SUCCEEDED=true

report_status
log 'Provider/tool state relocation completed without deleting history or credentials'
