#!/usr/bin/env bash
set -euo pipefail

SERVICE=hellotalk-factory.service
FACTORY=/opt/hellotalk-factory/venv/bin/hellotalk-factory
FACTORY_USER=hellotalk-factory
HEARTBEAT=/var/lib/hellotalk-factory/daemon.json
MAX_TASK_MINUTES=${FACTORY_MAX_TASK_MINUTES:-120}

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

# systemd already restarts ordinary process crashes. The watchdog is a second
# recovery layer for a daemon that remains down or has stopped updating its
# heartbeat after systemd's own policy had a chance to recover it.
if healthy; then
  exit 0
fi

for attempt in 1 2 3; do
  echo "factory watchdog: restart attempt ${attempt}/3"
  systemctl reset-failed "$SERVICE" || true
  systemctl restart "$SERVICE" || true
  sleep 20
  if healthy; then
    echo "factory watchdog: daemon recovered on attempt ${attempt}"
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
exit 1
