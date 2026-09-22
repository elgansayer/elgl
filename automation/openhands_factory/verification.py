"""Repository-native verification planning and execution."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, replace
from pathlib import Path
from typing import Literal

from openhands_factory.exceptions import VerificationFailed
from openhands_factory.repository_guard import ProcessResult, ProcessRunner, run_process


@dataclass(frozen=True)
class VerificationCommand:
    name: str
    arguments: tuple[str, ...]
    directory: Path
    timeout: int = 1800
    # Memory-heavy frontend commands and fixed-port browser commands share one
    # host-wide slot. Three concurrent Angular builds can exceed the Factory
    # cgroup's memory high-water mark even though each build is healthy alone.
    exclusive: bool = False
    workspace: Path | None = None


_VERIFICATION_SANDBOX_SCRIPT = r"""
set -eu
workspace=$1
repository=$2
state_dir=$3
log_dir=$4
service_home=$5
cypress_cache=$6
sandbox_root=$7
workdir=$8
shift 8

/usr/bin/mount --make-rprivate /
/usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$sandbox_root"
staging=$sandbox_root/factory-verification
/usr/bin/mkdir -p "$staging/workspace"
/usr/bin/mount --bind "$workspace" "$staging/workspace"

same_repository=false
if [ "$repository" = "$workspace" ]; then
  same_repository=true
else
  /usr/bin/mkdir -p "$staging/repository"
  /usr/bin/mount --bind "$repository" "$staging/repository"
  /usr/bin/mount -o remount,bind,ro "$staging/repository"
fi

has_cypress_cache=false
if [ -d "$cypress_cache" ]; then
  has_cypress_cache=true
  /usr/bin/mkdir -p "$staging/cypress"
  /usr/bin/mount --bind "$cypress_cache" "$staging/cypress"
  /usr/bin/mount -o remount,bind,ro "$staging/cypress"
fi

# uv resolves each worktree as its own project and needs its dependencies
# available locally to build/sync that project's virtual environment - the
# --net namespace below has no route to PyPI, so without a pre-warmed cache
# every job's factory-format/factory-lint/factory-types/factory-tests step
# fails outright on "dns error" trying to fetch even already-pinned wheels.
uv_cache=$service_home/.cache/uv
has_uv_cache=false
if [ -d "$uv_cache" ]; then
  has_uv_cache=true
  /usr/bin/mkdir -p "$staging/uv-cache"
  /usr/bin/mount --bind "$uv_cache" "$staging/uv-cache"
fi

for masked_root in /mnt /srv /media; do
  if [ "$masked_root" != "$sandbox_root" ] && [ -d "$masked_root" ]; then
    /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$masked_root"
  fi
done
if [ -d "$state_dir" ]; then
  /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$state_dir"
fi
if [ -d "$log_dir" ]; then
  /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$log_dir"
fi
/usr/bin/mkdir -p /run/user
/usr/bin/mount -t tmpfs -o mode=755,nosuid,nodev tmpfs /run/user
/usr/bin/mount -t tmpfs -o mode=1777,nosuid,nodev tmpfs /tmp
if [ -d /var/tmp ]; then
  /usr/bin/mount -t tmpfs -o mode=1777,nosuid,nodev tmpfs /var/tmp
fi
if [ -d /dev/shm ]; then
  /usr/bin/mount -t tmpfs -o mode=1777,nosuid,nodev tmpfs /dev/shm
fi
if [ -d /opt/hellotalk-factory ]; then
  /usr/bin/mount --bind /opt/hellotalk-factory /opt/hellotalk-factory
  /usr/bin/mount -o remount,bind,ro /opt/hellotalk-factory
fi

/usr/bin/mkdir -p "$workspace" "$repository" /tmp/home /tmp/npm-cache /tmp/uv-cache
/usr/bin/mount --bind "$staging/workspace" "$workspace"
if [ "$same_repository" = false ]; then
  /usr/bin/mount --bind "$staging/repository" "$repository"
  /usr/bin/mount -o remount,bind,ro "$repository"
fi
# Vite bundles TypeScript configuration through node_modules/.vite-temp even
# during a read-only test run. Worktrees deliberately symlink their dependencies
# to the trusted repository cache, which is remounted read-only above. Overlay only
# this disposable cache directory with sandbox-local tmpfs; dependencies and the
# rest of the trusted repository remain read-only.
for dependency_path in node_modules frontend/node_modules backend/node_modules \
  e2e/node_modules admin-portal/node_modules; do
  writable_vite_cache="$repository/$dependency_path/.vite-temp"
  if [ -d "$writable_vite_cache" ]; then
    /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$writable_vite_cache"
  fi
