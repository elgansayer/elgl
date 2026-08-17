import json


def read_source(path: str) -> str:
    with open(path, encoding="utf-8") as source_file:
        return source_file.read()


def test_factory_pipeline_uses_provider_neutral_agent_boundary() -> None:
    source = read_source("openhands_factory/pipeline.py")

    assert "ConversationRunner" in source
    assert "self.conversations.run(" not in source
    assert "enable_auto_merge" not in source
    assert "self.router.run(" in source
    assert "AgentRouter" in source
    assert "ClaudeCodeProvider" in source
    assert "CodexProvider" in source
    assert "GoogleAgentProvider" in source
    assert "OpenCodeProvider" in source
    assert "OpenHandsProvider" in source


def test_openhands_adapter_keeps_its_inner_provider_stable() -> None:
    source = read_source("openhands_factory/conversation_runner.py")

    assert "select_provider_decision" in source
    assert "ProviderName.OPENAI_SUBSCRIPTION" in source
    assert "ProviderName.OPENCODE_GO" in source


def test_production_routes_every_agent_phase_through_openhands() -> None:
    config = json.loads(read_source("../config/factory/agents.production.json"))
    providers = config["providers"]
    routing = config["routing"]

    assert config["routing_enabled"] is True
    assert providers["openhands"]["enabled"] is True
    assert providers["openhands"]["transport"] == "openhands-sdk"
    assert providers["openhands"]["emergency_only"] is False
    assert providers["claude"]["enabled"] is False
    assert providers["codex"]["enabled"] is False
    assert providers["google"]["enabled"] is False
    assert providers["opencode"]["enabled"] is False

    for phase in (
        "planning",
        "architecture",
        "implementation",
        "security_review",
        "quality_repair",
        "code_review",
        "ci_repair",
        "general_action",
    ):
        assert routing[phase] == ["openhands"]


def test_active_architecture_matches_production_provider_boundary() -> None:
    architecture = read_source("../docs/factory/ACTIVE_ARCHITECTURE.md")

    assert "one OpenHands SDK conversation boundary" in architecture
    assert "OpenAI subscription-backed Codex OAuth" in architecture
    assert "OpenCode Go subscription fallback" in architecture
    assert "Google/Gemini is disabled" in architecture
    assert "Emergency-only OpenHands remains behind" not in architecture
