from pathlib import Path

import pytest

from openhands_factory.exceptions import VerificationFailed
from openhands_factory.repository_instance import (
    WORKOUT_AGENT_RETIRED_SWARM_WORKFLOWS,
    assert_workout_agent_single_owner,
    workout_agent_commands_for,
)

REPOSITORY_ROOT = Path(__file__).parents[2]


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
    assert commands[1].arguments[-1] == "backend"
    assert r"(^|/)\\.venv/" in commands[1].arguments
    assert commands[2].arguments[-1] == "backend/tests"
    assert all(command.workspace == tmp_path for command in commands)


def test_workout_agent_frontend_change_runs_angular_build_and_tests(tmp_path: Path) -> None:
    commands = workout_agent_commands_for(tmp_path, {Path("frontend/src/app/app.ts")})

    assert [command.name for command in commands] == [
        "workout-agent-diff-check",
        "workout-agent-frontend-build",
        "workout-agent-frontend-tests",
    ]
    assert commands[-1].arguments == ("npm", "test", "--", "--watch=false")
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
    with pytest.raises(VerificationFailed, match="backend environment is missing"):
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


def test_inline_autonomous_trigger_fails_closed(tmp_path: Path) -> None:
    workflow = tmp_path / ".github/workflows/architect.yml"
    workflow.parent.mkdir(parents=True)
    workflow.write_text(
        "name: Unsafe architect\non: [workflow_dispatch, schedule]\n",
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError, match="not manual-only"):
        assert_workout_agent_single_owner(tmp_path)



def test_all_workout_agent_executor_tombstones_are_guarded() -> None:
    assert {
        ".github/workflows/agent-daily.yml",
        ".github/workflows/agent-hourly.yml",
        ".github/workflows/agent-weekly.yml",
        ".github/workflows/on-failure.yml",
    }.issubset(WORKOUT_AGENT_RETIRED_SWARM_WORKFLOWS)


def test_push_trigger_fails_closed(tmp_path: Path) -> None:
    workflow = tmp_path / ".github/workflows/agent-hourly.yml"
    workflow.parent.mkdir(parents=True)
    workflow.write_text(
        "name: Unsafe agent\non:\n  workflow_dispatch:\n  push:\n",
        encoding="utf-8",
    )

    with pytest.raises(RuntimeError, match="not manual-only"):
        assert_workout_agent_single_owner(tmp_path)


def test_daily_update_coordinates_the_shared_factory_runtime() -> None:
    updater = (
        REPOSITORY_ROOT / "config/systemd/hellotalk-factory-update.sh"
    ).read_text(encoding="utf-8")

    assert "workout-agent-factory.service" in updater
    assert "/var/lib/workout-agent-factory/daemon.json" in updater
    assert 'trap recover_services EXIT' in updater