done
if [ "$has_cypress_cache" = true ]; then
  /usr/bin/mkdir -p /tmp/cypress-cache
  /usr/bin/mount --bind "$staging/cypress" /tmp/cypress-cache
  /usr/bin/mount -o remount,bind,ro /tmp/cypress-cache
fi
if [ "$has_uv_cache" = true ]; then
  /usr/bin/mount --bind "$staging/uv-cache" /tmp/uv-cache
fi

/usr/sbin/ip link set lo up
cd "$workdir"
# This shell is PID 1 of the new namespace, so any grandchild the command
# backgrounds and orphans (e.g. a verification step's own leftover dev
# server, or a test's own subprocess-under-test) reparents to it - but
# without something actually calling waitpid() on those arrivals they sit
# as unreaped zombies for the sandbox's whole lifetime instead of dying
# promptly, unlike on a normal host where init reaps them immediately.
# Hand off to a minimal Python reaper (in the spirit of tini/dumb-init)
# instead of exec-ing the target command directly, so PID 1 keeps reaping
# every child - the tracked one and any stray orphans - for as long as the
# command runs.
exec /usr/bin/python3 -c '
import os
import sys

pid = os.fork()
if pid == 0:
    os.execv(
        "/usr/bin/setpriv",
        [
            "/usr/bin/setpriv",
            "--bounding-set=-all",
            "--inh-caps=-all",
            "--ambient-caps=-all",
            "--no-new-privs",
            "--",
            *sys.argv[1:],
        ],
    )
    os._exit(127)

main_pid = pid
exit_code = 1
while True:
    try:
        reaped_pid, status = os.waitpid(-1, 0)
    except ChildProcessError:
        break
    if reaped_pid == main_pid:
        if os.WIFEXITED(status):
            exit_code = os.WEXITSTATUS(status)
        elif os.WIFSIGNALED(status):
            exit_code = 128 + os.WTERMSIG(status)
        break
sys.exit(exit_code)
' "$@"
"""


def _sandbox_path(value: Path, *, name: str) -> str:
    resolved = value.resolve()
    if resolved == Path("/"):
        raise VerificationFailed(f"Refusing unsafe verification {name} path: {resolved}")
    return str(resolved)


def _verification_sandbox_root(*sources: Path) -> Path:
    """Choose a staging root that does not hide a verification source."""

    resolved_sources = tuple(source.resolve() for source in sources)
    for candidate in (Path("/srv"), Path("/media"), Path("/run")):
        if not any(
            source == candidate or source.is_relative_to(candidate) for source in resolved_sources
        ):
            return candidate
    raise VerificationFailed("No safe verification staging root is available")


def _prepare_vite_cache_mountpoints(repository: Path) -> None:
    """Create safe host mountpoints for Vite's sandbox-local transient cache."""

    for relative in (
        Path("node_modules"),
        Path("frontend/node_modules"),
        Path("backend/node_modules"),
        Path("e2e/node_modules"),
        Path("admin-portal/node_modules"),
    ):
        dependency_dir = repository / relative
        if not dependency_dir.is_dir():
            continue
        cache_dir = dependency_dir / ".vite-temp"
        if cache_dir.is_symlink():
            raise VerificationFailed(f"Refusing symlinked Vite cache mountpoint: {cache_dir}")
        cache_dir.mkdir(exist_ok=True)


