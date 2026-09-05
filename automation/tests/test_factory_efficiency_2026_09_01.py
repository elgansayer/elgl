from __future__ import annotations

from pathlib import Path

import pytest

from openhands_factory.agents.base import AgentPhase, AgentRequest
from openhands_factory.agents.pi import PiProvider
from openhands_factory.config import FactoryConfig
from openhands_factory.models import Task
from openhands_factory.provider_capacity import maximum_agent_lease_seconds

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
    agents_path = REPOSITORY_ROOT / "config" / "factory" / "agents.production.json"
    config = FactoryConfig.from_environment(
        {
            "FACTORY_AGENTS_CONFIG": str(agents_path),
            "GITHUB_TOKEN": "test-token",
        }
    )

    assert config.agents.routing.same_provider_retries == 0
    assert config.agents.timeouts.general_action == 300
    assert maximum_agent_lease_seconds(config) == 3900


def test_dependency_compatibility_schedule_is_only_a_daily_backstop() -> None:
    workflow = (
        REPOSITORY_ROOT / ".github" / "workflows" / "dependency-compatibility-lanes.yml"
    ).read_text(encoding="utf-8")

    assert "workflow_run:" in workflow
    assert "workflows: ['Dependency review']" in workflow
    assert "cron: '41 4 * * *'" in workflow
    assert "41 */6 * * *" not in workflow
    assert "workflow_dispatch:" in workflow
