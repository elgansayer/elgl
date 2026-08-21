#!/usr/bin/env bash
set -euo pipefail

SECONDARY_MOUNT=/mnt/HC_Volume_106574422
STATE_SOURCE=/var/lib/hellotalk-factory
LOG_SOURCE=/var/log/hellotalk-factory
STATE_TARGET=$SECONDARY_MOUNT/hellotalk-factory
LOG_TARGET=$SECONDARY_MOUNT/hellotalk-factory-logs
FSTAB=/etc/fstab

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this command with sudo.' >&2
  exit 1
fi
if ! mountpoint -q "$SECONDARY_MOUNT"; then
  echo "Secondary disk is not mounted at $SECONDARY_MOUNT." >&2
  exit 1
fi
if ! command -v rsync >/dev/null 2>&1; then
  echo 'rsync is required for a resumable migration.' >&2
  exit 1
fi

for path in "$STATE_SOURCE" "$LOG_SOURCE"; do
  if [ ! -d "$path" ]; then
    echo "Missing factory directory: $path" >&2
    exit 1
  fi
done

state_bytes=$(du -sx --bytes "$STATE_SOURCE" | awk '{print $1}')
log_bytes=$(du -sx --bytes "$LOG_SOURCE" | awk '{print $1}')
available_bytes=$(df --output=avail -B1 "$SECONDARY_MOUNT" | tail -n 1 | tr -d ' ')
required_bytes=$((state_bytes + log_bytes + 1073741824))
if [ "$available_bytes" -lt "$required_bytes" ]; then
  echo 'Not enough free space on the secondary disk for a safe copy.' >&2
  exit 1
fi

systemctl stop hellotalk-factory-health.timer hellotalk-factory.service

install -d -o dev -g dev -m 0750 "$STATE_TARGET" "$LOG_TARGET"
rsync -aHAX --numeric-ids --remove-source-files "$STATE_SOURCE/" "$STATE_TARGET/"
rsync -aHAX --numeric-ids --remove-source-files "$LOG_SOURCE/" "$LOG_TARGET/"
find "$STATE_SOURCE" -depth -type d -empty -delete
find "$LOG_SOURCE" -depth -type d -empty -delete
install -d -o dev -g dev -m 0750 "$STATE_SOURCE" "$LOG_SOURCE"

cp -a "$FSTAB" "$FSTAB.factory-backup.$(date -u +%Y%m%dT%H%M%SZ)"
if ! grep -Fqx "$STATE_TARGET $STATE_SOURCE none bind,nofail 0 0" "$FSTAB"; then
  printf '%s\n' "$STATE_TARGET $STATE_SOURCE none bind,nofail 0 0" >> "$FSTAB"
fi
if ! grep -Fqx "$LOG_TARGET $LOG_SOURCE none bind,nofail 0 0" "$FSTAB"; then
  printf '%s\n' "$LOG_TARGET $LOG_SOURCE none bind,nofail 0 0" >> "$FSTAB"
fi

mount "$STATE_SOURCE"
mount "$LOG_SOURCE"
chown dev:dev "$STATE_SOURCE" "$LOG_SOURCE"
systemctl daemon-reload

echo 'Factory state and logs migrated to the secondary disk.'
df -h "$STATE_SOURCE" "$LOG_SOURCE"
