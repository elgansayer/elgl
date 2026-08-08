from pathlib import Path

import pytest

from openhands_factory.exceptions import VerificationFailed
from openhands_factory.verification import commands_for


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


def test_empty_diff_cannot_claim_verification(tmp_path: Path) -> None:
    with pytest.raises(VerificationFailed, match="changed path"):
        commands_for(tmp_path, set())
