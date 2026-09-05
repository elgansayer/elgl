import json
from pathlib import Path


def test_production_provider_policy_is_locked() -> None:
    path = Path(__file__).parents[2] / "config" / "factory" / "agents.production.json"
    config = json.loads(path.read_text(encoding="utf-8"))
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

    # CI repair is bounded by concrete failed-check evidence and cannot merge its own
    # output: local verification, independent review, reviewed-SHA protection and
    # required GitHub checks remain authoritative. Reserve flagship Codex for fallback.
    assert routing["ci_repair"][:2] == ["opencode", "google"]
    assert routing["ci_repair"][-1] == "codex"
    assert providers["google"]["phase_models"]["ci_repair"].endswith("flash-low")
    assert providers["claude"]["phase_models"]["ci_repair"] == "haiku"
    assert providers["pi"]["phase_models"]["ci_repair"].endswith("haiku-4.5")

    # With only six real provider starts admitted per hour in conservative mode,
    # rediscovering a known provider-wide outage is material allowance waste.
    assert breaker["failure_threshold"] == 1
    assert breaker["rate_limit_cooldown_seconds"] >= 900
