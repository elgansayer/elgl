#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPOSITORY=${FACTORY_SOURCE_REPOSITORY:-"$(cd -- "$SCRIPT_DIRECTORY/.." && pwd)"}
DEPLOY_REF=main
# The daemon runs as the operator's own login user, reusing that account's
# already-authenticated CLI subscriptions instead of a separate service
# account with its own credential set.
FACTORY_USER=dev
FACTORY_HOME=/home/dev
FACTORY_CHECKOUT=/var/lib/hellotalk-factory/repository
WORKTREE=''
USE_EXISTING_CREDENTIALS=false
FAST_DEPLOY=false
SOURCE_REF=origin/main
DEPLOYMENT_SUCCEEDED=false
FACTORY_MAINTENANCE_STARTED=false
FACTORY_SERVICE_WAS_ACTIVE=false
FACTORY_HEALTH_TIMER_WAS_ACTIVE=false
DEPLOY_CACHE_DIRECTORY=/opt/hellotalk-factory/deploy-cache
DEPLOY_CACHE_SCHEMA=1
WORKER_IMAGE=localhost/hellotalk-factory-worker:current
FACTORY_VIRTUAL_ENV=/opt/hellotalk-factory/venv
FACTORY_UV_VERSION=0.12.5
FACTORY_UV="$FACTORY_VIRTUAL_ENV/bin/uv"

usage() {
  cat <<'EOF'
Usage: deploy-and-start-factory.sh --use-existing-credentials [--fast]

Deploys the OpenHands factory from the configured repository ref, repairs
canonical host paths, installs the current systemd/watchdog configuration,
starts recovery supervision, and then runs online diagnostics. It never prints
provider credentials.

--fast reuses a dependency tree or worker image only when deployment-owned
fingerprints prove that its inputs and installed output are unchanged. A cache
miss performs the normal refresh and records a new fingerprint. The first fast
deployment after this feature is installed therefore performs a full refresh.

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
    --fast) FAST_DEPLOY=true ;;
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

exec {deploy_lock_fd}>/run/lock/hellotalk-factory-deploy.lock
if ! flock -n "$deploy_lock_fd"; then
  echo 'Another Factory deployment is already running.' >&2
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

# Recover bounded root headroom before fetch, worktree creation, dependency
# refresh, or image builds need it. This script comes from the operator's
# checked-out main revision, which the runbook requires updating first.
"$SCRIPT_DIRECTORY/maintain-factory-host-storage.sh" --apply

if [ -d "$FACTORY_CHECKOUT/.git" ] && [ -n "$(git -C "$FACTORY_CHECKOUT" status --porcelain)" ]; then
  echo "Dedicated Factory checkout is dirty: $FACTORY_CHECKOUT" >&2
  echo 'Preserve or resolve those changes before deployment.' >&2
  exit 1
fi

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
  runuser -u "$FACTORY_USER" -- env \
    HOME="$FACTORY_HOME" \
    PATH=/usr/local/bin:/usr/bin:/bin \
    GH_TOKEN="$factory_github_token" \
    "$@"
}

npm_input_fingerprint() {
  local directory=$1
  {
    printf 'factory-deploy-cache-schema=%s\n' "$DEPLOY_CACHE_SCHEMA"
    printf 'npm-command=ci --ignore-scripts --legacy-peer-deps\n'
    printf 'node-path=%s\n' "$(command -v node)"
    node --version
    printf 'npm-path=%s\n' "$(command -v npm)"
    npm --version
    uname -s
    uname -m
    sha256sum "$directory/package.json" "$directory/package-lock.json"
  } | sha256sum | awk '{print $1}'
}

npm_tree_fingerprint() {
  local directory=$1
  (
    cd "$directory"
    {
      sha256sum node_modules/.package-lock.json
      find node_modules -type f -name package.json -print0 | \
        LC_ALL=C sort -z | xargs -0r sha256sum
      if [ -d node_modules/.bin ]; then
        find node_modules/.bin -mindepth 1 -maxdepth 1 -printf '%P -> %l\n' | \
          LC_ALL=C sort
      fi
    } | sha256sum | awk '{print $1}'
  )
}

