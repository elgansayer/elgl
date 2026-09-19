import json
from datetime import UTC, datetime
from pathlib import Path

from openhands_factory.agents.base import AgentPhase, ProviderHealth, ProviderStatus
from openhands_factory.agents.conservative import ConservativeAgentRouter
from openhands_factory.agents.policy import ConfigRoutingPolicy
from openhands_factory.config import AgentsConfig
from openhands_factory.models import Job, Task


class _Provider:
    def __init__(
        self,
        name: str,
        status: ProviderStatus = ProviderStatus.HEALTHY,
    ) -> None:
        self.name = name
        self.status = status

    def health(self) -> ProviderHealth:
        return ProviderHealth(self.name, self.status, datetime.now(UTC))

    def supports(self, phase: AgentPhase) -> bool:
        return True


def _production_config() -> dict[str, object]:
    path = Path(__file__).parents[2] / "config" / "factory" / "agents.production.json"
    return json.loads(path.read_text(encoding="utf-8"))


def test_production_provider_policy_is_locked() -> None:
    config = _production_config()
    providers = config["providers"]
    routing = config["routing"]
    breaker = config["circuit_breaker"]
    expected_routes = {
        "planning": ["claude", "codex", "google", "opencode", "pi"],
        "architecture": ["claude", "codex", "google", "opencode", "pi"],
        "implementation": ["claude", "codex", "google", "opencode", "pi"],
        "security_review": ["claude", "codex", "google", "opencode", "pi"],
        "quality_repair": ["codex", "claude", "google", "opencode", "pi"],
        "code_review": ["codex", "claude", "google", "opencode", "pi"],
        "ci_repair": ["opencode", "google", "claude", "pi", "codex"],
        "general_action": ["opencode", "google", "codex", "claude", "pi"],
    }

    assert config["routing_enabled"] is True
    assert providers["codex"] == {
        **providers["codex"],
        "enabled": True,
        "auth_mode": "subscription",
        "transport": "cli",
    }
    assert providers["opencode"] == {
        **providers["opencode"],
        "enabled": True,
        "auth_mode": "subscription",
        "transport": "cli",
    }
    assert providers["claude"]["enabled"] is True
    assert providers["claude"]["auth_mode"] == "subscription"
    assert providers["claude"]["transport"] == "cli"
    assert providers["google"]["enabled"] is True
    assert providers["google"]["auth_mode"] == "subscription"
    assert providers["google"]["transport"] == "cli"
    assert providers["pi"]["enabled"] is True
    assert providers["pi"]["auth_mode"] == "subscription"
    assert providers["pi"]["transport"] == "cli"
    assert providers["openhands"]["enabled"] is False
    assert providers["openhands"]["emergency_only"] is True
    assert providers["openhands"]["transport"] == "openhands-sdk"

    assert expected_routes.keys() <= routing.keys()
    assert all(routing[phase] == route for phase, route in expected_routes.items())
    assert "openhands" not in routing["planning"]

    # Keep every low-cost provider ahead of Codex in the static preference. Runtime
    # history promotes Codex after two providers have actually started.
    assert routing["ci_repair"][-1] == "codex"
    assert providers["google"]["phase_models"]["ci_repair"].endswith("flash-low")
    assert providers["claude"]["phase_models"]["ci_repair"] == "haiku"
    assert providers["pi"]["phase_models"]["ci_repair"].endswith("haiku-4.5")

    # With only six real provider starts admitted per hour in conservative mode,
    # rediscovering a known provider-wide outage is material allowance waste.
    assert breaker["failure_threshold"] == 1
    assert breaker["rate_limit_cooldown_seconds"] >= 900


def test_ci_repair_rotation_reaches_codex_in_second_candidate_window() -> None:
    raw_config = _production_config()
    config = AgentsConfig.model_validate(raw_config)
    providers = [_Provider(name) for name, provider in config.providers.items() if provider.enabled]
    router = ConservativeAgentRouter(
        providers,
        policy=ConfigRoutingPolicy(config),
        enabled=True,
    )
    task = Task("ci-42", "Repair CI", "Body", "github-pull-request", 0)
    job = Job(task)

    first_window, _ = router._candidate_names(AgentPhase.CI_REPAIR, job)
    assert first_window == ["opencode", "google"]

    job.provider_history.extend(
        {
            "provider": provider,
            "phase": AgentPhase.CI_REPAIR.value,
            "success": False,
        }
        for provider in first_window
    )
    second_window, _ = router._candidate_names(AgentPhase.CI_REPAIR, job)

    assert second_window == ["codex", "claude"]


def test_ci_repair_stays_cheap_when_preferred_provider_is_unhealthy() -> None:
    raw_config = _production_config()
    config = AgentsConfig.model_validate(raw_config)
    for unavailable, expected_first in (
        ("opencode", ["google", "claude"]),
        ("google", ["opencode", "claude"]),
    ):
        providers = [
            _Provider(
                name,
                ProviderStatus.UNAVAILABLE if name == unavailable else ProviderStatus.HEALTHY,
            )
            for name, provider in config.providers.items()
            if provider.enabled
        ]
        router = ConservativeAgentRouter(
            providers,
            policy=ConfigRoutingPolicy(config),
            enabled=True,
        )
        task = Task(f"ci-{unavailable}", "Repair CI", "Body", "github-pull-request", 0)
        job = Job(task)

        first_window, _ = router._candidate_names(AgentPhase.CI_REPAIR, job)
        assert first_window == expected_first

        job.provider_history.extend(
            {
                "provider": provider,
                "phase": AgentPhase.CI_REPAIR.value,
                "success": False,
            }
            for provider in first_window
        )
        second_window, _ = router._candidate_names(AgentPhase.CI_REPAIR, job)

        assert second_window == ["codex", "pi"]
