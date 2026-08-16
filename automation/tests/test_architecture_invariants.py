from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import RepositorySafetyError
from openhands_factory.models import ProviderName
from openhands_factory.provider_profiles import ordered_profiles
from openhands_factory.repository_guard import ensure_push_target

ROOT = Path(__file__).parents[2]
FACTORY = ROOT / "automation" / "openhands_factory"


def environment() -> dict[str, str]:
    return {
        "OPENCODE_GO_API_KEY": "not-a-real-key",
        "OPENCODE_GO_MODEL": "deepseek-v4-flash",
        "GITHUB_TOKEN": "not-a-real-token",
    }


def test_default_provider_chain_is_exactly_codex_oauth_then_opencode() -> None:
    config = FactoryConfig.from_environment(environment())

    assert config.openai_model == "gpt-5.2-codex"
    assert config.gemini_enabled is False
    assert [profile.name for profile in ordered_profiles(config)] == [
        ProviderName.OPENAI_SUBSCRIPTION,
        ProviderName.OPENCODE_GO,
    ]

    template = (ROOT / "config/systemd/factory.env.example").read_text(encoding="utf-8")
    assert "OPENHANDS_OPENAI_MODEL=gpt-5.2-codex" in template
    assert "GEMINI_ENABLED=false" in template
    assert template.index("OPENHANDS_OPENAI_MODEL") < template.index("OPENCODE_GO_MODEL")


def test_provider_selection_is_conversation_stable_without_sdk_fallback_strategy() -> None:
    profiles = (FACTORY / "provider_profiles.py").read_text(encoding="utf-8")
    runner = (FACTORY / "conversation_runner.py").read_text(encoding="utf-8")

    assert "FallbackStrategy" not in profiles
    assert "build_llm(self.config, provider)" in runner
    assert "provider_slot(self.config, provider" in runner
    assert "prefer_different_from=implementation_provider" in runner


def test_worker_terminal_environment_cannot_inherit_controller_secrets() -> None:
    secure_tools = (FACTORY / "secure_tools.py").read_text(encoding="utf-8")

    assert '"HOME": os.environ.get' in secure_tools
    assert '"PATH": os.environ.get' in secure_tools
    assert 'environment["XDG_RUNTIME_DIR"]' in secure_tools
    for controller_secret in (
        "GITHUB_TOKEN",
        "TELEGRAM_BOT_TOKEN",
        "TELEGRAM_CHAT_ID",
        "OPENCODE_GO_API_KEY",
        "GEMINI_API_KEY",
        "openai_oauth.json",
    ):
        assert controller_secret not in secure_tools


def test_factory_cannot_push_protected_base_branch() -> None:
    with pytest.raises(RepositorySafetyError):
        ensure_push_target("main", "main")


def test_retired_swarm_entrypoints_cannot_reappear_under_active_automation() -> None:
    prohibited = {
        ROOT / "automation/swarm",
        ROOT / "automation/ai_swarm",
        ROOT / "automation/aider",
        ROOT / "automation/guardian",
        ROOT / "automation/resolver",
    }
    assert not any(path.exists() for path in prohibited)


def test_all_factory_phases_share_agent_router_with_openhands_fallback() -> None:
    pipeline = (FACTORY / "pipeline.py").read_text(encoding="utf-8")

    assert "self.router.run(request, job)" in pipeline
    assert "OpenHandsProvider(self.conversations)" in pipeline
    assert pipeline.count("self._run_agent(") >= 6
    for legacy_daemon in ("Aider", "SwarmAgent", "GuardianDaemon", "ResolverDaemon"):
        assert legacy_daemon not in pipeline


def test_active_architecture_contract_is_documented() -> None:
    architecture = (ROOT / "docs/factory/ACTIVE_ARCHITECTURE.md").read_text(encoding="utf-8")

    assert "OpenHands Factory" in architecture
    assert "OpenCode Go" in architecture
    assert "retired" in architecture.lower()
