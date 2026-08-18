import json
from pathlib import Path


def test_production_provider_policy_is_locked() -> None:
    path = Path(__file__).parents[2] / "config" / "factory" / "agents.production.json"
    config = json.loads(path.read_text(encoding="utf-8"))
    providers = config["providers"]
    routing = config["routing"]
    expected_routes = {
        "planning": ["claude", "codex", "google", "opencode", "openhands"],
        "architecture": ["claude", "codex", "google", "opencode", "openhands"],
        "implementation": ["claude", "codex", "google", "opencode", "openhands"],
        "security_review": ["claude", "codex", "google", "opencode", "openhands"],
        "quality_repair": ["codex", "claude", "google", "opencode", "openhands"],
        "code_review": ["codex", "claude", "google", "opencode", "openhands"],
        "ci_repair": ["codex", "claude", "google", "opencode", "openhands"],
        "general_action": ["opencode", "google", "codex", "claude", "openhands"],
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
    assert providers["google"]["enabled"] is False
    assert providers["openhands"]["enabled"] is True
    assert providers["openhands"]["emergency_only"] is True
    assert providers["openhands"]["transport"] == "openhands-sdk"

    assert expected_routes.keys() <= routing.keys()
    assert all(routing[phase] == route for phase, route in expected_routes.items())
