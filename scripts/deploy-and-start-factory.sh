#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY=${FACTORY_SOURCE_REPOSITORY:-"$(cd -- "$SCRIPT_DIRECTORY/.." && pwd)"}
DEPLOY_REF=main
FACTORY_CHECKOUT=/var/lib/hellotalk-factory/repository
WORKTREE=''
USE_EXISTING_CREDENTIALS=false
SOURCE_REF=origin/main

usage() {
  cat <<'EOF'
Usage: deploy-and-start-factory.sh --use-existing-credentials

Deploys the OpenHands factory from the configured repository ref, repairs
canonical host paths, installs the current systemd/watchdog configuration,
starts recovery supervision, and then runs online diagnostics. It never prints
provider credentials.

The repository defaults to the checkout containing this script. Deployment is
always from origin/main, and the dedicated Factory checkout is fast-forwarded
to the same origin/main revision before startup.

The flag is intentionally required because credentials already present on the
host may have been exposed and should normally be rotated first.
EOF
}

for argument in "$@"; do
  case "$argument" in
    --use-existing-credentials) USE_EXISTING_CREDENTIALS=true ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Unknown argument: $argument" >&2; usage >&2; exit 2 ;;
  esac
done

if [ "$USE_EXISTING_CREDENTIALS" != true ]; then
  echo 'Refusing to use existing factory credentials without explicit confirmation.' >&2
  usage >&2
  exit 3
fi
if [ "$(id -u)" -ne 0 ]; then
  echo 'Run this command with sudo.' >&2
  exit 1
fi
if [ ! -d "$REPOSITORY/.git" ]; then
  echo "Not a Git repository: $REPOSITORY" >&2
  exit 1
fi
if [ -n "${FACTORY_DEPLOY_REF:-}" ] && [ "$FACTORY_DEPLOY_REF" != main ]; then
  echo 'FACTORY_DEPLOY_REF must be main.' >&2
  exit 1
fi
if [ -d "$FACTORY_CHECKOUT/.git" ] && [ -n "$(git -C "$FACTORY_CHECKOUT" status --porcelain)" ]; then
  echo "Dedicated Factory checkout is dirty: $FACTORY_CHECKOUT" >&2
  echo 'Preserve or resolve those changes before deployment.' >&2
  exit 1
fi

systemctl stop hellotalk-factory-health.timer hellotalk-factory.service >/dev/null 2>&1 || true

if [ ! -r /etc/hellotalk-factory/factory.env ]; then
  echo 'Missing /etc/hellotalk-factory/factory.env.' >&2
  exit 1
fi
factory_github_token="$({
  set +u
  # shellcheck disable=SC1091
  . /etc/hellotalk-factory/factory.env
  printf '%s' "${GITHUB_TOKEN:-}"
})"
if [ -z "$factory_github_token" ]; then
  echo 'GITHUB_TOKEN is empty in /etc/hellotalk-factory/factory.env.' >&2
  exit 1
fi

factory_git() {
  runuser -u hellotalk-factory -- env \
    HOME=/var/lib/hellotalk-factory/home \
    PATH=/usr/local/bin:/usr/bin:/bin \
    GH_TOKEN="$factory_github_token" \
    "$@"
}

