#!/usr/bin/env bash
set -euo pipefail

INSTANCE=
ACTIVATE=false
MIGRATE_HELLOTALK=false
FACTORY_USER=dev
SECONDARY_MOUNT=/mnt/HC_Volume_106574422
DATA_TARGET="$SECONDARY_MOUNT/repo-factory"
STATE_ROOT=/var/lib/repo-factory
LOG_TARGET="$SECONDARY_MOUNT/repo-factory-logs"
LOG_ROOT=/var/log/repo-factory
CONTROL_REPOSITORY=/var/lib/hellotalk-factory/repository
LEGACY_ENV=/etc/hellotalk-factory/factory.env
CONFIG_ROOT=/etc/repo-factory

usage() {
  cat <<'EOF'
Usage: install-repo-factory-instance.sh --instance NAME [--activate] [--migrate-hellotalk]

Installs or refreshes one repository-scoped Repo Factory instance. Supported
instances are hellotalk and workout-agent. Installation is idempotent and keeps
the legacy HelloTalk units available for rollback.
EOF
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --instance)
      INSTANCE=${2:-}
      shift 2
      ;;
    --activate)
      ACTIVATE=true
      shift
      ;;
    --migrate-hellotalk)
      MIGRATE_HELLOTALK=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      usage >&2
      exit 2
      ;;
  esac
done

if [ "$INSTANCE" != hellotalk ] && [ "$INSTANCE" != workout-agent ]; then
  echo 'Instance must be hellotalk or workout-agent.' >&2
  exit 2
fi
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this installer as root.' >&2
  exit 1
fi
if ! mountpoint -q "$SECONDARY_MOUNT"; then
  echo "Secondary disk is not mounted at $SECONDARY_MOUNT." >&2
  exit 1
fi
if [ ! -d "$CONTROL_REPOSITORY/.git" ]; then
  echo "Control repository is missing: $CONTROL_REPOSITORY" >&2
  exit 1
fi
if [ ! -r "$LEGACY_ENV" ]; then
  echo "Credential source is missing: $LEGACY_ENV" >&2
  exit 1
fi

install -d -m 0750 -o "$FACTORY_USER" -g "$FACTORY_USER" "$DATA_TARGET" "$LOG_TARGET"
if [ ! -e "$STATE_ROOT" ]; then
  ln -s "$DATA_TARGET" "$STATE_ROOT"
fi
if [ ! -e "$LOG_ROOT" ]; then
  ln -s "$LOG_TARGET" "$LOG_ROOT"
fi
if [ "$(readlink -f "$STATE_ROOT")" != "$(readlink -f "$DATA_TARGET")" ]; then
  echo "$STATE_ROOT does not resolve to the secondary disk target." >&2
  exit 1
fi
if [ "$(readlink -f "$LOG_ROOT")" != "$(readlink -f "$LOG_TARGET")" ]; then
  echo "$LOG_ROOT does not resolve to the secondary disk target." >&2
  exit 1
fi

install -d -m 0750 -o root -g "$FACTORY_USER" "$CONFIG_ROOT" "$CONFIG_ROOT/instances"
if [ ! -f "$CONFIG_ROOT/common.env" ]; then
  temporary=$(mktemp "$CONFIG_ROOT/.common.env.XXXXXX")
  awk -F= '
    /^(GITHUB_TOKEN|TELEGRAM_BOT_TOKEN|TELEGRAM_CHAT_ID|OPENCODE_GO_API_KEY|OPENCODE_GO_MODEL)=/ {
      print
    }
  ' "$LEGACY_ENV" > "$temporary"
  if ! grep -q '^GITHUB_TOKEN=' "$temporary"; then
    rm -f "$temporary"
    echo 'GITHUB_TOKEN was not found in the legacy environment.' >&2
    exit 1
  fi
  chown root:"$FACTORY_USER" "$temporary"
  chmod 0640 "$temporary"
  mv "$temporary" "$CONFIG_ROOT/common.env"
fi
install -m 0640 -o root -g "$FACTORY_USER" \
  "$CONTROL_REPOSITORY/config/factory/agents.production.json" "$CONFIG_ROOT/agents.json"
install -m 0640 -o root -g "$FACTORY_USER" \
  "$CONTROL_REPOSITORY/config/factory/instances/${INSTANCE}.env" \
  "$CONFIG_ROOT/instances/${INSTANCE}.env"

chown -R "$FACTORY_USER:$FACTORY_USER" /opt/hellotalk-factory/venv
runuser -u "$FACTORY_USER" -- env \
  HOME=/home/dev VIRTUAL_ENV=/opt/hellotalk-factory/venv \
  /opt/hellotalk-factory/venv/bin/uv sync \
    --active --frozen --inexact --no-editable --extra development \
    --project "$CONTROL_REPOSITORY/automation"

install -d -m 0750 -o "$FACTORY_USER" -g "$FACTORY_USER" \
  /opt/hellotalk-factory/build-context
rsync -a --delete \
  --exclude=.mypy_cache --exclude=.pytest_cache --exclude=.venv \
  --exclude=__pycache__ \
  "$CONTROL_REPOSITORY/automation/" /opt/hellotalk-factory/build-context/
chown -R "$FACTORY_USER:$FACTORY_USER" /opt/hellotalk-factory/build-context
# The quoted script is evaluated by the inner bash process, where $1 is set.
# shellcheck disable=SC2016
runuser -u "$FACTORY_USER" -- env HOME=/home/dev \
  bash -c 'cd "$1" && exec podman build --cgroup-manager=cgroupfs \
    --tag localhost/hellotalk-factory-worker:current \
    --tag localhost/repo-factory-worker:current \
    --file "$1/Containerfile" "$1"' _ \
  /opt/hellotalk-factory/build-context

