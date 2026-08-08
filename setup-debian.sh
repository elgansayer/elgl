#!/usr/bin/env bash
# Idempotent HelloTalk OpenHands factory bootstrap for Debian 13 and Ubuntu LTS.
set -euo pipefail

REPOSITORY_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FACTORY_REPOSITORY_URL="${FACTORY_REPOSITORY_URL:-https://github.com/elgansayer/elgl.git}"
FACTORY_ROOT=/opt/hellotalk-factory
FACTORY_STATE=/var/lib/hellotalk-factory
FACTORY_LOG=/var/log/hellotalk-factory
FACTORY_CONFIG=/etc/hellotalk-factory
FACTORY_USER=hellotalk-factory

if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this bootstrap as root. It never stores or requests a sudo password.' >&2
  exit 1
fi

# shellcheck disable=SC1091
. /etc/os-release
case "${ID}:${VERSION_ID}" in
  debian:13|ubuntu:24.04|ubuntu:26.04) ;;
  *) echo "Unsupported distribution: ${PRETTY_NAME}" >&2; exit 1 ;;
esac

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y
DEBIAN_FRONTEND=noninteractive apt-get install -y \
  build-essential ca-certificates curl git gh gnupg jq logrotate podman \
  python3 python3-pip python3-venv rsync shellcheck tmux uidmap

install -d -m 0755 /etc/apt/keyrings
curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key |
  gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' |
  tee /etc/apt/sources.list.d/nodesource.list >/dev/null
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if [ "$node_major" -lt 22 ]; then
  echo "Node.js 22 or newer is required, found $(node --version)" >&2
  exit 1
fi

if ! id "$FACTORY_USER" >/dev/null 2>&1; then
  useradd --system --create-home --home-dir "$FACTORY_STATE/home" --shell /usr/sbin/nologin "$FACTORY_USER"
fi
if ! grep -q "^${FACTORY_USER}:" /etc/subuid; then
  usermod --add-subuids 200000-265535 --add-subgids 200000-265535 "$FACTORY_USER"
fi

install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0700 \
  "$FACTORY_STATE" "$FACTORY_STATE/home" "$FACTORY_STATE/profiles" \
  "$FACTORY_STATE/worktrees" "$FACTORY_STATE/conversations" "$FACTORY_LOG"
install -d -o root -g "$FACTORY_USER" -m 0750 "$FACTORY_ROOT" "$FACTORY_CONFIG"

if [ ! -d "$FACTORY_STATE/repository/.git" ]; then
  install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0700 "$FACTORY_STATE/repository"
  sudo -u "$FACTORY_USER" git clone "$FACTORY_REPOSITORY_URL" "$FACTORY_STATE/repository"
fi
sudo -u "$FACTORY_USER" git -C "$FACTORY_STATE/repository" remote set-url origin "$FACTORY_REPOSITORY_URL"
sudo -u "$FACTORY_USER" git -C "$FACTORY_STATE/repository" config credential.helper '!gh auth git-credential'

python3 -m venv "$FACTORY_ROOT/venv-0.1.0"
"$FACTORY_ROOT/venv-0.1.0/bin/python" -m pip install --upgrade 'pip==25.2'
"$FACTORY_ROOT/venv-0.1.0/bin/python" -m pip install 'uv==0.8.12'
VIRTUAL_ENV="$FACTORY_ROOT/venv-0.1.0" "$FACTORY_ROOT/venv-0.1.0/bin/uv" sync \
  --active --frozen --extra development --project "$REPOSITORY_SOURCE/automation"
ln -sfn "$FACTORY_ROOT/venv-0.1.0" "$FACTORY_ROOT/venv"

for directory in "$FACTORY_STATE/repository" "$FACTORY_STATE/repository/frontend" "$FACTORY_STATE/repository/backend" "$FACTORY_STATE/repository/e2e"; do
  if [ -f "$directory/package-lock.json" ]; then
    sudo -u "$FACTORY_USER" npm ci --prefix "$directory" --ignore-scripts --legacy-peer-deps
  fi
done
sudo -u "$FACTORY_USER" env HOME="$FACTORY_STATE/home" podman build \
  --tag localhost/hellotalk-factory-worker:current \
  --file "$REPOSITORY_SOURCE/automation/Containerfile" "$REPOSITORY_SOURCE/automation"

if [ ! -f "$FACTORY_CONFIG/factory.env" ]; then
  install -o root -g "$FACTORY_USER" -m 0640 "$REPOSITORY_SOURCE/config/systemd/factory.env.example" "$FACTORY_CONFIG/factory.env"
fi

install -o root -g root -m 0644 "$REPOSITORY_SOURCE/config/systemd/hellotalk-factory.service" /etc/systemd/system/
install -o root -g root -m 0644 "$REPOSITORY_SOURCE/config/systemd/hellotalk-factory-health.service" /etc/systemd/system/
install -o root -g root -m 0644 "$REPOSITORY_SOURCE/config/systemd/hellotalk-factory-health.timer" /etc/systemd/system/
install -o root -g root -m 0644 "$REPOSITORY_SOURCE/config/logrotate/hellotalk-factory" /etc/logrotate.d/
systemctl daemon-reload

echo "OpenHands SDK: $("$FACTORY_ROOT/venv/bin/python" -c 'import openhands.sdk; print(openhands.sdk.__version__)')"
"$FACTORY_ROOT/venv/bin/python" -c 'from openhands.sdk import Agent, Conversation, LLM, LLMProfileStore, Tool; from openhands.sdk.llm import FallbackStrategy; from openhands.tools.terminal import TerminalTool; from openhands.tools.file_editor import FileEditorTool; print("OpenHands imports verified")'
echo 'Bootstrap complete. Edit /etc/hellotalk-factory/factory.env, authenticate, then run doctor.'