cleanup() {
  if [ -n "$WORKTREE" ] && [ -d "$WORKTREE" ]; then
    git -C "$REPOSITORY" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

env GH_TOKEN="$factory_github_token" \
  git -c credential.helper='!gh auth git-credential' \
  -C "$REPOSITORY" fetch origin "$DEPLOY_REF"
WORKTREE=$(mktemp -d /tmp/hellotalk-factory-deploy.XXXXXX)
git -C "$REPOSITORY" worktree add --detach "$WORKTREE" "$SOURCE_REF" >/dev/null

"$WORKTREE/scripts/repair-factory-host.sh"

factory_uid="$(id -u hellotalk-factory)"
loginctl enable-linger hellotalk-factory
systemctl start "user@${factory_uid}.service"
printf 'XDG_RUNTIME_DIR=/run/user/%s\n' "$factory_uid" > \
  /etc/hellotalk-factory/runtime.env
chown root:hellotalk-factory /etc/hellotalk-factory/runtime.env
chmod 0640 /etc/hellotalk-factory/runtime.env

if [ ! -d "$FACTORY_CHECKOUT/.git" ]; then
  echo "Missing dedicated Factory checkout: $FACTORY_CHECKOUT" >&2
  exit 1
fi
factory_git git -C "$FACTORY_CHECKOUT" config --unset-all credential.helper || true
factory_git git -C "$FACTORY_CHECKOUT" config --add credential.helper ''
factory_git git -C "$FACTORY_CHECKOUT" config --add credential.helper \
  '!gh auth git-credential'
factory_git git -C "$FACTORY_CHECKOUT" fetch origin main
factory_git git -C "$FACTORY_CHECKOUT" switch main
factory_git git -C "$FACTORY_CHECKOUT" merge --ff-only origin/main

install -o root -g root -m 0644 \
  "$WORKTREE/config/systemd/hellotalk-factory.service" \
  /etc/systemd/system/hellotalk-factory.service
install -o root -g root -m 0644 \
  "$WORKTREE/config/systemd/hellotalk-factory-health.service" \
  /etc/systemd/system/hellotalk-factory-health.service
install -o root -g root -m 0644 \
  "$WORKTREE/config/systemd/hellotalk-factory-health.timer" \
  /etc/systemd/system/hellotalk-factory-health.timer
install -o root -g root -m 0644 \
  "$WORKTREE/config/factory/agents.production.json" \
  /etc/hellotalk-factory/agents.example.json
if [ ! -f /etc/hellotalk-factory/agents.json ]; then
  install -o root -g hellotalk-factory -m 0640 \
    "$WORKTREE/config/factory/agents.production.json" \
    /etc/hellotalk-factory/agents.json
fi
install -o root -g root -m 0755 \
  "$WORKTREE/config/systemd/hellotalk-factory-watchdog.sh" \
  /opt/hellotalk-factory/hellotalk-factory-watchdog.sh
systemctl disable --now hellotalk-meta-agent.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/hellotalk-meta-agent.service
systemctl daemon-reload

if [ ! -x /opt/hellotalk-factory/venv/bin/uv ]; then
  echo 'Missing factory virtual environment.' >&2
  exit 1
fi
VIRTUAL_ENV=/opt/hellotalk-factory/venv \
  /opt/hellotalk-factory/venv/bin/uv sync \
  --active --frozen --no-editable --extra development \
  --project "$WORKTREE/automation"

# Factory worktrees reuse these dependency trees. Refresh every lockfile before
# the daemon can schedule work so a newly pulled main revision never runs with
# packages from an older deployment.
for directory in \
  "$FACTORY_CHECKOUT" \
  "$FACTORY_CHECKOUT/frontend" \
  "$FACTORY_CHECKOUT/backend" \
  "$FACTORY_CHECKOUT/e2e" \
  "$FACTORY_CHECKOUT/admin-portal"
do
  if [ -f "$directory/package-lock.json" ]; then
    runuser -u hellotalk-factory -- \
      npm ci --prefix "$directory" --ignore-scripts --legacy-peer-deps
  fi
done
# `$1` is intentionally expanded by the child shell.
# shellcheck disable=SC2016
runuser -u hellotalk-factory -- env HOME=/var/lib/hellotalk-factory/home \
  bash -c 'cd "$1" && npm exec -- cypress install' _ "$FACTORY_CHECKOUT/frontend"

# Rebuild the secretless worker image from the same immutable main revision as
# the daemon package. This keeps Containerfile and runtime-hardening changes in
# lockstep with the orchestration code.
install -d -o hellotalk-factory -g hellotalk-factory -m 0750 \
  /opt/hellotalk-factory/build-context
rsync -a --delete \
  --exclude=.mypy_cache --exclude=.pytest_cache --exclude=.venv \
  --exclude=__pycache__ \
  "$WORKTREE/automation/" /opt/hellotalk-factory/build-context/
chown -R hellotalk-factory:hellotalk-factory \
  /opt/hellotalk-factory/build-context
runuser -u hellotalk-factory -- env HOME=/var/lib/hellotalk-factory/home \
  podman build --cgroup-manager=cgroupfs \
  --tag localhost/hellotalk-factory-worker:current \
  --file /opt/hellotalk-factory/build-context/Containerfile \
  /opt/hellotalk-factory/build-context

if ! grep -q '^[[:space:]]*FACTORY_AGENTS_CONFIG=' /etc/hellotalk-factory/factory.env; then
  printf '\nFACTORY_AGENTS_CONFIG=/etc/hellotalk-factory/agents.json\n' >> \
    /etc/hellotalk-factory/factory.env
fi
if grep -q '^OPENHANDS_OPENAI_MODEL=gpt-5\.3-codex$' \
  /etc/hellotalk-factory/factory.env; then
  sed -i 's/^OPENHANDS_OPENAI_MODEL=gpt-5\.3-codex$/OPENHANDS_OPENAI_MODEL=gpt-5.6-sol/' \
    /etc/hellotalk-factory/factory.env
fi

# start-factory owns the start-before-doctor ordering. In particular, do not run
# doctor here while the daemon may still be stopped: daemon-heartbeat is one of
# the diagnostics and would otherwise block recovery before it can start.
"$WORKTREE/scripts/start-factory.sh"

echo 'Factory deployment and startup completed.'
systemctl is-active hellotalk-factory.service
systemctl is-active hellotalk-factory-health.timer
systemctl --no-pager --full status hellotalk-factory.service
