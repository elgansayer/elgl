#!/usr/bin/env bash
set -euo pipefail

SERVICE=hellotalk-factory.service
FACTORY=/opt/hellotalk-factory/venv/bin/hellotalk-factory
FACTORY_PYTHON=/opt/hellotalk-factory/venv/bin/python
FACTORY_USER=dev
HEARTBEAT=/var/lib/hellotalk-factory/daemon.json
CONTROL_REQUEST=/var/lib/hellotalk-factory/control_request.json
STORAGE_MAINTENANCE=/var/lib/hellotalk-factory/repository/scripts/maintain-factory-host-storage.sh
STORAGE_STAMP=/run/hellotalk-factory-storage-maintenance.stamp
MAX_TASK_MINUTES=${FACTORY_MAX_TASK_MINUTES:-120}
RESTART_GRACE_SECONDS=${FACTORY_WATCHDOG_RESTART_GRACE_SECONDS:-30}
STORAGE_INTERVAL_SECONDS=${FACTORY_STORAGE_MAINTENANCE_INTERVAL_SECONDS:-3600}
STORAGE_TIMEOUT_SECONDS=${FACTORY_STORAGE_MAINTENANCE_TIMEOUT_SECONDS:-75}

positive_integer() {
  case "$1" in
    ''|*[!0-9]*|0) return 1 ;;
    *) return 0 ;;
  esac
}

maintain_storage() {
  local last=0
  local now
  now=$(date +%s)
  if ! positive_integer "$STORAGE_INTERVAL_SECONDS" || \
    ! positive_integer "$STORAGE_TIMEOUT_SECONDS"; then
    echo 'factory watchdog: invalid storage maintenance interval/timeout' >&2
    return 0
  fi
  if [ -r "$STORAGE_STAMP" ]; then
    read -r last < "$STORAGE_STAMP" || last=0
    positive_integer "$last" || last=0
  fi
  if [ $((now - last)) -lt "$STORAGE_INTERVAL_SECONDS" ]; then
    return 0
  fi
  # The update service performs the same maintenance before rebuilding the
  # worker image. Never prune a rootless image store while that build is live.
  if systemctl is-active --quiet hellotalk-factory-update.service; then
    return 0
  fi
  if [ ! -x "$STORAGE_MAINTENANCE" ]; then
    echo "factory watchdog: storage maintenance command is missing: $STORAGE_MAINTENANCE" >&2
    return 0
  fi

  # Stamp before starting. A persistent host/daemon problem must not turn the
  # two-minute watchdog into a repeated root cleanup loop.
  printf '%s\n' "$now" > "$STORAGE_STAMP"
  if ! timeout --signal=TERM --kill-after=5s "${STORAGE_TIMEOUT_SECONDS}s" \
    "$STORAGE_MAINTENANCE" --apply --prune-containers; then
    echo 'factory watchdog: host storage maintenance failed' >&2
  fi
}

sync_dashboard() {
  timeout --signal=TERM --kill-after=5s 45s \
    runuser -u "$FACTORY_USER" --preserve-environment -- \
      "$FACTORY" dashboard sync >/dev/null || \
    echo 'factory watchdog: GitHub dashboard sync failed' >&2
}

consume_restart_request() {
  local factory_uid
  factory_uid=$(id -u "$FACTORY_USER")
  "$FACTORY_PYTHON" - "$CONTROL_REQUEST" "$factory_uid" <<'PY'
import sys
from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.control_panel import restart_request_is_safe

valid = restart_request_is_safe(
    Path(sys.argv[1]),
    expected_uid=int(sys.argv[2]),
    now=datetime.now(UTC),
)
raise SystemExit(0 if valid else 1)
PY
}

healthy() {
  systemctl is-active --quiet "$SERVICE" || return 1
  python3 - "$HEARTBEAT" "$MAX_TASK_MINUTES" <<'PY'
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

path = Path(sys.argv[1])
try:
    payload = json.loads(path.read_text())
    updated = datetime.fromisoformat(payload["updated_at"])
    if updated.tzinfo is None:
        raise ValueError("heartbeat has no timezone")
    age = (datetime.now(UTC) - updated).total_seconds()
    healthy = payload.get("status") == "running" and -120 <= age <= 120
    active_started_at = payload.get("active_started_at", {})
    if not isinstance(active_started_at, dict):
        raise ValueError("active_started_at is not a mapping")
    maximum_worker_age = (int(sys.argv[2]) + 15) * 60
    for started_at in active_started_at.values():
        if not isinstance(started_at, str):
            raise ValueError("worker start time is not a timestamp")
        started = datetime.fromisoformat(started_at)
        if started.tzinfo is None:
            raise ValueError("worker start timestamp has no timezone")
        worker_age = (datetime.now(UTC) - started).total_seconds()
        if worker_age < -120 or worker_age > maximum_worker_age:
            healthy = False
except (OSError, ValueError, KeyError, TypeError, json.JSONDecodeError):
    healthy = False
raise SystemExit(0 if healthy else 1)
PY
}

# Storage pressure previously left the process healthy but scheduling blocked.
# Run bounded maintenance independently of code updates and heartbeat recovery.
maintain_storage

# The unprivileged control panel can request only this fixed operation. The
# validator checks ownership, permissions, schema and age, consumes the file,
# and never interprets comment text as a command.
restart_requested=false
if consume_restart_request; then
  restart_requested=true
  echo 'factory watchdog: accepted bounded restart request'
  systemctl reset-failed "$SERVICE" || true
  systemctl restart "$SERVICE" || true
  sleep "$RESTART_GRACE_SECONDS"
fi

# systemd already restarts ordinary process crashes. The watchdog is a second
# recovery layer for a daemon that remains down or has stopped updating its
# heartbeat after systemd's own policy had a chance to recover it. Never let a
# remote dashboard outage delay this recovery path. A healthy daemon polls the
# panel first; an unhealthy daemon recovers before attempting publication.
if healthy; then
  if [ "$restart_requested" = false ]; then
    sync_dashboard
    if consume_restart_request; then
      restart_requested=true
      echo 'factory watchdog: accepted bounded restart request'
      systemctl reset-failed "$SERVICE" || true
      systemctl restart "$SERVICE" || true
      sleep "$RESTART_GRACE_SECONDS"
    fi
  fi
  if healthy; then
    if [ "$restart_requested" = true ]; then
      sync_dashboard
    fi
    exit 0
  fi
fi

for attempt in 1 2 3; do
  echo "factory watchdog: restart attempt ${attempt}/3"
  systemctl reset-failed "$SERVICE" || true
  systemctl restart "$SERVICE" || true
  sleep "$RESTART_GRACE_SECONDS"
  if healthy; then
    echo "factory watchdog: daemon recovered on attempt ${attempt}"
    sync_dashboard
    exit 0
  fi
done

# Telegram is deliberately invoked as the factory user so alert cooldown state
# remains owned by the service account. Preserve the EnvironmentFile values so
# the notifier can read Telegram credentials without copying or printing them.
# Provider availability does not reach this path. It is reserved for a daemon
# heartbeat failure or a live worker that exceeded its wall-clock limit and
# stayed unhealthy after restart attempts.
runuser -u "$FACTORY_USER" --preserve-environment -- "$FACTORY" alert-daemon-failed || true
sync_dashboard
exit 1
