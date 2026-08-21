from pathlib import Path

from openhands_factory.agents.base import AgentFailureKind, ProviderStatus
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore
from openhands_factory.config import FactoryConfig
from openhands_factory.doctor import agent_provider_checks


def config(tmp_path: Path, *, routing: bool) -> FactoryConfig:
    agents = tmp_path / "agents.json"
    agents.write_text(
        '{"routing_enabled": '
        + ("true" if routing else "false")
        + ', "providers": {"openhands": {"enabled": true}, "codex": {"enabled": true}}, '
        '"routing": {"implementation": ["codex"]}}',
        encoding="utf-8",
    )
    return FactoryConfig.from_environment(
        {
            "FACTORY_STATE_DIR": str(tmp_path),
            "FACTORY_REPOSITORY": str(tmp_path / "repository"),
            "FACTORY_LOG_DIR": str(tmp_path / "log"),
            "FACTORY_PROFILE_STORE": str(tmp_path / "profiles"),
            "FACTORY_WORKTREE_DIR": str(tmp_path / "worktrees"),
            "FACTORY_RECOVERY_DIR": str(tmp_path / "recovery"),
            "FACTORY_AGENTS_CONFIG": str(agents),
            "GITHUB_TOKEN": "token",
        }
    )


def test_doctor_reports_outer_router_disabled_by_default(tmp_path: Path) -> None:
    checks = agent_provider_checks(config(tmp_path, routing=False))
    assert checks[0].name == "agent-routing"
    assert not checks[0].passed
    assert "OpenHands compatibility mode" in checks[0].detail


def test_doctor_surfaces_typed_outer_provider_breaker(tmp_path: Path) -> None:
    factory_config = config(tmp_path, routing=True)
    breaker = AgentCircuitBreaker(provider="codex", failure_threshold=3, cooldown_seconds=60)
    breaker.record_failure(AgentFailureKind.PROVIDER_AUTH)
    AgentHealthStore(tmp_path / "agent_health.json").save({"codex": breaker})

    checks = {check.name: check for check in agent_provider_checks(factory_config)}

    assert checks["agent:codex"].detail.startswith(ProviderStatus.AUTH_REQUIRED.value)
