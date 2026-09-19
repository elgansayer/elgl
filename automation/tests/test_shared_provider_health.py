from pathlib import Path

import pytest

from openhands_factory.agents.base import AgentFailureKind
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore


def _defaults() -> dict[str, AgentCircuitBreaker]:
    return {
        "claude": AgentCircuitBreaker(
            provider="claude",
            failure_threshold=2,
            cooldown_seconds=300,
        )
    }


def test_repo_factory_instances_share_subscription_circuit_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    shared = tmp_path / "shared"
    monkeypatch.setenv("FACTORY_PROVIDER_CAPACITY_DIR", str(shared))

    hellotalk = AgentHealthStore(tmp_path / "hellotalk" / "agent_health.json")
    workout = AgentHealthStore(tmp_path / "workout-agent" / "agent_health.json")

    assert hellotalk.path == shared / "agent_health.json"
    assert workout.path == shared / "agent_health.json"

    hellotalk.update(
        "claude",
        _defaults(),
        lambda breaker: breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA),
    )

    observed = workout.load(_defaults())["claude"]
    assert observed.state == "open"
    assert observed.last_failure_kind is AgentFailureKind.PROVIDER_QUOTA


def test_custom_health_store_remains_instance_local(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FACTORY_PROVIDER_CAPACITY_DIR", str(tmp_path / "shared"))
    local_path = tmp_path / "instance" / "synthetic-health.json"

    store = AgentHealthStore(local_path)

    assert store.path == local_path


def test_relative_coordination_path_does_not_redirect_health_state(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("FACTORY_PROVIDER_CAPACITY_DIR", "relative/shared")
    local_path = tmp_path / "instance" / "agent_health.json"

    store = AgentHealthStore(local_path)

    assert store.path == local_path
