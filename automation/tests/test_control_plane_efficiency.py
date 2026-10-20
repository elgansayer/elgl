from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.agents.base import AgentPhase, ProviderHealth, ProviderStatus
from openhands_factory.agents.policy import ConfigRoutingPolicy
from openhands_factory.config import AgentsConfig
from openhands_factory.models import Job, Task

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _job(*, source: str) -> Job:
    return Job(
        task=Task(
            identifier="999001",
            title="Factory control-plane test",
            body="",
            source=source,
            priority=0,
        )
    )


def _health(config: AgentsConfig, default: ProviderStatus) -> dict[str, ProviderHealth]:
    now = datetime.now(UTC)
    return {name: ProviderHealth(name, default, now) for name in config.providers}


def test_factory_internal_general_action_uses_at_most_one_regular_provider() -> None:
    config = AgentsConfig()
    policy = ConfigRoutingPolicy(config)
    health = _health(config, ProviderStatus.HEALTHY)

    candidates = list(
        policy.candidates(
            AgentPhase.GENERAL_ACTION,
            _job(source="factory-internal"),
            health,
        )
    )

    assert candidates == ["opencode"]


def test_factory_internal_general_action_skips_emergency_provider() -> None:
    config = AgentsConfig()
    config.providers["openhands"].enabled = True
    config.routing.general_action.append("openhands")
    policy = ConfigRoutingPolicy(config)
    health = _health(config, ProviderStatus.UNAVAILABLE)
    health["openhands"] = ProviderHealth(
        "openhands",
        ProviderStatus.HEALTHY,
        datetime.now(UTC),
    )

    candidates = list(
        policy.candidates(
            AgentPhase.GENERAL_ACTION,
            _job(source="factory-internal"),
            health,
        )
    )

    assert candidates == []


def test_normal_general_action_retains_provider_fallback_chain() -> None:
    config = AgentsConfig()
    policy = ConfigRoutingPolicy(config)
    health = _health(config, ProviderStatus.HEALTHY)

    candidates = list(
        policy.candidates(
            AgentPhase.GENERAL_ACTION,
            _job(source="github-issue"),
            health,
        )
    )

    assert candidates[:3] == ["opencode", "google", "codex"]
    assert len(candidates) > 1


def test_admin_governance_filters_non_admin_issue_events_before_runner_allocation() -> None:
    workflow = (REPOSITORY_ROOT / ".github/workflows/admin-backlog-governance.yml").read_text(
        encoding="utf-8"
    )

    assert "contains(github.event.issue.title, 'admin')" in workflow
    assert "github.event.label.name == 'factory-ready'" in workflow
    assert "github.event_name != 'issues'" in workflow
