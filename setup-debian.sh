#!/usr/bin/env bash
# Idempotent HelloTalk OpenHands factory bootstrap for Debian 13 and Ubuntu LTS.
set -euo pipefail

REPOSITORY_SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FACTORY_REPOSITORY_URL="${FACTORY_REPOSITORY_URL:-https://github.com/elgansayer/elgl.git}"
FACTORY_ROOT=/opt/hellotalk-factory
FACTORY_STATE=/var/lib/hellotalk-factory
FACTORY_LOG=/var/log/hellotalk-factory
FACTORY_CONFIG=/etc/hellotalk-factory
# The daemon runs as the operator's own login user, reusing that account's
# already-authenticated CLI subscriptions instead of a separate service
# account with its own credential set.
FACTORY_USER=dev
FACTORY_HOME=/home/dev
# Optional secondary data volume. When mounted, worker image storage is
# relocated there to keep the root disk from filling with permanent image
# layers; see the Podman storage relocation block below.
FACTORY_SECONDARY_VOLUME=/mnt/HC_Volume_106574422

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
  build-essential ca-certificates curl git gh gnupg jq logrotate passt podman sudo \
  iproute2 python-is-python3 python3 python3-pip python3-venv rsync shellcheck tmux \
  uidmap util-linux

if apt-cache show libgtk-3-0t64 >/dev/null 2>&1; then
  gtk_package=libgtk-3-0t64
else
  gtk_package=libgtk-3-0
fi
DEBIAN_FRONTEND=noninteractive apt-get install -y "$gtk_package"

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
  echo "Missing operator user: $FACTORY_USER. Create it before running this bootstrap." >&2
  exit 1
fi
if ! grep -q "^${FACTORY_USER}:" /etc/subuid; then
  usermod --add-subuids 200000-265535 --add-subgids 200000-265535 "$FACTORY_USER"
fi
factory_uid="$(id -u "$FACTORY_USER")"
loginctl enable-linger "$FACTORY_USER"
systemctl start "user@${factory_uid}.service"

install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0700 \
  "$FACTORY_STATE" "$FACTORY_STATE/profiles" \
  "$FACTORY_STATE/worktrees" "$FACTORY_STATE/recovery" \
  "$FACTORY_STATE/conversations" "$FACTORY_LOG"

# Worker image builds accumulate rootless Podman graph-storage layers
# permanently (unlike the transient build-context checkout). Relocating that
# storage off the root disk and onto the secondary volume, when one is
# present, keeps repeated builds from tightening root disk headroom over
# time. Podman is left on its default root-disk location when no secondary
# volume is mounted.
if [ -d "$FACTORY_SECONDARY_VOLUME" ] && mountpoint -q "$FACTORY_SECONDARY_VOLUME"; then
  podman_storage="$FACTORY_SECONDARY_VOLUME/podman-storage"
  install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0755 "$podman_storage"
  install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0755 "$FACTORY_HOME/.config/containers"
  podman_storage_conf="$FACTORY_HOME/.config/containers/storage.conf"
  if [ ! -f "$podman_storage_conf" ]; then
    cat > "$podman_storage_conf" <<EOF
[storage]
driver = "overlay"
graphroot = "$podman_storage"

[storage.options]
EOF
    chown "$FACTORY_USER:$FACTORY_USER" "$podman_storage_conf"
  fi
fi
install -d -o root -g "$FACTORY_USER" -m 0750 "$FACTORY_ROOT" "$FACTORY_CONFIG"

factory_environment_created=false
if [ ! -f "$FACTORY_CONFIG/factory.env" ]; then
  install -o root -g root -m 0600 \
    "$REPOSITORY_SOURCE/config/systemd/factory.env.example" \
    "$FACTORY_CONFIG/factory.env"
  factory_environment_created=true
fi
if [ "$factory_environment_created" = true ] && [ -r "$REPOSITORY_SOURCE/.env" ]; then
  "$REPOSITORY_SOURCE/scripts/install-factory-env.sh" "$REPOSITORY_SOURCE/.env"
fi
factory_github_token="$({
  set +u
  # shellcheck disable=SC1090,SC1091
  . "$FACTORY_CONFIG/factory.env"
  printf '%s' "${GITHUB_TOKEN:-}"
})"
if [ -z "$factory_github_token" ]; then
  echo "Set GITHUB_TOKEN in $FACTORY_CONFIG/factory.env before repository bootstrap." >&2
  exit 1
fi

factory_git() {
  runuser -u "$FACTORY_USER" -- env \
    HOME="$FACTORY_HOME" \
    PATH="/usr/local/bin:/usr/bin:/bin" \
    GH_TOKEN="$factory_github_token" \
    "$@"
}

if [ ! -d "$FACTORY_STATE/repository/.git" ]; then
  install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0700 "$FACTORY_STATE/repository"
  factory_git git -c credential.helper='!gh auth git-credential' \
    clone "$FACTORY_REPOSITORY_URL" "$FACTORY_STATE/repository"
fi
factory_git git -C "$FACTORY_STATE/repository" remote set-url origin "$FACTORY_REPOSITORY_URL"
factory_git git -C "$FACTORY_STATE/repository" config --unset-all credential.helper || true
factory_git git -C "$FACTORY_STATE/repository" config --add credential.helper ''
factory_git git -C "$FACTORY_STATE/repository" config --add credential.helper \
  '!gh auth git-credential'
