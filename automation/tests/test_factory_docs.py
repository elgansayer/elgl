from pathlib import Path

RUNBOOK = Path(__file__).parents[2] / "docs" / "factory" / "README.md"
EXECUTION_ARCHITECTURE = (
    Path(__file__).parents[2] / "docs" / "factory" / "execution-architecture.md"
)

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
    assert "Direct Claude Code, Codex CLI, Gemini/Google Agent, and OpenCode CLI adapters" in architecture
    assert "not production routing peers" in architecture
    assert "fails closed" in architecture
