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
