from pathlib import Path

from openhands_factory.legacy_runtime import detect_legacy_state_paths


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
