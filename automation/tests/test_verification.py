from collections.abc import Sequence
from pathlib import Path

import pytest

from openhands_factory.exceptions import VerificationFailed
from openhands_factory.repository_guard import ProcessResult
from openhands_factory.verification import (
    commands_for,
    run_isolated_verification_process,
    run_verification,
)


def test_every_change_runs_full_repository_and_factory_gate(tmp_path: Path) -> None:
    commands = commands_for(tmp_path, {Path("README.md")})
    names = {command.name for command in commands}

    assert "migration-delta" in names
    assert "agent-ui-governance" in names
    assert "design-sync" in names
    assert "spartan-boundaries" in names
    assert "spartan-full-tree" in names
    assert "component-system" in names
    assert "design-sync-drift" in names
    assert "legacy-primitive-delta" in names
    assert "admin-audit-integrity" in names
    assert "factory-format" in names
    assert "factory-lint" in names
    assert "factory-types" in names
    assert "factory-tests" in names
    assert "frontend-build" in names
    assert "frontend-test" in names
    assert "frontend-e2e" not in names
    assert "backend-build" in names
    assert "backend-test" in names
    assert "backend-test:e2e" in names
    assert "admin-lint:check" in names
    assert "admin-build" in names
    assert "admin-test" in names
    migration = next(command for command in commands if command.name == "migration-delta")
    assert migration.arguments == (
        "env",
        "MIGRATION_BASE_SHA=origin/main",
        "node",
        "scripts/check-migration-delta.mjs",
    )
    assert migration.directory == tmp_path
    factory_format = next(command for command in commands if command.name == "factory-format")
    assert factory_format.arguments == (
        "uv",
        "run",
        "--frozen",
        "ruff",
        "format",
        "--check",
        ".",
    )
    factory_lint = next(command for command in commands if command.name == "factory-lint")
    assert factory_lint.arguments == (
        "uv",
        "run",
        "--frozen",
        "ruff",
        "check",
        ".",
    )
    factory_types = next(command for command in commands if command.name == "factory-types")
    assert factory_types.arguments == ("uv", "run", "--frozen", "mypy")
    factory = next(command for command in commands if command.name == "factory-tests")
    assert factory.arguments == ("uv", "run", "--frozen", "pytest")
    assert all(command.workspace == tmp_path for command in commands)
    assert all(
        command.directory == tmp_path / "automation"
        for command in (factory_format, factory_lint, factory_types, factory)
    )
    assert [command.name for command in commands].index("migration-delta") < [
        command.name for command in commands
    ].index("factory-tests")
    assert (
        next(command for command in commands if command.name == "spartan-boundaries").arguments[1]
        == "SPARTAN_BOUNDARY_BASE_SHA=origin/main"
    )
    frontend_commands = commands_for(tmp_path, {Path("frontend/src/app/app.ts")})
    frontend_e2e = next(command for command in frontend_commands if command.name == "frontend-e2e")
    assert frontend_e2e.arguments[:2] == ("bash", "-lc")
    script = frontend_e2e.arguments[2]
    assert "npm start" in script
    # A crashed dev server must fail fast with its own log, not silently burn
    # the whole wait window and then fail a second, more confusing time inside
    # npm run e2e against a server that was never coming up.
    assert "kill -0" in script
    assert "factory-angular-e2e.log" in script


def test_only_the_fixed_port_command_is_exclusive(tmp_path: Path) -> None:
    """frontend-e2e binds a fixed host port (127.0.0.1:4200) and cannot run
    concurrently with another instance of itself - everything else, including
    backend-test:e2e (an in-process supertest server on an ephemeral port), is
    safe under full worker parallelism and must not be serialized alongside it.
    """
    commands = commands_for(tmp_path, {Path("frontend/src/app/app.ts")})
    exclusive = {command.name for command in commands if command.exclusive}
    assert exclusive == {"frontend-e2e"}


def test_empty_diff_cannot_claim_verification(tmp_path: Path) -> None:
    with pytest.raises(VerificationFailed, match="changed path"):
        commands_for(tmp_path, set())


def test_failure_reports_stdout_and_stderr(tmp_path: Path) -> None:
    commands = commands_for(tmp_path, {Path("README.md")})[:1]

    def failure_runner(arguments: Sequence[str], cwd: Path, timeout: int = 300) -> ProcessResult:
        return ProcessResult(1, "stdout detail", "stderr detail")

    with pytest.raises(VerificationFailed, match=r"(?s)stdout detail.*stderr detail"):
        run_verification(commands, failure_runner)


