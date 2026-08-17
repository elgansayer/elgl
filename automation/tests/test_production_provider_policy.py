import json
from pathlib import Path


REPOSITORY_ROOT = Path(__file__).parents[2]
PRODUCTION_AGENTS = REPOSITORY_ROOT / "config" / "factory" / "agents.production.json"
ROUTED_PHASES = (
    "planning",
    "architecture",
    "implementation",
    "security_review",
    "quality_repair",
    "code_review",
    "ci_repair",
    "general_action",
)
CANONICAL_ROUTE = ["codex", "opencode", "openhands"]


def load_production_agents() -> dict[str, object]:
    return json.loads(PRODUCTION_AGENTS.read_text(encoding="utf-8"))


def test_production_provider_chain_is_codex_then_opencode() -> None:
    config = load_production_agents()
    providers = config["providers"]
    routing = config["routing"]

    assert config["routing_enabled"] is True
    assert providers["codex"]["enabled"] is True
    assert providers["codex"]["auth_mode"] == "subscription"
    assert providers["codex"]["transport"] == "cli"
    assert providers["opencode"]["enabled"] is True
    assert providers["opencode"]["auth_mode"] == "subscription"
    assert providers["opencode"]["transport"] == "cli"

    for phase in ROUTED_PHASES:
        assert routing[phase] == CANONICAL_ROUTE


def test_optional_providers_cannot_preempt_the_canonical_route() -> None:
    config = load_production_agents()
    providers = config["providers"]

    assert providers["claude"]["enabled"] is False
    assert providers["google"]["enabled"] is False
    assert providers["openhands"]["enabled"] is True
    assert providers["openhands"]["emergency_only"] is True
    assert providers["openhands"]["transport"] == "openhands-sdk"

    for phase in ROUTED_PHASES:
        route = config["routing"][phase]
        normal = [
            name
            for name in route
            if providers[name]["enabled"] and not providers[name].get("emergency_only", False)
        ]
        assert normal == ["codex", "opencode"]