factory_git git -C "$FACTORY_STATE/repository" config user.name 'HelloTalk Factory'
factory_git git -C "$FACTORY_STATE/repository" config user.email \
  'hellotalk-factory@users.noreply.github.com'
factory_git git -C "$FACTORY_STATE/repository" fetch origin main
factory_git git -C "$FACTORY_STATE/repository" switch main
factory_git git -C "$FACTORY_STATE/repository" merge --ff-only origin/main

python3 -m venv "$FACTORY_ROOT/venv-0.1.0"
"$FACTORY_ROOT/venv-0.1.0/bin/python" -m pip install --upgrade 'pip==25.2'
"$FACTORY_ROOT/venv-0.1.0/bin/python" -m pip install 'uv==0.12.5'
VIRTUAL_ENV="$FACTORY_ROOT/venv-0.1.0" "$FACTORY_ROOT/venv-0.1.0/bin/uv" sync \
  --active --frozen --inexact --no-editable --extra development \
  --project "$REPOSITORY_SOURCE/automation"
ln -sfn "$FACTORY_ROOT/venv-0.1.0" "$FACTORY_ROOT/venv"

for directory in "$FACTORY_STATE/repository" "$FACTORY_STATE/repository/frontend" "$FACTORY_STATE/repository/backend" "$FACTORY_STATE/repository/e2e" "$FACTORY_STATE/repository/admin-portal"; do
  if [ -f "$directory/package-lock.json" ]; then
    sudo -u "$FACTORY_USER" npm ci --prefix "$directory" --ignore-scripts --legacy-peer-deps
  fi
done
sudo -u "$FACTORY_USER" env HOME="$FACTORY_HOME" bash -c \
  'cd "$1" && npm exec -- cypress install' _ "$FACTORY_STATE/repository/frontend"
install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0750 "$FACTORY_ROOT/build-context"
rsync -a --delete \
  --exclude=.mypy_cache --exclude=.pytest_cache --exclude=.venv --exclude=__pycache__ \
  "$REPOSITORY_SOURCE/automation/" "$FACTORY_ROOT/build-context/"
chown -R "$FACTORY_USER:$FACTORY_USER" "$FACTORY_ROOT/build-context"
# Rootless Podman may inspect the inherited working directory. Enter the
# service-owned build context before starting it because the source checkout
# can be inaccessible to the service user.
# $1 is intentionally expanded by the child shell.
# shellcheck disable=SC2016
sudo -u "$FACTORY_USER" env HOME="$FACTORY_HOME" bash -c \
  'cd "$1" && exec podman build \
    --cgroup-manager=cgroupfs \
    --tag localhost/hellotalk-factory-worker:current \
    --file "$1/Containerfile" "$1"' _ "$FACTORY_ROOT/build-context"

printf 'XDG_RUNTIME_DIR=/run/user/%s\n' "$factory_uid" > "$FACTORY_CONFIG/runtime.env"
chown root:"$FACTORY_USER" "$FACTORY_CONFIG/runtime.env"
chmod 0640 "$FACTORY_CONFIG/runtime.env"
install -o root -g "$FACTORY_USER" -m 0640 \
  "$REPOSITORY_SOURCE/config/factory/agents.production.json" \
  "$FACTORY_CONFIG/agents.example.json"
if [ ! -f "$FACTORY_CONFIG/agents.json" ]; then
  install -o root -g "$FACTORY_USER" -m 0640 \
    "$REPOSITORY_SOURCE/config/factory/agents.production.json" \
    "$FACTORY_CONFIG/agents.json"
fi

install -o root -g root -m 0644 "$REPOSITORY_SOURCE/config/systemd/hellotalk-factory.service" /etc/systemd/system/
install -o root -g root -m 0644 "$REPOSITORY_SOURCE/config/systemd/hellotalk-factory-health.service" /etc/systemd/system/
install -o root -g root -m 0644 "$REPOSITORY_SOURCE/config/systemd/hellotalk-factory-health.timer" /etc/systemd/system/
install -o root -g root -m 0755 "$REPOSITORY_SOURCE/config/systemd/hellotalk-factory-watchdog.sh" "$FACTORY_ROOT/hellotalk-factory-watchdog.sh"
install -o root -g root -m 0644 "$REPOSITORY_SOURCE/config/logrotate/hellotalk-factory" /etc/logrotate.d/
systemctl daemon-reload

echo "OpenHands SDK: $("$FACTORY_ROOT/venv/bin/python" -c 'import openhands.sdk; print(openhands.sdk.__version__)')"
"$FACTORY_ROOT/venv/bin/python" -c 'from openhands.sdk import Agent, Conversation, LLM, LLMProfileStore, Tool; from openhands.sdk.llm import FallbackStrategy; from openhands.tools.terminal import TerminalTool; from openhands.tools.file_editor import FileEditorTool; print("OpenHands imports verified")'
echo 'Bootstrap complete. Edit /etc/hellotalk-factory/factory.env, authenticate, then run doctor.'