npm_cache_is_current() {
  local directory=$1
  local cache_file=$2
  local cached_input
  local cached_tree
  local current_input
  local current_tree

  [ -r "$cache_file" ] || return 1
  [ -r "$directory/node_modules/.package-lock.json" ] || return 1
  if ! read -r cached_input cached_tree < "$cache_file"; then
    return 1
  fi
  current_input=$(npm_input_fingerprint "$directory")
  current_tree=$(npm_tree_fingerprint "$directory")
  [ "$cached_input" = "$current_input" ] && [ "$cached_tree" = "$current_tree" ]
}

record_npm_cache() {
  local directory=$1
  local cache_file=$2
  local input_fingerprint
  local temporary_cache
  local tree_fingerprint
  input_fingerprint=$(npm_input_fingerprint "$directory")
  tree_fingerprint=$(npm_tree_fingerprint "$directory")
  temporary_cache=$(mktemp "${cache_file}.XXXXXX")
  printf '%s %s\n' "$input_fingerprint" "$tree_fingerprint" > "$temporary_cache"
  chmod 0644 "$temporary_cache"
  mv -f "$temporary_cache" "$cache_file"
}

worker_input_fingerprint() {
  {
    printf 'factory-deploy-cache-schema=%s\n' "$DEPLOY_CACHE_SCHEMA"
    printf 'worker-image=%s\n' "$WORKER_IMAGE"
    printf 'podman-path=%s\n' "$(command -v podman)"
    podman --version
    uname -s
    uname -m
    git -C "$WORKTREE" ls-files -s -- automation
  } | sha256sum | awk '{print $1}'
}

worker_image_id() {
  # Rootless Podman re-enters the invoking working directory during its
  # namespace setup for `image inspect` (unlike cheap subcommands such as
  # `--version`). If the operator's checkout lives under a private-mode home
  # directory, that directory is unreadable to the service user and Podman
  # fails silently. --chdir moves the child into a directory the service
  # user owns before Podman runs, matching the intent of the `cd` already
  # used for the worker image build below.
  runuser -u "$FACTORY_USER" -- env \
    --chdir="$FACTORY_HOME" \
    HOME="$FACTORY_HOME" \
    podman image inspect --format '{{.Id}}' "$WORKER_IMAGE" 2>/dev/null
}

worker_cache_is_current() {
  local cache_file=$1
  local cached_input
  local cached_image_id
  local current_image_id

  [ -r "$cache_file" ] || return 1
  if ! read -r cached_input cached_image_id < "$cache_file"; then
    return 1
  fi
  current_image_id=$(worker_image_id) || return 1
  [ "$cached_input" = "$(worker_input_fingerprint)" ] && \
    [ "$cached_image_id" = "$current_image_id" ]
}

record_worker_cache() {
  local cache_file=$1
  local image_id
  local input_fingerprint
  local temporary_cache
  input_fingerprint=$(worker_input_fingerprint)
  image_id=$(worker_image_id)
  temporary_cache=$(mktemp "${cache_file}.XXXXXX")
  printf '%s %s\n' "$input_fingerprint" "$image_id" > "$temporary_cache"
  chmod 0644 "$temporary_cache"
  mv -f "$temporary_cache" "$cache_file"
}

cleanup() {
  exit_status=$?
  trap - EXIT
  set +e
  if [ -n "$WORKTREE" ] && [ -d "$WORKTREE" ]; then
    git -C "$REPOSITORY" worktree remove --force "$WORKTREE" >/dev/null 2>&1 || true
  fi
  if [ "$DEPLOYMENT_SUCCEEDED" != true ] && [ "$FACTORY_MAINTENANCE_STARTED" = true ]; then
    echo 'Factory deployment failed; restoring the previously active supervision units.' >&2
    systemctl daemon-reload >/dev/null 2>&1 || true
    if [ "$FACTORY_SERVICE_WAS_ACTIVE" = true ]; then
      systemctl reset-failed hellotalk-factory.service >/dev/null 2>&1 || true
      if ! systemctl start hellotalk-factory.service; then
        echo 'Failed to restore hellotalk-factory.service after deployment failure.' >&2
      fi
    fi
    if [ "$FACTORY_HEALTH_TIMER_WAS_ACTIVE" = true ]; then
      if ! systemctl start hellotalk-factory-health.timer; then
        echo 'Failed to restore hellotalk-factory-health.timer after deployment failure.' >&2
      fi
    fi
  fi
  exit "$exit_status"
}
trap cleanup EXIT

