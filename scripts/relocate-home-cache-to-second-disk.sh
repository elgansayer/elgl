#!/usr/bin/env bash
# Move growth-prone subscription-agent and tool state off the non-resizable
# root filesystem while preserving every provider's normal path and ownership.
set -euo pipefail

FACTORY_USER=${RELOCATE_CACHE_USER:-dev}
FACTORY_HOME=${RELOCATE_CACHE_HOME:-/home/dev}
SERVICE=${RELOCATE_CACHE_SERVICE:-hellotalk-factory.service}
# Provider-native history is intentionally placed on its own expandable volume.
# Reusing the Factory state volume would merely move an unbounded growth source
# onto the filesystem whose reserve gates scheduling.
DEVICE_BY_ID=${RELOCATE_CACHE_DEVICE_BY_ID:-/dev/disk/by-id/scsi-0HC_Volume_106720613}
MOUNT_POINT=${RELOCATE_CACHE_MOUNT_POINT:-/mnt/HC_Volume_106720613}
CACHE_ROOT=${RELOCATE_CACHE_ROOT:-$MOUNT_POINT/home-dev}
FSTAB_PATH=${RELOCATE_CACHE_FSTAB_PATH:-/etc/fstab}
LOCK_FILE=${RELOCATE_CACHE_LOCK_FILE:-/run/lock/hellotalk-factory-provider-relocation.lock}
APPLY=false
SERVICE_WAS_ACTIVE=false
SERVICE_RESTART_SAFE=true
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
if [ -n "${RELOCATE_CACHE_DIRECTORIES:-}" ]; then
  IFS=' ' read -r -a RELOCATABLE_DIRECTORIES <<< "$RELOCATE_CACHE_DIRECTORIES"
fi

