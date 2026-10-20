#!/usr/bin/env bash
# Move growth-prone CLI tool caches under the factory operator's home
# directory off the root filesystem and onto a second disk via bind mounts.
#
# Root cannot be resized on this host (cloud provider only allows attaching
# new volumes, not growing the boot disk), so every byte these caches grow
# is permanent pressure against minimum_free_disk_gib's root check - the
# same class of incident that paused scheduling for hours twice already
# (see automation/openhands_factory/recovery_retention.py and the daily
# self-update least-privilege fix). Moving them off root is the structural
# fix; recovery_dir pruning and uv cache prune only slow the growth.
#
# Idempotent: safe to re-run. Directories already bind-mounted from the
# target disk are left alone. Requires the second disk's block device to
# already be attached (this only formats/mounts/migrates - it does not
# attach cloud storage).
set -euo pipefail

FACTORY_USER=dev
FACTORY_HOME=/home/dev
SERVICE=hellotalk-factory.service
DEVICE_BY_ID=${RELOCATE_CACHE_DEVICE_BY_ID:-/dev/disk/by-id/scsi-0HC_Volume_106720613}
MOUNT_POINT=${RELOCATE_CACHE_MOUNT_POINT:-/mnt/HC_Volume_106720613}
CACHE_ROOT="$MOUNT_POINT/dev-home-cache"
APPLY=false

# Every one of these has been observed growing without bound from routine
# multi-provider agent usage (.gemini, .pi, .codex, .npm, .opencode) or from
# tooling that writes into $HOME regardless of which disk is under it (.cache,
# .local via uv/pip). .config is included because opencode and gh both keep
# non-trivial state there.
RELOCATABLE_DIRECTORIES=(.cache .local .gemini .pi .codex .npm .opencode .config)

usage() {
  cat <<'EOF'
Usage: relocate-home-cache-to-second-disk.sh [--apply]

Without --apply, reports whether the target device is attached, whether it's
already formatted/mounted, and which of the relocatable directories still
live on root vs. are already bind-mounted from the second disk.

With --apply (must run as root): formats the device if unformatted, mounts
it, stops the factory service, migrates any directory still on root to the
second disk with rsync, replaces it with an empty directory, adds a bind
mount to /etc/fstab, mounts the bind, restores dev:dev ownership, and
restarts the factory service. Each directory is handled independently and
skipped if already relocated, so a partial prior run is safe to resume.
EOF
}

for argument in "$@"; do
  case "$argument" in
    --apply) APPLY=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $argument" >&2; usage >&2; exit 2 ;;
  esac
done

log() { echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] relocate-cache: $*"; }

if [ ! -e "$DEVICE_BY_ID" ]; then
  echo "Device not attached: $DEVICE_BY_ID" >&2
  echo "Attach the second disk first (cloud provider console), then re-run." >&2
  exit 1
fi

report_status() {
  log "Device present: $DEVICE_BY_ID -> $(readlink -f "$DEVICE_BY_ID")"
  if mountpoint -q "$MOUNT_POINT" 2>/dev/null; then
    log "Mounted at $MOUNT_POINT"
    df -h "$MOUNT_POINT"
  else
    log "Not yet mounted at $MOUNT_POINT"
  fi
  for directory in "${RELOCATABLE_DIRECTORIES[@]}"; do
    target="$FACTORY_HOME/$directory"
    if mountpoint -q "$target" 2>/dev/null; then
      log "$target: already relocated (bind mount active)"
    elif [ -e "$target" ]; then
      size=$(du -sh "$target" 2>/dev/null | cut -f1 || echo '?')
      log "$target: still on root ($size)"
    else
      log "$target: does not exist yet"
    fi
  done
}

if [ "$APPLY" != true ]; then
  report_status
  exit 0
fi

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run --apply with sudo.' >&2
  exit 1
fi

if ! blkid "$DEVICE_BY_ID" >/dev/null 2>&1; then
  log "Formatting $DEVICE_BY_ID as ext4 (currently unformatted)"
  mkfs.ext4 -q "$DEVICE_BY_ID"
fi

mkdir -p "$MOUNT_POINT"
if ! mountpoint -q "$MOUNT_POINT"; then
  log "Mounting $MOUNT_POINT"
  mount "$MOUNT_POINT"
fi
mkdir -p "$CACHE_ROOT"

pending=()
for directory in "${RELOCATABLE_DIRECTORIES[@]}"; do
  target="$FACTORY_HOME/$directory"
  if mountpoint -q "$target" 2>/dev/null; then
    continue
  fi
  pending+=("$directory")
done

if [ "${#pending[@]}" -eq 0 ]; then
  log "Nothing to relocate - every directory is already bind-mounted"
  exit 0
fi

log "Stopping factory service for a consistent migration"
systemctl stop "$SERVICE" || true

for directory in "${pending[@]}"; do
  target="$FACTORY_HOME/$directory"
  destination="$CACHE_ROOT/$directory"
  mkdir -p "$destination"
  if [ -e "$target" ]; then
    log "Migrating $target -> $destination"
    rsync -a --delete "$target/" "$destination/"
    rm -rf "$target"
  fi
  mkdir -p "$target"
  chown "$FACTORY_USER:$FACTORY_USER" "$destination" "$target"

  fstab_line="$destination $target none bind,nofail 0 0"
  if ! grep -qF "$destination $target " /etc/fstab; then
    echo "$fstab_line" >> /etc/fstab
    log "Added fstab entry: $fstab_line"
  fi
  mount "$target"
done

log "Restoring dev:dev ownership under relocated directories"
for directory in "${pending[@]}"; do
  chown -R "$FACTORY_USER:$FACTORY_USER" "$FACTORY_HOME/$directory"
done

log "Starting factory service"
systemctl reset-failed "$SERVICE" || true
systemctl start "$SERVICE"

report_status
