import json
from pathlib import Path

from openhands_factory.agents.base import AgentPhase


def read_source(path: str) -> str:
    source_path = (Path(__file__).parents[1] / path).resolve()
    with source_path.open(encoding="utf-8") as source_file:
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


def test_production_uses_subscription_first_phase_routing() -> None:
    config = json.loads(read_source("../config/factory/agents.production.json"))
    providers = config["providers"]
    routing = config["routing"]

    assert config["routing_enabled"] is True
    assert providers["claude"]["enabled"] is True
    assert providers["codex"]["enabled"] is True
    assert providers["opencode"]["enabled"] is True
    assert providers["google"]["enabled"] is True
    assert providers["pi"]["enabled"] is True
    assert providers["openhands"]["enabled"] is False
    assert providers["openhands"]["transport"] == "openhands-sdk"
    assert providers["openhands"]["emergency_only"] is True

    expected = {
        AgentPhase.PLANNING: ["claude", "codex", "google", "opencode", "pi"],
        AgentPhase.ARCHITECTURE: ["claude", "codex", "google", "opencode", "pi"],
        AgentPhase.IMPLEMENTATION: ["claude", "codex", "google", "opencode", "pi"],
        AgentPhase.SECURITY_REVIEW: ["claude", "codex", "google", "opencode", "pi"],
        AgentPhase.QUALITY_REPAIR: ["codex", "claude", "google", "opencode", "pi"],
        AgentPhase.CODE_REVIEW: ["codex", "claude", "google", "opencode", "pi"],
        AgentPhase.CI_REPAIR: ["codex", "claude", "google", "opencode", "pi"],
        AgentPhase.GENERAL_ACTION: ["opencode", "google", "codex", "claude", "pi"],
    }
    for phase, candidates in expected.items():
        assert routing[phase.value.replace("-", "_")] == candidates
        assert candidates[-1] == "pi"
        assert "openhands" not in candidates


def test_active_architecture_matches_provider_neutral_boundary() -> None:
    architecture = read_source("../docs/factory/ACTIVE_ARCHITECTURE.md")

    assert "OpenHands Factory with interchangeable agents" in architecture
    assert "AgentRouter" in architecture
    assert "Claude CLI" in architecture
    assert "Codex CLI" in architecture
    assert "Google CLI" in architecture
    assert "OpenCode CLI" in architecture
    assert "OpenHands SDK adapter" in architecture