def test_default_verification_runner_isolates_credentials_state_and_network(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    workspace = tmp_path / "state" / "worktrees" / "task"
    repository = tmp_path / "state" / "repository"
    log_dir = tmp_path / "log"
    virtual_environment = tmp_path / "factory-venv"
    workdir = workspace / "frontend"
    for directory in (repository, log_dir, virtual_environment / "bin", workdir):
        directory.mkdir(parents=True)
    captured: dict[str, object] = {}

    def fake_run_process(arguments, cwd, timeout, *, environment=None):
        captured.update(
            arguments=tuple(arguments),
            cwd=cwd,
            timeout=timeout,
            environment=environment,
        )
        return ProcessResult(0, "", "")

    monkeypatch.setenv("FACTORY_STATE_DIR", str(tmp_path / "state"))
    monkeypatch.setenv("FACTORY_LOG_DIR", str(log_dir))
    monkeypatch.setenv("FACTORY_REPOSITORY", str(repository))
    monkeypatch.setenv("GITHUB_TOKEN", "must-not-propagate")
    monkeypatch.setattr("openhands_factory.verification.sys.prefix", str(virtual_environment))
    monkeypatch.setattr("openhands_factory.verification.run_process", fake_run_process)

    result = run_isolated_verification_process(
        ("npm", "test"),
        workdir,
        123,
        workspace=workspace,
    )

    arguments = captured["arguments"]
    environment = captured["environment"]
    assert result.returncode == 0
    assert isinstance(arguments, tuple)
    assert "--net" in arguments
    assert "--mount-proc" in arguments
    assert "--map-root-user" in arguments
    sandbox_script = next(argument for argument in arguments if "mount --make-rprivate" in argument)
    assert "tmpfs /var/tmp" in sandbox_script
    assert "tmpfs /dev/shm" in sandbox_script
    assert "remount,bind,ro /opt/hellotalk-factory" in sandbox_script
    assert "uv_cache=$service_home/.cache/uv" in sandbox_script
    assert "mount --bind /mnt/factory-verification/uv-cache /tmp/uv-cache" in sandbox_script
    # PID 1 of the sandbox must reap children itself rather than exec-replacing
    # straight into the target command, or an orphaned grandchild (a leftover
    # dev server, a test's own subprocess-under-test) never gets reaped and
    # sits as a zombie for the sandbox's whole lifetime.
    assert "exec /usr/bin/setpriv" not in sandbox_script
    assert "os.waitpid(-1, 0)" in sandbox_script
    assert isinstance(environment, dict)
    assert "GITHUB_TOKEN" not in environment
    assert environment["HOME"] == "/tmp/home"
    assert environment["PATH"].split(":", maxsplit=1)[0] == str(virtual_environment / "bin")
    assert environment["UV_CACHE_DIR"] == "/tmp/uv-cache"
    assert environment["UV_OFFLINE"] == "1"


def test_uv_cache_mount_is_writable_not_read_only() -> None:
    """Unlike Cypress's cache, the uv cache must stay writable: uv still
    touches lock/tag metadata in it even on a full cache hit, and a
    read-only remount (as used for Cypress and the repository) would turn
    those routine writes into hard sandbox failures."""
    from openhands_factory.verification import _VERIFICATION_SANDBOX_SCRIPT

    uv_cache_block = _VERIFICATION_SANDBOX_SCRIPT.split("uv_cache=$service_home/.cache/uv")[
        1
    ].split("fi", 1)[0]
    assert "remount" not in uv_cache_block
    assert (
        "mount --bind /mnt/factory-verification/uv-cache /tmp/uv-cache"
        in _VERIFICATION_SANDBOX_SCRIPT
    )


def test_a_backend_only_change_skips_the_other_workspaces(tmp_path: Path) -> None:
    commands = commands_for(tmp_path, {Path("backend/src/quiz/quiz.service.ts")})
    names = {command.name for command in commands}

    assert "backend-lint:check" in names
    assert "backend-build" in names
    assert "frontend-build" not in names
    assert "admin-lint:check" not in names
    assert "factory-tests" not in names
    # Cross-cutting governance checks still run regardless of which
    # workspace changed.
    assert "constitution" in names
    assert "migration-delta" in names


def test_a_frontend_only_change_skips_the_other_workspaces(tmp_path: Path) -> None:
    commands = commands_for(tmp_path, {Path("frontend/src/app/app.ts")})
    names = {command.name for command in commands}

    assert "frontend-build" in names
    assert "backend-build" not in names
    assert "admin-build" not in names
    assert "factory-tests" not in names


def test_an_automation_only_change_skips_the_other_workspaces(tmp_path: Path) -> None:
    commands = commands_for(tmp_path, {Path("automation/openhands_factory/pipeline.py")})
    names = {command.name for command in commands}

    assert "factory-tests" in names
    assert "factory-format" in names
    assert "backend-build" not in names
    assert "frontend-build" not in names
    assert "admin-build" not in names


def test_a_change_outside_every_workspace_falls_back_to_running_everything(
    tmp_path: Path,
) -> None:
    # A root-level or CI-workflow-only change can't be attributed to any one
    # workspace - verifying nothing would be worse than verifying everything.
    commands = commands_for(tmp_path, {Path("AGENTS.md")})
    names = {command.name for command in commands}

    assert "backend-build" in names
    assert "frontend-build" in names
    assert "admin-build" in names
    assert "factory-tests" in names
