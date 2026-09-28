#!/usr/bin/env bash
set -euo pipefail

INSTANCE=${1:?Repository Factory instance name is required}
SERVICE="repo-factory@${INSTANCE}.service"
FACTORY=/opt/hellotalk-factory/venv/bin/repo-factory
FACTORY_PYTHON=/opt/hellotalk-factory/venv/bin/python
FACTORY_USER=dev
HEARTBEAT="${FACTORY_STATE_DIR}/daemon.json"
CONTROL_REQUEST="${FACTORY_STATE_DIR}/control_request.json"
MAX_TASK_MINUTES=${FACTORY_MAX_TASK_MINUTES:-120}
RESTART_GRACE_SECONDS=${FACTORY_WATCHDOG_RESTART_GRACE_SECONDS:-30}

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
    maximum_worker_age = (int(sys.argv[2]) + 15) * 60
    active_started_at = payload.get("active_started_at", {})
    if not isinstance(active_started_at, dict):
        raise ValueError("active_started_at is not a mapping")
    for value in active_started_at.values():
        if not isinstance(value, str):
            raise ValueError("worker start time is not a timestamp")
        started = datetime.fromisoformat(value)
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

sync_dashboard() {
  timeout --signal=TERM --kill-after=5s 45s \
    runuser -u "$FACTORY_USER" --preserve-environment -- \
      "$FACTORY" dashboard sync >/dev/null || \
    echo "repo-factory watchdog: dashboard sync failed for ${INSTANCE}" >&2
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

restart_requested=false
if consume_restart_request; then
  restart_requested=true
  echo "repo-factory watchdog: accepted bounded restart request for ${INSTANCE}"
  systemctl reset-failed "$SERVICE" || true
  systemctl restart "$SERVICE" || true
  sleep "$RESTART_GRACE_SECONDS"
fi

if healthy; then
  if [ "$restart_requested" = false ]; then
    sync_dashboard
    if consume_restart_request; then
      restart_requested=true
      echo "repo-factory watchdog: accepted bounded restart request for ${INSTANCE}"
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
  echo "repo-factory watchdog: restarting ${INSTANCE}, attempt ${attempt}/3"
  systemctl reset-failed "$SERVICE" || true
  systemctl restart "$SERVICE" || true
  sleep "$RESTART_GRACE_SECONDS"
  if healthy; then
    sync_dashboard
    exit 0
  fi
done

runuser -u "$FACTORY_USER" --preserve-environment -- "$FACTORY" alert-daemon-failed || true
sync_dashboard
exit 1
