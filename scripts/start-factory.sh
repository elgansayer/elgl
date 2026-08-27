#!/usr/bin/env bash
set -euo pipefail

FACTORY_CONFIG=/etc/hellotalk-factory/factory.env
FACTORY_SERVICE=hellotalk-factory.service
FACTORY_HEALTH_TIMER=hellotalk-factory-health.timer
FACTORY_CLI=/opt/hellotalk-factory/venv/bin/hellotalk-factory
# The daemon runs as the operator's own login user, reusing that account's
# already-authenticated CLI subscriptions instead of a separate service
# account with its own credential set.
FACTORY_USER=dev
FACTORY_HOME=/home/dev
FACTORY_SERVICE_PATH="$FACTORY_HOME/.local/bin:$FACTORY_HOME/.opencode/bin:$FACTORY_HOME/.npm-global/bin:/opt/hellotalk-factory/venv/bin:/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin"
EXPECTED_ARCHITECTURE=openhands-agent-canvas-v1

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this command as root.' >&2
  exit 1
fi

if [ ! -r "$FACTORY_CONFIG" ]; then
  echo "Missing $FACTORY_CONFIG. Run setup-debian.sh first." >&2
  exit 1
fi
if [ ! -r /etc/hellotalk-factory/runtime.env ]; then
  echo 'Missing /etc/hellotalk-factory/runtime.env. Run setup-debian.sh first.' >&2
  exit 1
fi

required_names=(
  FACTORY_ARCHITECTURE FACTORY_AGENTS_CONFIG GITHUB_TOKEN
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

configured_architecture="$(awk -F= '/^[[:space:]]*FACTORY_ARCHITECTURE=/ {print $2; exit}' "$FACTORY_CONFIG" | xargs)"
if [ "$configured_architecture" != "$EXPECTED_ARCHITECTURE" ]; then
  echo "FACTORY_ARCHITECTURE must be $EXPECTED_ARCHITECTURE (found $configured_architecture)." >&2
  echo 'Refusing to start an older/retired automation architecture against this state.' >&2
  exit 1
fi

if ! command -v systemctl >/dev/null 2>&1; then
  echo 'systemctl is unavailable. Run this on the factory host.' >&2
  exit 1
fi

set -a
# shellcheck disable=SC1090
. "$FACTORY_CONFIG"
# shellcheck disable=SC1091
. /etc/hellotalk-factory/runtime.env
set +a
export HOME="$FACTORY_HOME"
export PATH="$FACTORY_SERVICE_PATH"
cd /tmp

if [ ! -r "${FACTORY_AGENTS_CONFIG}" ]; then
  echo "Missing agent routing configuration: ${FACTORY_AGENTS_CONFIG}" >&2
  exit 1
fi

systemctl disable --now hellotalk-meta-agent.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/hellotalk-meta-agent.service

systemd-analyze verify \
  /etc/systemd/system/hellotalk-factory.service \
  /etc/systemd/system/hellotalk-factory-health.service \
  /etc/systemd/system/hellotalk-factory-health.timer \
  /etc/systemd/system/hellotalk-factory-update.service \
  /etc/systemd/system/hellotalk-factory-update.timer
systemctl daemon-reload

if [ ! -x "$FACTORY_CLI" ]; then
  echo "Missing factory executable: $FACTORY_CLI" >&2
  exit 1
fi

# Start recovery supervision before running diagnostics. Doctor includes the
# daemon heartbeat, so running it first would make a stopped daemon block the
# very start/recovery path intended to bring it back.
systemctl enable --now "$FACTORY_SERVICE" "$FACTORY_HEALTH_TIMER" \
  hellotalk-factory-update.timer
sleep 2
runuser -u "$FACTORY_USER" --preserve-environment -- "$FACTORY_CLI" doctor --online
systemctl --no-pager --full status "$FACTORY_SERVICE"
