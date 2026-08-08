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

    assert "factory-tests" in names
    assert "frontend-build" in names
    assert "frontend-test" in names
    assert "frontend-e2e" in names
    assert "backend-build" in names
    assert "backend-test" in names
    assert "backend-test:e2e" in names
    factory = next(command for command in commands if command.name == "factory-tests")
    assert factory.arguments[:3] == (sys.executable, "-m", "pytest")
    frontend_e2e = next(command for command in commands if command.name == "frontend-e2e")
    assert frontend_e2e.arguments[:2] == ("bash", "-lc")
    assert "npm start" in frontend_e2e.arguments[2]


def test_empty_diff_cannot_claim_verification(tmp_path: Path) -> None:
    with pytest.raises(VerificationFailed, match="changed path"):
        commands_for(tmp_path, set())


def test_failure_reports_stdout_and_stderr(tmp_path: Path) -> None:
    commands = commands_for(tmp_path, {Path("README.md")})[:1]

    def failure_runner(
        arguments: Sequence[str], cwd: Path, timeout: int = 300
    ) -> ProcessResult:
        return ProcessResult(1, "stdout detail", "stderr detail")

    with pytest.raises(VerificationFailed, match="(?s)stdout detail.*stderr detail"):
        run_verification(commands, failure_runner)