env GH_TOKEN="$factory_github_token" \
  git -c credential.helper='!gh auth git-credential' \
  -C "$REPOSITORY" fetch origin "$DEPLOY_REF"
WORKTREE=$(mktemp -d /tmp/hellotalk-factory-deploy.XXXXXX)
git -C "$REPOSITORY" worktree add --detach "$WORKTREE" "$SOURCE_REF" >/dev/null

if systemctl is-active --quiet hellotalk-factory.service; then
  FACTORY_SERVICE_WAS_ACTIVE=true
fi
if systemctl is-active --quiet hellotalk-factory-health.timer; then
  FACTORY_HEALTH_TIMER_WAS_ACTIVE=true
fi
FACTORY_MAINTENANCE_STARTED=true
# A first-time deploy, or a host recovering from a partial prior deploy, may
# have no installed unit files yet: `systemctl stop` on a unit that was never
# loaded is fatal under `set -e` even though there is nothing to stop. Accept
# that outcome here; the check below still fails loud if anything real is
# left running.
systemctl stop hellotalk-factory-health.timer || true
# A watchdog invocation already in progress can restart the daemon after the
# timer is stopped. Drain it before stopping the daemon so dependency refreshes
# and image replacement never overlap a live scheduler.
systemctl stop hellotalk-factory-health.service || true
systemctl stop hellotalk-factory.service || true
if systemctl is-active --quiet hellotalk-factory-health.timer || \
  systemctl is-active --quiet hellotalk-factory-health.service || \
  systemctl is-active --quiet hellotalk-factory.service; then
  echo 'Factory supervision units did not stop cleanly; refusing an in-place upgrade.' >&2
  exit 1
fi

"$WORKTREE/scripts/repair-factory-host.sh"

factory_uid="$(id -u "$FACTORY_USER")"
loginctl enable-linger "$FACTORY_USER"
systemctl start "user@${factory_uid}.service"
printf 'XDG_RUNTIME_DIR=/run/user/%s\n' "$factory_uid" > \
  /etc/hellotalk-factory/runtime.env
chown root:"$FACTORY_USER" /etc/hellotalk-factory/runtime.env
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
  install -o root -g "$FACTORY_USER" -m 0640 \
    "$WORKTREE/config/factory/agents.production.json" \
    /etc/hellotalk-factory/agents.json
fi
install -o root -g root -m 0755 \
  "$WORKTREE/config/systemd/hellotalk-factory-watchdog.sh" \
  /opt/hellotalk-factory/hellotalk-factory-watchdog.sh
systemctl disable --now hellotalk-meta-agent.service >/dev/null 2>&1 || true
rm -f /etc/systemd/system/hellotalk-meta-agent.service
systemctl daemon-reload

if [ ! -x "$FACTORY_VIRTUAL_ENV/bin/python" ]; then
  echo 'Missing factory virtual environment.' >&2
  exit 1
fi
if [ ! -x "$FACTORY_UV" ]; then
  echo "Repairing pinned Factory uv $FACTORY_UV_VERSION"
  "$FACTORY_VIRTUAL_ENV/bin/python" -m pip install \
    --disable-pip-version-check --no-input "uv==$FACTORY_UV_VERSION"
fi
VIRTUAL_ENV="$FACTORY_VIRTUAL_ENV" \
  "$FACTORY_UV" sync \
  --active --frozen --inexact --no-editable --extra development \
  --project "$WORKTREE/automation"
