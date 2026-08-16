import sys
from collections.abc import Sequence
from pathlib import Path

import pytest

from openhands_factory.exceptions import VerificationFailed
from openhands_factory.repository_guard import ProcessResult
from openhands_factory.verification import commands_for, run_verification


def test_every_change_runs_full_frontend_backend_and_factory_gate(tmp_path: Path) -> None:
    commands = commands_for(tmp_path, {Path("README.md")})
    names = {command.name for command in commands}

    assert "migration-delta" in names
    assert "factory-tests" in names
    assert "frontend-build" in names
    assert "frontend-test" in names
    assert "frontend-e2e" not in names
    assert "backend-build" in names
    assert "backend-test" in names
    assert "backend-test:e2e" in names
    migration = next(command for command in commands if command.name == "migration-delta")
    assert migration.arguments == ("node", "scripts/check-migration-delta.mjs")
    assert migration.directory == tmp_path
    factory = next(command for command in commands if command.name == "factory-tests")
    assert factory.arguments[:3] == (sys.executable, "-m", "pytest")
    assert [command.name for command in commands].index("migration-delta") < [
        command.name for command in commands
    ].index("factory-tests")
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
