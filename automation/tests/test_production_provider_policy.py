import json
from pathlib import Path


def test_production_provider_policy_is_locked() -> None:
    path = Path(__file__).parents[2] / "config" / "factory" / "agents.production.json"
    config = json.loads(path.read_text(encoding="utf-8"))
    providers = config["providers"]
    routing = config["routing"]
    expected_route = ["codex", "opencode", "openhands"]

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
    assert providers["claude"]["enabled"] is False
    assert providers["google"]["enabled"] is False
    assert providers["openhands"]["enabled"] is True
    assert providers["openhands"]["emergency_only"] is True
    assert providers["openhands"]["transport"] == "openhands-sdk"

    routed_phases = {
        "planning",
        "architecture",
        "implementation",
        "security_review",
        "quality_repair",
        "code_review",
        "ci_repair",
        "general_action",
    }
    assert routed_phases <= routing.keys()
    assert all(routing[phase] == expected_route for phase in routed_phases)
