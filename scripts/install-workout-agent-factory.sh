#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPOSITORY="$(cd -- "$SCRIPT_DIRECTORY/.." && pwd)"
FACTORY_USER=${FACTORY_USER:-dev}
FACTORY_HOME=${FACTORY_HOME:-/home/dev}
TARGET_ROOT=/var/lib/workout-agent-factory
TARGET_REPOSITORY=$TARGET_ROOT/repository
TARGET_LOG=/var/log/workout-agent-factory
TARGET_CONFIG=/etc/workout-agent-factory
FACTORY_PYTHON=/opt/hellotalk-factory/venv/bin/python

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this installer with sudo.' >&2
  exit 1
fi
if [ ! -x "$FACTORY_PYTHON" ]; then
  echo 'Deploy the current OpenHands Factory before installing this repository instance.' >&2
  exit 1
fi
if ! "$FACTORY_PYTHON" -c 'import openhands_factory.repository_instance' 2>/dev/null; then
  echo 'The deployed Factory does not include the repository-instance adapter.' >&2
  echo 'Merge and deploy this change first, then rerun the installer.' >&2
  exit 1
fi
if [ ! -r /etc/hellotalk-factory/factory.env ]; then
  echo 'Missing /etc/hellotalk-factory/factory.env.' >&2
  exit 1
fi

github_token="$({
  set +u
  # shellcheck disable=SC1091
  . /etc/hellotalk-factory/factory.env
  printf '%s' "${GITHUB_TOKEN:-}"
})"
if [ -z "$github_token" ]; then
  echo 'GITHUB_TOKEN is empty in /etc/hellotalk-factory/factory.env.' >&2
  exit 1
fi

install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0750 \
  "$TARGET_ROOT" "$TARGET_ROOT/worktrees" "$TARGET_ROOT/recovery" \
  "$TARGET_ROOT/profiles" "$TARGET_LOG"
install -d -o root -g "$FACTORY_USER" -m 0750 "$TARGET_CONFIG"

factory_git() {
  runuser -u "$FACTORY_USER" -- env \
    HOME="$FACTORY_HOME" \
    GH_TOKEN="$github_token" \
    PATH=/usr/local/bin:/usr/bin:/bin \
    "$@"
}

if [ ! -d "$TARGET_REPOSITORY/.git" ]; then
  factory_git git -c credential.helper='!gh auth git-credential' clone \
    https://github.com/elgansayer/workout-agent.git "$TARGET_REPOSITORY"
else
  if [ -n "$(factory_git git -C "$TARGET_REPOSITORY" status --porcelain)" ]; then
    echo "Workout Agent checkout is dirty: $TARGET_REPOSITORY" >&2
    exit 1
  fi
  factory_git git -C "$TARGET_REPOSITORY" \
    -c credential.helper='!gh auth git-credential' fetch origin main
  factory_git git -C "$TARGET_REPOSITORY" switch main
  factory_git git -C "$TARGET_REPOSITORY" merge --ff-only origin/main
fi

if [ ! -x "$TARGET_REPOSITORY/backend/.venv/bin/python" ]; then
  runuser -u "$FACTORY_USER" -- python3 -m venv "$TARGET_REPOSITORY/backend/.venv"
fi
runuser -u "$FACTORY_USER" -- \
  "$TARGET_REPOSITORY/backend/.venv/bin/python" -m pip install \
  --disable-pip-version-check --no-input \
  --requirement "$TARGET_REPOSITORY/backend/requirements.txt" \
  pytest pytest-asyncio
runuser -u "$FACTORY_USER" -- \
  npm ci --prefix "$TARGET_REPOSITORY/frontend" --ignore-scripts

if [ ! -f "$TARGET_CONFIG/factory.env" ]; then
  install -o root -g "$FACTORY_USER" -m 0640 \
    "$SOURCE_REPOSITORY/config/systemd/workout-agent-factory.env.example" \
    "$TARGET_CONFIG/factory.env"
fi
install -o root -g root -m 0644 \
  "$SOURCE_REPOSITORY/config/systemd/workout-agent-factory.service" \
  /etc/systemd/system/workout-agent-factory.service

systemctl daemon-reload
systemctl enable --now workout-agent-factory.service
systemctl is-active workout-agent-factory.service
systemctl --no-pager --full status workout-agent-factory.service

echo 'Workout Agent Factory installed: one new issue per hour, one parallel job.'
