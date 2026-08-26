#!/usr/bin/env bash
# Install the factory daily self-update timer on the live host.
# Run as root: sudo bash install-factory-update-timer.sh
set -euo pipefail

REPO=/home/dev/hellotalk

if [ "$(id -u)" -ne 0 ]; then
  echo "Run as root: sudo bash $0" >&2
  exit 1
fi

echo "Installing hellotalk-factory-update files..."

install -o root -g root -m 0755 \
  "$REPO/config/systemd/hellotalk-factory-update.sh" \
  /opt/hellotalk-factory/hellotalk-factory-update.sh

install -o root -g root -m 0644 \
  "$REPO/config/systemd/hellotalk-factory-update.service" \
  /etc/systemd/system/hellotalk-factory-update.service

install -o root -g root -m 0644 \
  "$REPO/config/systemd/hellotalk-factory-update.timer" \
  /etc/systemd/system/hellotalk-factory-update.timer

systemctl daemon-reload
systemctl reset-failed hellotalk-factory-update.service 2>/dev/null || true
systemctl enable --now hellotalk-factory-update.timer

echo ""
systemctl list-timers hellotalk-factory-update.timer
echo ""
echo "Done. Timer will fire daily at 03:00 UTC."
echo "To trigger a test run now: systemctl start hellotalk-factory-update.service"
