from pathlib import Path

REPOSITORY = Path(__file__).parents[2]
RUNBOOK = REPOSITORY / "docs" / "factory" / "README.md"
EXECUTION_ARCHITECTURE = REPOSITORY / "docs" / "factory" / "execution-architecture.md"
ACTIVE_ARCHITECTURE = REPOSITORY / "docs" / "factory" / "ACTIVE_ARCHITECTURE.md"
AI_WORKFLOW = REPOSITORY / ".github" / "workflows" / "AI-WORKFLOW.md"
ENV_EXAMPLE = REPOSITORY / "config" / "systemd" / "factory.env.example"

OPERATOR_RECOVERY_COMMANDS = (
    "doctor --online",
    "providers check",
    "status",
    "metrics",
    "reconcile",
    "pause",
    "resume",
)


def test_runbook_documents_operator_recovery_commands() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    assert "## Operator recovery" in runbook
    recovery = runbook.split("## Operator recovery", 1)[1].split("\n## ", 1)[0]
    for command in OPERATOR_RECOVERY_COMMANDS:
        assert f"hellotalk-factory {command}" in recovery


def test_execution_architecture_locks_openhands_control_plane() -> None:
    architecture = EXECUTION_ARCHITECTURE.read_text(encoding="utf-8")

    assert "exactly one autonomous execution control plane" in architecture
    assert "OpenHands Agent Canvas" in architecture
    assert "OpenAI subscription OAuth / Codex" in architecture
    assert "OpenCode Go" in architecture
    assert "only production fallback" in architecture
    direct_adapters = (
        "Direct Claude Code, Codex CLI, Gemini/Google Agent, and OpenCode CLI adapters"
    )
    assert direct_adapters in architecture
    assert "not production routing peers" in architecture
    assert "fails closed" in architecture


def test_active_architecture_cannot_drift_back_to_direct_cli_routing() -> None:
    architecture = ACTIVE_ARCHITECTURE.read_text(encoding="utf-8")

    required_contract = (
        "OpenHands Agent Canvas Factory",
        "FACTORY_ARCHITECTURE=openhands-agent-canvas-v1",
        "OpenAI subscription / Codex OAuth",
        "OpenCode Go",
        "CI / required",
        "factory/independent-review",
        "Terminal issue quarantine is not the production recovery strategy",
        "Dependency upgrades that change",
        "migration-specific acceptance criteria",
    )
    for marker in required_contract:
        assert marker in architecture

    retired_runtime_claims = (
        "Subscription-First CLI Orchestrator",
        "caveman claude",
        "meta_agent.py",
    )
    for marker in retired_runtime_claims:
        assert marker not in architecture


def test_workflow_and_environment_match_the_authoritative_provider_chain() -> None:
    workflow = AI_WORKFLOW.read_text(encoding="utf-8")
    environment = ENV_EXAMPLE.read_text(encoding="utf-8")

    assert "OpenAI subscription/Codex OAuth -> OpenCode Go" in workflow
    assert "Gemini free tier" not in workflow
    assert "Three consecutive failures quarantine" not in workflow
    assert "FACTORY_ARCHITECTURE=openhands-agent-canvas-v1" in environment
    assert "GEMINI_ENABLED=false" in environment
    assert "Codex via OpenHands subscription OAuth -> OpenCode Go only" in environment
