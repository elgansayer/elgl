from __future__ import annotations

from pathlib import Path

from openhands_factory.config import FactoryConfig

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_production_claude_uses_haiku_for_bounded_stall_diagnostics() -> None:
    agents_path = REPOSITORY_ROOT / "config" / "factory" / "agents.production.json"
    config = FactoryConfig.from_environment(
        {
            "FACTORY_AGENTS_CONFIG": str(agents_path),
            "GITHUB_TOKEN": "test-token",
        }
    )

    claude = config.agents.providers["claude"]

    assert claude.phase_models["general_action"] == "haiku"
    assert claude.phase_models["quality_repair"] == "haiku"
    assert claude.phase_models["ci_repair"] == "haiku"
    assert claude.phase_models["code_review"] == "haiku"
    assert claude.phase_models["security_review"] == "sonnet"
    assert claude.phase_models["implementation"] == "sonnet"
    assert claude.phase_models["planning"] == "opus"
    assert claude.phase_models["architecture"] == "opus"

    # The diagnostic lane remains bounded and autonomous; only its Claude fallback
    # model changes. Productive implementation and merge-critical review gates stay
    # on their existing model tiers and routing/recovery policy.
    assert config.agents.timeouts.general_action == 300
    assert config.agents.routing.same_provider_retries == 0
    assert config.agents.routing.general_action == [
        "opencode",
        "google",
        "codex",
        "claude",
        "pi",
    ]
