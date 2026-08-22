"""Repository-native verification planning and execution."""

from __future__ import annotations

import os
import sys
from dataclasses import dataclass, replace
from pathlib import Path

from openhands_factory.exceptions import VerificationFailed
from openhands_factory.repository_guard import ProcessResult, ProcessRunner, run_process


@dataclass(frozen=True)
class VerificationCommand:
    name: str
    arguments: tuple[str, ...]
    directory: Path
    timeout: int = 1800
    # True only for commands that bind a fixed host port (frontend-e2e's dev
    # server on 127.0.0.1:4200) and so cannot run concurrently with another
    # instance of themselves. Everything else - including backend-test:e2e,
    # which talks to its NestJS app in-process via supertest on an ephemeral
    # port - is safe under full worker parallelism.
    exclusive: bool = False
    workspace: Path | None = None


_VERIFICATION_SANDBOX_SCRIPT = r"""
set -eu
workspace=$1
repository=$2
state_dir=$3
log_dir=$4
service_home=$5
workdir=$6
shift 6

/usr/bin/mount --make-rprivate /
/usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs /mnt
/usr/bin/mkdir -p /mnt/factory-verification/workspace
/usr/bin/mount --bind "$workspace" /mnt/factory-verification/workspace

same_repository=false
if [ "$repository" = "$workspace" ]; then
  same_repository=true
else
  /usr/bin/mkdir -p /mnt/factory-verification/repository
  /usr/bin/mount --bind "$repository" /mnt/factory-verification/repository
  /usr/bin/mount -o remount,bind,ro /mnt/factory-verification/repository
fi

cypress_cache=$service_home/.cache/Cypress
has_cypress_cache=false
if [ -d "$cypress_cache" ]; then
  has_cypress_cache=true
  /usr/bin/mkdir -p /mnt/factory-verification/cypress
  /usr/bin/mount --bind "$cypress_cache" /mnt/factory-verification/cypress
  /usr/bin/mount -o remount,bind,ro /mnt/factory-verification/cypress
fi

if [ -d "$state_dir" ]; then
  /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$state_dir"
fi
if [ -d "$log_dir" ]; then
  /usr/bin/mount -t tmpfs -o mode=700,nosuid,nodev tmpfs "$log_dir"
fi
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
/usr/bin/mount --bind /mnt/factory-verification/workspace "$workspace"
if [ "$same_repository" = false ]; then
  /usr/bin/mount --bind /mnt/factory-verification/repository "$repository"
  /usr/bin/mount -o remount,bind,ro "$repository"
fi
if [ "$has_cypress_cache" = true ]; then
  /usr/bin/mkdir -p /tmp/cypress-cache
  /usr/bin/mount --bind /mnt/factory-verification/cypress /tmp/cypress-cache
  /usr/bin/mount -o remount,bind,ro /tmp/cypress-cache
fi

/usr/sbin/ip link set lo up
cd "$workdir"
exec /usr/bin/setpriv \
  --bounding-set=-all \
  --inh-caps=-all \
  --ambient-caps=-all \
  --no-new-privs \
  -- "$@"
"""


def _sandbox_path(value: Path, *, name: str) -> str:
    resolved = value.resolve()
    if resolved == Path("/"):
        raise VerificationFailed(f"Refusing unsafe verification {name} path: {resolved}")
    return str(resolved)


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
    service_home = state_dir / "home"
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
        _sandbox_path(resolved_cwd, name="working directory"),
        *arguments,
    )
    return run_process(command, resolved_workspace, timeout, environment=environment)


def _touches(changed_paths: set[Path], *prefixes: str) -> bool:
    return any(path.parts and path.parts[0] in prefixes for path in changed_paths)


def commands_for(repository: Path, changed_paths: set[Path]) -> list[VerificationCommand]:
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
    touches_backend = _touches(changed_paths, "backend")
    touches_admin = _touches(changed_paths, "admin-portal")
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
                    ("uv", "run", "--frozen", "pytest"),
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
                    f"frontend-{script}", ("npm", "run", script), repository / "frontend"
                )
            )
    if any(path.parts and path.parts[0] in {"frontend", "e2e"} for path in changed_paths):
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
                    "done; npm run e2e",
                ),
                repository / "frontend",
                exclusive=True,
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