install -d -m 0750 -o "$FACTORY_USER" -g "$FACTORY_USER" \
  "$STATE_ROOT/shared" "$STATE_ROOT/$INSTANCE" "$LOG_ROOT/$INSTANCE"
if [ ! -e "$STATE_ROOT/control" ]; then
  ln -s "$CONTROL_REPOSITORY" "$STATE_ROOT/control"
fi
if [ "$(readlink -f "$STATE_ROOT/control")" != "$(readlink -f "$CONTROL_REPOSITORY")" ]; then
  echo "$STATE_ROOT/control does not resolve to the control repository." >&2
  exit 1
fi

if [ "$INSTANCE" = hellotalk ]; then
  if [ ! -e "$STATE_ROOT/hellotalk/repository" ]; then
    ln -s "$CONTROL_REPOSITORY" "$STATE_ROOT/hellotalk/repository"
  fi
  if [ "$(readlink -f "$STATE_ROOT/hellotalk/repository")" != "$(readlink -f "$CONTROL_REPOSITORY")" ]; then
    echo "$STATE_ROOT/hellotalk/repository does not resolve to the control repository." >&2
    exit 1
  fi
else
  repository="$STATE_ROOT/workout-agent/repository"
  if [ ! -d "$repository/.git" ]; then
    runuser -u "$FACTORY_USER" -- git clone \
      --reference-if-able "$SECONDARY_MOUNT/workout-agent" \
      git@github.com:elgansayer/workout-agent.git "$repository"
  fi
  runuser -u "$FACTORY_USER" -- git -C "$repository" fetch origin main
  runuser -u "$FACTORY_USER" -- git -C "$repository" switch main
  runuser -u "$FACTORY_USER" -- git -C "$repository" merge --ff-only origin/main
  if [ ! -x "$repository/.venv/bin/python" ]; then
    runuser -u "$FACTORY_USER" -- python3 -m venv "$repository/.venv"
  fi
  runuser -u "$FACTORY_USER" -- "$repository/.venv/bin/pip" install \
    --requirement "$repository/backend/requirements.txt"
  runuser -u "$FACTORY_USER" -- npm ci --legacy-peer-deps --prefix "$repository/frontend"
fi

install -m 0644 "$CONTROL_REPOSITORY/config/systemd/repo-factory.slice" \
  /etc/systemd/system/repo-factory.slice
install -m 0644 "$CONTROL_REPOSITORY/config/systemd/repo-factory@.service" \
  /etc/systemd/system/repo-factory@.service
install -m 0644 "$CONTROL_REPOSITORY/config/systemd/repo-factory-health@.service" \
  /etc/systemd/system/repo-factory-health@.service
install -m 0644 "$CONTROL_REPOSITORY/config/systemd/repo-factory-health@.timer" \
  /etc/systemd/system/repo-factory-health@.timer
install -m 0644 "$CONTROL_REPOSITORY/config/systemd/repo-factory-update.service" \
  /etc/systemd/system/repo-factory-update.service
install -m 0644 "$CONTROL_REPOSITORY/config/systemd/repo-factory-update.timer" \
  /etc/systemd/system/repo-factory-update.timer
install -d -m 0755 /opt/repo-factory
install -m 0755 "$CONTROL_REPOSITORY/config/systemd/repo-factory-watchdog.sh" \
  /opt/repo-factory/repo-factory-watchdog.sh
install -m 0755 "$CONTROL_REPOSITORY/config/systemd/hellotalk-factory-update.sh" \
  /opt/repo-factory/repo-factory-update.sh

drop_in="/etc/systemd/system/repo-factory@${INSTANCE}.service.d"
install -d -m 0755 "$drop_in"
if [ "$INSTANCE" = workout-agent ]; then
  install -m 0644 /dev/stdin "$drop_in/resources.conf" <<'EOF'
[Service]
MemoryHigh=2G
MemoryMax=3G
CPUWeight=50
EOF
else
  install -m 0644 /dev/stdin "$drop_in/resources.conf" <<'EOF'
[Service]
MemoryHigh=5G
MemoryMax=6G
CPUWeight=100
EOF
fi

systemctl daemon-reload
if [ "$INSTANCE" = workout-agent ]; then
  install -d -m 0755 /etc/systemd/system/hellotalk-factory-update.service.d
  install -m 0644 /dev/stdin \
    /etc/systemd/system/hellotalk-factory-update.service.d/repo-factory.conf <<'EOF'
[Service]
Environment=REPO_FACTORY_SECONDARY_HEARTBEAT=/var/lib/repo-factory/workout-agent/state/daemon.json
Environment=REPO_FACTORY_SECONDARY_SERVICE=repo-factory@workout-agent.service
EOF
  systemctl daemon-reload
fi
if [ "$INSTANCE" = hellotalk ] && [ "$MIGRATE_HELLOTALK" = true ]; then
  systemctl stop hellotalk-factory-health.timer hellotalk-factory-update.timer \
    hellotalk-factory.service
  systemctl disable hellotalk-factory-health.timer hellotalk-factory-update.timer \
    hellotalk-factory.service
  systemctl enable --now repo-factory-update.timer
fi
if [ "$ACTIVATE" = true ]; then
  systemctl enable --now "repo-factory@${INSTANCE}.service"
  systemctl enable --now "repo-factory-health@${INSTANCE}.timer"
fi

echo "Repo Factory instance installed: $INSTANCE"
echo "State root: $STATE_ROOT/$INSTANCE"
echo "Activation requested: $ACTIVATE"