def run_isolated_verification_process(
    arguments: tuple[str, ...],
    cwd: Path,
    timeout: int,
    *,
    workspace: Path,
) -> ProcessResult:
    """Run repository-controlled checks without host credentials or network."""

    resolved_workspace = workspace.resolve()
    resolved_cwd = cwd.resolve()
    if not resolved_cwd.is_relative_to(resolved_workspace):
        raise VerificationFailed(f"Verification directory is outside its worktree: {resolved_cwd}")

    state_dir = Path(os.environ.get("FACTORY_STATE_DIR", "/var/lib/hellotalk-factory"))
    log_dir = Path(os.environ.get("FACTORY_LOG_DIR", "/var/log/hellotalk-factory"))
    repository = Path(os.environ.get("FACTORY_REPOSITORY", str(resolved_workspace)))
    _prepare_vite_cache_mountpoints(repository)
    service_home = state_dir / "home"
    # Dependency deployment installs Cypress as the service user with HOME set
    # to its real login home. The isolated state home is intentionally separate
    # and may retain an older binary after package-lock updates. Bind the same
    # deployment-owned cache that `npm exec -- cypress install` refreshes.
    cypress_cache = Path(
        os.environ.get(
            "FACTORY_CYPRESS_CACHE_DIR",
            str(Path.home() / ".cache" / "Cypress"),
        )
    )
    sandbox_root = _verification_sandbox_root(
        resolved_workspace,
        repository,
        service_home,
        cypress_cache,
    )
    # Resolving a virtual environment's Python executable follows its symlink to
    # the system interpreter and loses the environment's bin directory. sys.prefix
    # remains the owning environment and therefore exposes uv inside the sandbox.
    virtual_environment = str(Path(sys.prefix).resolve())
    environment = {
        "CI": "1",
        "CYPRESS_CACHE_FOLDER": "/tmp/cypress-cache",
        "GIT_OPTIONAL_LOCKS": "0",
        "HOME": "/tmp/home",
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "NO_COLOR": "1",
        "NPM_CONFIG_CACHE": "/tmp/npm-cache",
        "PATH": (
            f"{virtual_environment}/bin:/usr/local/bin:/usr/local/sbin:"
            "/usr/bin:/usr/sbin:/bin:/sbin"
        ),
        "TERM": "dumb",
        "UV_CACHE_DIR": "/tmp/uv-cache",
        # The host updater owns dependency synchronisation. Verification mounts
        # /opt read-only and must execute against that prepared environment rather
        # than trying to reinstall the worktree's local project into it.
        "UV_NO_SYNC": "1",
        "UV_OFFLINE": "1",
        "UV_PROJECT_ENVIRONMENT": virtual_environment,
        "VIRTUAL_ENV": virtual_environment,
    }
    command = (
        "unshare",
        "--user",
        "--map-root-user",
        "--mount",
        "--pid",
        "--fork",
        "--mount-proc",
        "--net",
        "--kill-child",
        "/bin/sh",
        "-c",
        _VERIFICATION_SANDBOX_SCRIPT,
        "factory-verification",
        _sandbox_path(resolved_workspace, name="workspace"),
        _sandbox_path(repository, name="repository"),
        _sandbox_path(state_dir, name="state"),
        _sandbox_path(log_dir, name="log"),
        _sandbox_path(service_home, name="home"),
        _sandbox_path(cypress_cache, name="Cypress cache"),
        str(sandbox_root),
        _sandbox_path(resolved_cwd, name="working directory"),
        *arguments,
    )
    return run_process(command, resolved_workspace, timeout, environment=environment)


def _touches(changed_paths: set[Path], *prefixes: str) -> bool:
    return any(path.parts and path.parts[0] in prefixes for path in changed_paths)


RepositoryProfile = Literal["hellotalk", "workout-agent"]


def workout_agent_commands_for(
    repository: Path, changed_paths: set[Path]
) -> list[VerificationCommand]:
    """Return the trusted local gate for the Python and Angular repository."""

    if not changed_paths:
        raise VerificationFailed("Verification requires at least one changed path")
    touches_backend = _touches(changed_paths, "backend")
    touches_frontend = _touches(changed_paths, "frontend")
    if not (touches_backend or touches_frontend):
        touches_backend = touches_frontend = True
    commands = [
        VerificationCommand(
            "control-plane-policy",
            (".venv/bin/python", "tools/check_openhands_control_plane.py"),
            repository,
        ),
        VerificationCommand(
            "control-plane-policy-tests",
            (
                ".venv/bin/python",
                "-m",
                "unittest",
                "tools.test_openhands_control_plane",
                "-v",
            ),
            repository,
        ),
    ]
    if touches_backend:
        commands.extend(
            [
                VerificationCommand(
                    "backend-compile",
                    (".venv/bin/python", "-m", "compileall", "-q", "backend"),
                    repository,
                ),
                VerificationCommand(
                    "backend-tests",
                    (".venv/bin/python", "-m", "pytest", "-q"),
                    repository,
                ),
            ]
        )
    if touches_frontend:
        commands.extend(
            [
                VerificationCommand(
                    "frontend-build", ("npm", "run", "build"), repository / "frontend"
                ),
                VerificationCommand(
                    "frontend-test",
                    ("npm", "test", "--", "--watch=false"),
                    repository / "frontend",
                ),
            ]
        )
    return [replace(command, workspace=repository) for command in commands]


