#!/usr/bin/env bash
set -euo pipefail

FACTORY_CONFIG=/etc/hellotalk-factory/factory.env
FACTORY_SERVICE=hellotalk-factory.service
FACTORY_HEALTH_TIMER=hellotalk-factory-health.timer
FACTORY_CLI=/opt/hellotalk-factory/venv/bin/hellotalk-factory

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this command as root.' >&2
  exit 1
fi

if [ ! -r "$FACTORY_CONFIG" ]; then
  echo "Missing $FACTORY_CONFIG. Run setup-debian.sh first." >&2
  exit 1
fi

required_names=(
  OPENCODE_GO_API_KEY OPENCODE_GO_MODEL GITHUB_TOKEN
)

for name in "${required_names[@]}"; do
  if ! awk -v key="$name" '
    $0 ~ "^[[:space:]]*" key "=" {
      value = $0
      sub("^[[:space:]]*" key "=", "", value)
      if (value !~ /^[[:space:]]*$/) found = 1
    }
    END { exit(found ? 0 : 1) }
  ' "$FACTORY_CONFIG"; then
    echo "Missing or empty factory setting: $name" >&2
    exit 1
  fi
done

if awk '
  /^[[:space:]]*GEMINI_ENABLED=/ {
    enabled = $0
    sub(/^[^=]*=/, "", enabled)
  }
  END { exit(enabled == "true" ? 0 : 1) }
' "$FACTORY_CONFIG"; then
  if ! awk '/^[[:space:]]*GEMINI_API_KEY=/ { value=$0; sub(/^[^=]*=/, "", value); if (value !~ /^[[:space:]]*$/) found=1 } END { exit(found ? 0 : 1) }' "$FACTORY_CONFIG"; then
    echo 'GEMINI_ENABLED=true requires a non-empty GEMINI_API_KEY.' >&2
    exit 1
  fi
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo 'systemctl is unavailable. Run this on the factory host.' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$FACTORY_CONFIG"
set +a
export HOME=/var/lib/hellotalk-factory/home
cd /tmp

systemd-analyze verify \
  /etc/systemd/system/hellotalk-factory.service \
  /etc/systemd/system/hellotalk-factory-health.service \
  /etc/systemd/system/hellotalk-factory-health.timer
systemctl daemon-reload

if [ ! -x "$FACTORY_CLI" ]; then
  echo "Missing factory executable: $FACTORY_CLI" >&2
  exit 1
fi

runuser -u hellotalk-factory --preserve-environment -- "$FACTORY_CLI" doctor --online
systemctl enable --now "$FACTORY_SERVICE" "$FACTORY_HEALTH_TIMER"
systemctl --no-pager --full status "$FACTORY_SERVICE"