usage() {
  cat <<'USAGE'
Usage: relocate-home-cache-to-second-disk.sh [--apply]

Without --apply, reports the mounted backing filesystem and which growth-prone
provider/tool directories still consume root storage.

With --apply (must run as root), verifies the mounted filesystem is the
configured dedicated device, migrates each path, checksum-verifies the copy,
creates an idempotent bind mount, persists it, restores ownership, and returns
the Factory service to its prior running/stopped state.

The default target is the pre-staged dedicated provider-state volume
HC_Volume_106720613. Attach that volume first. To use another disk, set both
RELOCATE_CACHE_MOUNT_POINT and RELOCATE_CACHE_DEVICE_BY_ID. A configured device
is formatted only when the target is not already mounted and it has no existing
filesystem signature.
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

device_uuid() {
  blkid -s UUID -o value "$DEVICE_BY_ID" 2>/dev/null
}

mounted_uuid() {
  findmnt -n -o UUID -T "$MOUNT_POINT" 2>/dev/null
}

verify_dedicated_mount() {
  local expected mounted
  if [ ! -e "$DEVICE_BY_ID" ]; then
    echo "Configured provider-state device is absent: $DEVICE_BY_ID" >&2
    return 1
  fi
  expected=$(device_uuid) || true
  mounted=$(mounted_uuid) || true
  if [ -z "$expected" ]; then
    echo "Configured provider-state device has no readable UUID: $DEVICE_BY_ID" >&2
    return 1
  fi
  if [ -z "$mounted" ] || [ "$mounted" != "$expected" ]; then
    echo "Refusing provider-state migration: $MOUNT_POINT is not $DEVICE_BY_ID." >&2
    echo "Expected filesystem UUID $expected; mounted UUID is ${mounted:-unknown}." >&2
    return 1
  fi
}

append_fstab_line() {
  local line=$1
  local temporary
  if ! temporary=$(mktemp "${FSTAB_PATH}.factory.XXXXXX"); then
    return 1
  fi
  if ! cp --preserve=all "$FSTAB_PATH" "$temporary" || \
    ! printf '%s\n' "$line" >> "$temporary" || \
    ! mv -fT -- "$temporary" "$FSTAB_PATH"; then
    rm -f "$temporary"
    return 1
  fi
}

report_status() {
  local directory size source target
  if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
    log "Secondary volume mounted at $MOUNT_POINT ($(source_for "$MOUNT_POINT"))"
    if ! verify_dedicated_mount; then
      log 'WARNING: mounted provider-state volume does not match the configured device'
    fi
    df -h "$MOUNT_POINT"
  else
    log "Secondary volume is not mounted at $MOUNT_POINT"
    if [ -e "$DEVICE_BY_ID" ]; then
      log "Configured device is present: $DEVICE_BY_ID -> $(readlink -f "$DEVICE_BY_ID")"
    else
      log "Configured device is absent: $DEVICE_BY_ID"
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
    if [ "$SERVICE_RESTART_SAFE" = true ]; then
      log 'Migration failed; restoring the previously running Factory service'
      systemctl reset-failed "$SERVICE" || true
      systemctl start "$SERVICE" || true
    else
      log 'Migration failed in an uncommitted mount transition; leaving Factory stopped'
      log 'Provider data remains in the live bind mount or .factory-relocation-backup'
    fi
  fi
}
trap restore_service_on_failure EXIT

rollback_target() {
  local target=$1
  local backup=$2
  local had_source=$3

  if mountpoint -q "$target" 2>/dev/null; then
    if ! umount "$target"; then
      return 1
    fi
  fi
  rmdir "$target" 2>/dev/null || true
  if [ "$had_source" = true ]; then
    if ! mv -- "$backup" "$target"; then
      return 1
    fi
  fi
  return 0
}

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
if [ ! -r "$FSTAB_PATH" ]; then
  echo "Missing readable fstab: $FSTAB_PATH" >&2
  exit 1
fi

install -d -o root -g root -m 0755 "$(dirname "$LOCK_FILE")"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log 'Another provider-state relocation is active; refusing to overlap it'
  exit 1
fi

if ! mountpoint -q "$MOUNT_POINT"; then
  if [ ! -e "$DEVICE_BY_ID" ]; then
    echo "Secondary volume is not mounted at $MOUNT_POINT." >&2
    echo "Configured device is absent: $DEVICE_BY_ID" >&2
    exit 1
  fi
  if ! blkid "$DEVICE_BY_ID" >/dev/null 2>&1; then
    log "Formatting explicitly configured device $DEVICE_BY_ID as ext4"
    mkfs.ext4 -q "$DEVICE_BY_ID"
  fi
  filesystem_type=$(blkid -s TYPE -o value "$DEVICE_BY_ID")
  device_filesystem_uuid=$(device_uuid)
  if [ -z "$filesystem_type" ] || [ -z "$device_filesystem_uuid" ]; then
    echo "Could not identify the filesystem on $DEVICE_BY_ID" >&2
    exit 1
  fi
  mkdir -p "$MOUNT_POINT"
  fstab_source=$(awk -v target="$MOUNT_POINT" '$2 == target {print $1; exit}' "$FSTAB_PATH")
  if [ -n "$fstab_source" ]; then
    mount "$MOUNT_POINT"
  else
    mount "$DEVICE_BY_ID" "$MOUNT_POINT"
  fi
  if ! verify_dedicated_mount; then
    umount "$MOUNT_POINT" 2>/dev/null || true
    exit 1
  fi
  if [ -z "$fstab_source" ]; then
    volume_fstab_line="UUID=$device_filesystem_uuid $MOUNT_POINT $filesystem_type defaults,nofail 0 2"
    if ! append_fstab_line "$volume_fstab_line"; then
      umount "$MOUNT_POINT" 2>/dev/null || true
      echo "Could not persist provider-state volume mount in $FSTAB_PATH" >&2
      exit 1
    fi
    log "Added persistent volume mount for $MOUNT_POINT"
  fi
fi

if ! verify_dedicated_mount; then
  exit 1
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
  backup="${target}.factory-relocation-backup"
  had_source=false
  install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0700 "$destination"
  if [ -e "$target" ] || [ -L "$target" ]; then
    if [ -e "$backup" ] || [ -L "$backup" ]; then
      echo "Refusing to overwrite an existing migration backup: $backup" >&2
      exit 1
    fi
    if [ ! -d "$target" ]; then
      echo "Expected a provider directory, not a non-directory path: $target" >&2
      exit 1
    fi
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
    # Keep the verified root copy available until the bind mount and its
    # persistent fstab entry are both active. A failed transition can therefore
    # be rolled back without restarting the daemon with an empty auth path.
    SERVICE_RESTART_SAFE=false
    mv -- "$target" "$backup"
    had_source=true
  else
    SERVICE_RESTART_SAFE=false
  fi
  install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0700 "$target"
  chown -R "$FACTORY_USER:$FACTORY_USER" "$destination"

  if ! mount --bind "$destination" "$target" || ! mountpoint -q "$target"; then
    if rollback_target "$target" "$backup" "$had_source"; then
      SERVICE_RESTART_SAFE=true
    fi
    echo "Bind mount did not activate; restored original path where possible: $target" >&2
    exit 1
  fi

  fstab_line="$destination $target none bind,nofail,x-systemd.requires-mounts-for=$MOUNT_POINT 0 0"
  if ! grep -qF "$destination $target " "$FSTAB_PATH"; then
    if ! append_fstab_line "$fstab_line"; then
      if rollback_target "$target" "$backup" "$had_source"; then
        SERVICE_RESTART_SAFE=true
      fi
      echo "Could not persist bind mount; restored original path where possible: $target" >&2
      exit 1
    fi
    log "Added persistent bind mount for $target"
  fi

  # Both the live and boot-time mounts are now proven, so restarting is safe.
  SERVICE_RESTART_SAFE=true
  if [ "$had_source" = true ] && \
    ! rm -rf --one-file-system -- "${backup:?}"; then
    log "WARNING: verified migration backup remains at $backup"
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
