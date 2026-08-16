#!/usr/bin/env bash
set -euo pipefail

SERVICE=hellotalk-factory.service
FACTORY=/opt/hellotalk-factory/venv/bin/hellotalk-factory
FACTORY_USER=hellotalk-factory

healthy() {
  systemctl is-active --quiet "$SERVICE"
}

# systemd already restarts ordinary process crashes. The watchdog is a second
# recovery layer for a daemon that remains down after systemd's own policy.
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
# remains owned by the service account. No job/stall/provider condition reaches
# this path; this is only for a daemon that stayed down after restart attempts.
runuser -u "$FACTORY_USER" -- "$FACTORY" alert-daemon-failed || true
exit 1
