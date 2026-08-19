from pathlib import Path
from subprocess import CompletedProcess

from openhands_factory.legacy_runtime import (
    LEGACY_SYSTEMD_UNITS,
    detect_legacy_processes,
    detect_legacy_state_paths,
)


def test_missing_legacy_paths_are_clean(tmp_path: Path) -> None:
    assert detect_legacy_state_paths((tmp_path / "missing",)) == []


def test_existing_legacy_state_is_reported_without_marking_it_active(tmp_path: Path) -> None:
    legacy = tmp_path / "hellotalk-swarm"
    legacy.mkdir()
    findings = detect_legacy_state_paths((legacy,))
    assert len(findings) == 1
    assert findings[0].kind == "state"
    assert findings[0].identifier == str(legacy)
    assert not findings[0].active


def test_retired_meta_agent_unit_remains_in_runtime_detection() -> None:
    assert "hellotalk-meta-agent.service" in LEGACY_SYSTEMD_UNITS


def test_unrestricted_claude_process_is_reported_without_command_leakage(monkeypatch) -> None:
    command = "claude --dangerously-skip-permissions secret-looking-argument"
    monkeypatch.setattr(
        "openhands_factory.legacy_runtime._run",
        lambda arguments: CompletedProcess(arguments, 0, f"4321 ? {command}\n", ""),
    )

    findings = detect_legacy_processes()

    assert len(findings) == 1
    assert findings[0].active
    assert findings[0].identifier == "claude --dangerously-skip-permissions"
    assert "secret-looking-argument" not in findings[0].detail


def test_interactive_claude_process_is_not_a_competing_runtime(monkeypatch) -> None:
    command = "claude --dangerously-skip-permissions"
    monkeypatch.setattr(
        "openhands_factory.legacy_runtime._run",
        lambda arguments: CompletedProcess(arguments, 0, f"4321 pts/4 {command}\n", ""),
    )

    assert detect_legacy_processes() == []
