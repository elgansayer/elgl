from pathlib import Path


REPOSITORY = Path(__file__).parents[2]
PIPELINE = REPOSITORY / "automation" / "openhands_factory" / "pipeline.py"


def test_factory_pipeline_uses_openhands_conversation_boundary() -> None:
    source = PIPELINE.read_text(encoding="utf-8")

    assert "ConversationRunner" in source
    assert "self.conversations.run(" in source
    assert "AgentRouter" not in source
    assert "ClaudeCodeProvider" not in source
    assert "CodexProvider" not in source
    assert "GoogleAgentProvider" not in source
    assert "OpenCodeProvider" not in source


def test_provider_fallback_stays_inside_conversation_runner() -> None:
    source = (
        REPOSITORY / "automation" / "openhands_factory" / "conversation_runner.py"
    ).read_text(encoding="utf-8")

    assert "select_provider_decision" in source
    assert "ProviderName.OPENAI_SUBSCRIPTION" in source
    assert "ProviderName.OPENCODE_GO" in source
