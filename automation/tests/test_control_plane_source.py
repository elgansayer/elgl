def read_source(path: str) -> str:
    with open(path, encoding="utf-8") as source_file:
        return source_file.read()


def test_factory_pipeline_uses_openhands_conversation_boundary() -> None:
    source = read_source("openhands_factory/pipeline.py")

    assert "ConversationRunner" in source
    assert "self.conversations.run(" in source
    assert "AgentRouter" not in source
    assert "ClaudeCodeProvider" not in source
    assert "CodexProvider" not in source
    assert "GoogleAgentProvider" not in source
    assert "OpenCodeProvider" not in source


def test_provider_fallback_stays_inside_conversation_runner() -> None:
    source = read_source("openhands_factory/conversation_runner.py")

    assert "select_provider_decision" in source
    assert "ProviderName.OPENAI_SUBSCRIPTION" in source
    assert "ProviderName.OPENCODE_GO" in source
