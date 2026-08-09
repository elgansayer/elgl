from pathlib import Path

RUNBOOK = Path(__file__).parents[2] / "docs" / "factory" / "README.md"

OPERATOR_RECOVERY_COMMANDS = (
    "doctor --online",
    "providers check",
    "status",
    "metrics",
    "pause",
    "resume",
)


def test_runbook_documents_operator_recovery_commands() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    assert "## Operator recovery" in runbook
    recovery = runbook.split("## Operator recovery", 1)[1].split("\n## ", 1)[0]
    for command in OPERATOR_RECOVERY_COMMANDS:
        assert f"hellotalk-factory {command}" in recovery
