from __future__ import annotations

import json
from pathlib import Path

import pytest

from openhands_factory.agents.base import AgentPhase, AgentRequest
from openhands_factory.agents.pi import PiProvider
from openhands_factory.models import Task

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


@pytest.mark.parametrize(
    ("phase", "expected_thinking"),
    [
        (AgentPhase.PLANNING, "max"),
        (AgentPhase.ARCHITECTURE, "max"),
        (AgentPhase.IMPLEMENTATION, "max"),
        (AgentPhase.SECURITY_REVIEW, "high"),
        (AgentPhase.QUALITY_REPAIR, "low"),
        (AgentPhase.CODE_REVIEW, "medium"),
        (AgentPhase.CI_REPAIR, "low"),
        (AgentPhase.GENERAL_ACTION, "medium"),
    ],
)
def test_pi_reasoning_is_phase_scoped(
    tmp_path: Path,
    phase: AgentPhase,
    expected_thinking: str,
) -> None:
    provider = PiProvider()
    task = Task("efficiency", "Factory efficiency", "bounded task", "github-issue", 0)
    request = AgentRequest(phase, task, "follow the bounded phase instructions", tmp_path)

    command = list(provider.build_command(request, provider.model_for(phase), None))

    assert command[command.index("--thinking") + 1] == expected_thinking


def test_production_resource_policy_has_no_immediate_retry_and_bounds_diagnostics() -> None:
    config = json.loads(
        (REPOSITORY_ROOT / "config" / "factory" / "agents.production.json").read_text(
            encoding="utf-8"
        )
    )

    assert config["routing"]["same_provider_retries"] == 0
    assert config["timeouts"]["general_action"] == 600


def test_dependency_compatibility_schedule_is_only_a_daily_backstop() -> None:
    workflow = (
        REPOSITORY_ROOT / ".github" / "workflows" / "dependency-compatibility-lanes.yml"
    ).read_text(encoding="utf-8")

    assert "workflow_run:" in workflow
    assert "workflows: ['Dependency review']" in workflow
    assert "cron: '41 4 * * *'" in workflow
    assert "41 */6 * * *" not in workflow
    assert "workflow_dispatch:" in workflow