def commands_for(
    repository: Path,
    changed_paths: set[Path],
    profile: RepositoryProfile = "hellotalk",
) -> list[VerificationCommand]:
    if profile == "workout-agent":
        return workout_agent_commands_for(repository, changed_paths)
    if not changed_paths:
        raise VerificationFailed("Verification requires at least one changed path")
    # Each workspace's own build/lint/test commands only run when this diff
    # actually touches that workspace - a repair or review pass that only
    # changed backend/ has no way to affect frontend's or automation's own
    # suite, so re-running them every retry was pure waste. The cross-cutting
    # governance checks (constitution, design-sync, migration-delta, etc.)
    # stay unconditional; they inspect the whole tree by design. If a diff
    # touches none of the four workspaces below - a root-level or workflow
    # file, say - fall back to running everything rather than silently
    # verifying nothing.
    touches_automation = _touches(changed_paths, "automation")
    touches_frontend = _touches(changed_paths, "frontend")
    touches_frontend_directly = touches_frontend
    touches_backend = _touches(changed_paths, "backend")
    touches_admin = _touches(changed_paths, "admin-portal")
    touches_playwright = _touches(changed_paths, "e2e")
    if not (touches_automation or touches_frontend or touches_backend or touches_admin):
        touches_automation = touches_frontend = touches_backend = touches_admin = True
    commands = [
        VerificationCommand("constitution", ("npm", "run", "check:constitution"), repository),
        VerificationCommand(
            "agent-ui-governance",
            ("npm", "run", "check:agent-ui-governance"),
            repository,
        ),
        VerificationCommand("design-sync", ("npm", "run", "check:design-sync"), repository),
        VerificationCommand(
            "spartan-boundaries",
            (
                "env",
                "SPARTAN_BOUNDARY_BASE_SHA=origin/main",
                "npm",
                "run",
                "check:spartan-boundaries",
            ),
            repository,
        ),
        VerificationCommand(
            "spartan-full-tree",
            ("npm", "run", "check:spartan-full-tree"),
            repository,
        ),
        VerificationCommand(
            "component-system",
            ("npm", "run", "check:component-system"),
            repository,
        ),
        VerificationCommand(
            "design-sync-drift",
            (
                "env",
                "DESIGN_SYNC_BASE_SHA=origin/main",
                "npm",
                "run",
                "check:design-sync-drift",
            ),
            repository,
        ),
        VerificationCommand(
            "legacy-primitive-delta",
            (
                "env",
                "LEGACY_PRIMITIVE_BASE_SHA=origin/main",
                "npm",
                "run",
                "check:legacy-primitive-delta",
            ),
            repository,
        ),
        VerificationCommand(
            "conflict-markers", ("node", "scripts/check-conflict-markers.mjs"), repository
        ),
        VerificationCommand(
            "admin-audit-integrity",
            ("node", "scripts/check-admin-audit-integrity.mjs"),
            repository,
        ),
        VerificationCommand(
            "migration-delta",
            ("env", "MIGRATION_BASE_SHA=origin/main", "node", "scripts/check-migration-delta.mjs"),
            repository,
        ),
    ]
    if touches_automation:
        commands.extend(
            [
                VerificationCommand(
                    "factory-format",
                    ("uv", "run", "--frozen", "ruff", "format", "--check", "."),
                    repository / "automation",
                ),
                VerificationCommand(
                    "factory-lint",
                    ("uv", "run", "--frozen", "ruff", "check", "."),
                    repository / "automation",
                ),
                VerificationCommand(
                    "factory-types",
                    ("uv", "run", "--frozen", "mypy"),
                    repository / "automation",
                ),
                VerificationCommand(
                    "factory-tests",
                    # Use the worktree as Python's import root. The pytest console
                    # script lives in the shared runtime venv and would otherwise
                    # test the installed Factory package instead of this PR's code.
                    ("uv", "run", "--frozen", "python", "-m", "pytest"),
                    repository / "automation",
                ),
            ]
        )
    if touches_frontend:
        for script in (
            "check:control-flow",
            "check:template-bindings",
            "check:rtl-logical",
            "lint:check",
            "build",
            "test",
        ):
            commands.append(
                VerificationCommand(
                    f"frontend-{script}",
                    ("npm", "run", script),
                    repository / "frontend",
                    exclusive=script in {"lint:check", "build", "test"},
                )
            )
    if touches_frontend_directly:
        changed_cypress_specs = sorted(
            str(path.relative_to("frontend"))
            for path in changed_paths
            if len(path.parts) >= 4
            and path.parts[:3] == ("frontend", "cypress", "e2e")
            and path.suffix in {".js", ".ts"}
            and (repository / path).is_file()
        )
        cypress_specs = changed_cypress_specs or ["cypress/e2e/cypress-setup.cy.ts"]
        commands.append(
            VerificationCommand(
                "frontend-e2e",
                (
                    "bash",
                    "-lc",
                    "npm start -- --host 127.0.0.1 >/tmp/factory-angular-e2e.log 2>&1 & "
                    "server_pid=$!; trap 'kill \"$server_pid\" 2>/dev/null || true' EXIT; "
                    # 180s, not 60s: a cold Angular compile can genuinely take longer
                    # than a minute under load. Poll the process itself too, so a
                    # server that crashes immediately fails fast with its own log
                    # output instead of silently exhausting the full wait and then
                    # failing a second time, confusingly, inside npm run e2e against
                    # a server that was never coming up.
                    "for attempt in $(seq 1 180); do "
                    'if ! kill -0 "$server_pid" 2>/dev/null; then '
                    "echo 'dev server exited before becoming ready:' >&2; "
                    "tail -n 50 /tmp/factory-angular-e2e.log >&2; exit 1; fi; "
                    "curl -fsS http://127.0.0.1:4200 >/dev/null 2>&1 && break; sleep 1; "
                    'if [ "$attempt" = 180 ]; then '
                    "echo 'dev server did not become ready within 180s:' >&2; "
                    "tail -n 50 /tmp/factory-angular-e2e.log >&2; exit 1; fi; "
                    'done; npm run e2e -- --spec "$1"',
                    "factory-frontend-e2e",
                    ",".join(cypress_specs),
                ),
                repository / "frontend",
                exclusive=True,
            )
        )
    if touches_playwright:
        commands.append(
            VerificationCommand(
                "playwright-discovery",
                ("npm", "test", "--", "--list"),
                repository / "e2e",
            )
        )
    if touches_backend:
        for script in ("lint:check", "build", "test", "test:e2e"):
            commands.append(
                VerificationCommand(
                    f"backend-{script}", ("npm", "run", script), repository / "backend"
                )
            )
    if touches_admin:
        for script in ("lint:check", "build", "test"):
            commands.append(
                VerificationCommand(
                    f"admin-{script}",
                    ("npm", "run", script),
                    repository / "admin-portal",
                )
            )
    return [replace(command, workspace=repository) for command in commands]


