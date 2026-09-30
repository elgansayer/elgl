#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
JOURNAL_POLICY_SOURCE="$SCRIPT_DIRECTORY/../config/systemd/99-hellotalk-factory-storage.conf"
JOURNAL_POLICY_TARGET=/etc/systemd/journald.conf.d/99-hellotalk-factory-storage.conf
APPLY=false
PRUNE_DOCKER=false

usage() {
  cat <<'EOF'
Usage: maintain-factory-host-storage.sh [--apply] [--prune-docker]

Without --apply, reports root, journal, and Docker usage without changing the
host. With --apply, installs the bounded journal retention policy, rotates the
journal, and vacuums archived entries. --prune-docker additionally removes only
dangling images older than seven days and unused build cache above 2 GB.

This command never removes Docker volumes, named images, or containers.
EOF
}

for argument in "$@"; do
  case "$argument" in
    --apply) APPLY=true ;;
    --prune-docker) PRUNE_DOCKER=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $argument" >&2; usage >&2; exit 2 ;;
  esac
done

if [ "$PRUNE_DOCKER" = true ] && [ "$APPLY" != true ]; then
  echo '--prune-docker requires --apply.' >&2
  exit 2
fi

report_usage() {
  df -h /
  journalctl --disk-usage || true
  if command -v docker >/dev/null 2>&1; then
    if ! docker system df; then
      echo 'Docker usage requires access to the Docker daemon.' >&2
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
if [ ! -r "$JOURNAL_POLICY_SOURCE" ]; then
  echo "Missing journal policy: $JOURNAL_POLICY_SOURCE" >&2
  exit 1
fi

install -d -o root -g root -m 0755 /etc/systemd/journald.conf.d
install -o root -g root -m 0644 "$JOURNAL_POLICY_SOURCE" "$JOURNAL_POLICY_TARGET"
systemctl restart systemd-journald.service
journalctl --rotate
journalctl --vacuum-size=512M --vacuum-time=14day

if [ "$PRUNE_DOCKER" = true ]; then
  if ! command -v docker >/dev/null 2>&1; then
    echo 'Docker is not installed.' >&2
    exit 1
  fi
  docker image prune --force --filter until=168h
  docker builder prune --force --filter until=168h --max-used-space 2GB
fi

report_usage
