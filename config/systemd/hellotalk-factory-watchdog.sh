#!/usr/bin/env bash
set -euo pipefail

SERVICE=hellotalk-factory.service
FACTORY=/opt/hellotalk-factory/venv/bin/hellotalk-factory
FACTORY_USER=hellotalk-factory
HEARTBEAT=/var/lib/hellotalk-factory/daemon.json

healthy() {
  systemctl is-active --quiet "$SERVICE" || return 1
  python3 - "$HEARTBEAT" <<'PY'
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
# No job/stall/provider condition reaches this path; this is only for a daemon
# that stayed unhealthy after restart attempts.
runuser -u "$FACTORY_USER" --preserve-environment -- "$FACTORY" alert-daemon-failed || true
exit 1