def verification_descriptions(profile: RepositoryProfile) -> list[str]:
    if profile == "workout-agent":
        return [
            ".venv/bin/python tools/check_openhands_control_plane.py",
            ".venv/bin/python -m unittest tools.test_openhands_control_plane -v",
            ".venv/bin/python -m compileall -q backend",
            ".venv/bin/python -m pytest -q",
            "cd frontend && npm run build && npm test -- --watch=false",
        ]
    return [
        "npm run check:constitution",
        "npm run check:agent-ui-governance",
        "npm run check:design-sync",
        "npm run check:spartan-boundaries",
        "npm run check:spartan-full-tree",
        "npm run check:component-system",
        "npm run check:design-sync-drift",
        "npm run check:legacy-primitive-delta",
        "node scripts/check-conflict-markers.mjs",
        "node scripts/check-admin-audit-integrity.mjs",
        "node scripts/check-migration-delta.mjs",
        "cd automation && uv run --frozen ruff format --check .",
        "cd automation && uv run --frozen ruff check .",
        "cd automation && uv run --frozen mypy",
        "cd automation && uv run --frozen pytest",
        "cd frontend && npm run lint:check && npm run build && npm run test",
        "cd frontend && npm run e2e when frontend or e2e files changed",
        "cd backend && npm run lint:check && npm run build && npm run test && npm run test:e2e",
        "cd admin-portal && npm run lint:check && npm run build && npm run test",
    ]


def run_verification(
    commands: list[VerificationCommand], runner: ProcessRunner | None = None
) -> None:
    for command in commands:
        if runner is None:
            if command.workspace is None:
                raise VerificationFailed("Verification command has no assigned worktree")
            result = run_isolated_verification_process(
                command.arguments,
                command.directory,
                command.timeout,
                workspace=command.workspace,
            )
        else:
            result = runner(command.arguments, command.directory, command.timeout)
        if result.returncode != 0:
            output = f"{result.stdout}\n{result.stderr}".strip()
            raise VerificationFailed(
                f"{command.name} failed with exit {result.returncode}: {output[-2000:]}"
            )
