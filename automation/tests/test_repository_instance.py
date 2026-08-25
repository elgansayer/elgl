from pathlib import Path

import pytest

from openhands_factory.repository_instance import (
    assert_workout_agent_single_owner,
    workout_agent_commands_for,
)


def _backend_python(repository: Path) -> Path:
    python = repository / "backend/.venv/bin/python"
    python.parent.mkdir(parents=True)
    python.touch()
    return python


def test_workout_agent_backend_change_runs_backend_build_and_tests(tmp_path: Path) -> None:
    python = _backend_python(tmp_path)

    commands = workout_agent_commands_for(tmp_path, {Path("backend/main.py")})

    assert [command.name for command in commands] == [
        "workout-agent-diff-check",
        "workout-agent-backend-build",
        "workout-agent-backend-tests",
    ]
    assert commands[1].arguments[0] == str(python)
    assert all(command.workspace == tmp_path for command in commands)


def test_workout_agent_frontend_change_runs_angular_build_and_tests(tmp_path: Path) -> None:
    commands = workout_agent_commands_for(tmp_path, {Path("frontend/src/app/app.ts")})

    assert [command.name for command in commands] == [
        "workout-agent-diff-check",
        "workout-agent-frontend-build",
        "workout-agent-frontend-tests",
    ]
    assert commands[-1].arguments == ("npm", "run", "test:ci")
    assert commands[-1].directory == tmp_path / "frontend"


def test_cross_cutting_change_runs_both_stacks(tmp_path: Path) -> None:
    _backend_python(tmp_path)

    commands = workout_agent_commands_for(tmp_path, {Path("docker-compose.yml")})

    assert {command.name for command in commands} == {
        "workout-agent-diff-check",
        "workout-agent-backend-build",
        "workout-agent-backend-tests",
        "workout-agent-frontend-build",
        "workout-agent-frontend-tests",
    }


def test_workout_agent_profile_requires_prepared_backend_environment(tmp_path: Path) -> None:
    with pytest.raises(Exception, match="backend environment is missing"):
        workout_agent_commands_for(tmp_path, {Path("backend/main.py")})


def test_manual_retired_workflow_stub_is_not_a_competing_owner(tmp_path: Path) -> None:
    workflow = tmp_path / ".github/workflows/auto-dispatcher.yml"
    workflow.parent.mkdir(parents=True)
    workflow.write_text(
        "name: Retired dispatcher\non:\n  workflow_dispatch:\npermissions: {}\n",
        encoding="utf-8",
    )

    assert_workout_agent_single_owner(tmp_path)


def test_autonomous_retired_workflow_trigger_fails_closed(tmp_path: Path) -> None:
    workflow = tmp_path / ".github/workflows/auto-dispatcher.yml"
    workflow.parent.mkdir(parents=True)
    workflow.write_text(
        "name: Unsafe dispatcher\non:\n  workflow_dispatch:\n  schedule:\n"
        "    - cron: '0 * * * *'\n",
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError, match="not manual-only"):
        assert_workout_agent_single_owner(tmp_path)