if [ ! -x "$FACTORY_UV" ]; then
  echo 'Factory dependency refresh removed the pinned uv executable.' >&2
  exit 1
fi

install -d -o root -g root -m 0755 "$DEPLOY_CACHE_DIRECTORY"

# Factory worktrees reuse these dependency trees. Validate every lockfile before
# the daemon can schedule work so a newly pulled main revision never runs with
# packages from an older deployment. Normal deployments always refresh. Fast
# deployments require both input and installed-tree proof before reuse.
npm_directories=(
  "$FACTORY_CHECKOUT"
  "$FACTORY_CHECKOUT/frontend"
  "$FACTORY_CHECKOUT/backend"
  "$FACTORY_CHECKOUT/e2e"
  "$FACTORY_CHECKOUT/admin-portal"
)
npm_cache_names=(root frontend backend e2e admin-portal)
for index in "${!npm_directories[@]}"; do
  directory=${npm_directories[$index]}
  cache_file="$DEPLOY_CACHE_DIRECTORY/npm-${npm_cache_names[$index]}.sha256"
  if [ -f "$directory/package-lock.json" ]; then
    if [ "$FAST_DEPLOY" = true ] && npm_cache_is_current "$directory" "$cache_file"; then
      echo "Fast deployment: reusing verified Node dependencies in $directory"
      continue
    fi
    if [ "$FAST_DEPLOY" = true ]; then
      echo "Fast deployment cache miss: refreshing Node dependencies in $directory"
    fi
    runuser -u "$FACTORY_USER" -- \
      npm ci --prefix "$directory" --ignore-scripts --legacy-peer-deps
    record_npm_cache "$directory" "$cache_file"
  fi
done
# `$1` is intentionally expanded by the child shell.
# shellcheck disable=SC2016
runuser -u "$FACTORY_USER" -- env HOME="$FACTORY_HOME" \
  bash -c 'cd "$1" && npm exec -- cypress install' _ "$FACTORY_CHECKOUT/frontend"

# Rebuild the secretless worker image from the same immutable main revision as
# the daemon package. This keeps Containerfile and runtime-hardening changes in
# lockstep with the orchestration code. Fast deployment also binds a cache hit
# to the current rootless image ID so an externally replaced tag is never used.
worker_cache_file="$DEPLOY_CACHE_DIRECTORY/worker-image.sha256"
if [ "$FAST_DEPLOY" = true ] && worker_cache_is_current "$worker_cache_file"; then
  echo 'Fast deployment: reusing verified Factory worker image'
else
  if [ "$FAST_DEPLOY" = true ]; then
    echo 'Fast deployment cache miss: rebuilding Factory worker image'
  fi
  install -d -o "$FACTORY_USER" -g "$FACTORY_USER" -m 0750 \
    /opt/hellotalk-factory/build-context
  rsync -a --delete \
    --exclude=.mypy_cache --exclude=.pytest_cache --exclude=.venv \
    --exclude=__pycache__ \
    "$WORKTREE/automation/" /opt/hellotalk-factory/build-context/
  chown -R "$FACTORY_USER:$FACTORY_USER" \
    /opt/hellotalk-factory/build-context
  # Rootless Podman and its helpers may inspect the inherited working directory.
  # The operator's checkout is intentionally not accessible to the service user,
  # so enter the owned build context before starting the child process.
  # `$1` is intentionally expanded by the child shell.
  # shellcheck disable=SC2016
  runuser -u "$FACTORY_USER" -- env HOME="$FACTORY_HOME" \
    bash -c 'cd "$1" && exec podman build --cgroup-manager=cgroupfs \
      --tag localhost/hellotalk-factory-worker:current \
      --file "$1/Containerfile" "$1"' _ \
    /opt/hellotalk-factory/build-context
  record_worker_cache "$worker_cache_file"
fi

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

systemctl is-active hellotalk-factory.service
systemctl is-active hellotalk-factory-health.timer
systemctl --no-pager --full status hellotalk-factory.service
DEPLOYMENT_SUCCEEDED=true
echo 'Factory deployment and startup completed.'
