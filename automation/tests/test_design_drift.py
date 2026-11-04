from pathlib import Path

from openhands_factory.design_drift import DRIFT_SCRIPT, check_design_drift, drift_guidance
from openhands_factory.repository_guard import ProcessResult

# Real tail of the gate's output on PR #9691 (issue 1450, 2026-10-29).
DRIFT_OUTPUT = (Path(__file__).parent / "fixtures" / "design_drift_failure.txt").read_text()


def test_guidance_names_each_preview_and_manifest_item() -> None:
    guidance = drift_guidance(DRIFT_OUTPUT, "1450")
    assert guidance is not None
    assert "edit frontend/design-preview/screens/chat.html" in guidance
    assert "edit frontend/design-preview/screens/settings.html" in guidance
    assert 'only the "screen.chat" item of design-sync.manifest.json' in guidance
    assert "message-filter-settings.component.ts" in guidance
    assert "issue-1450-" in guidance
    assert "check:design-sync-drift" in guidance


def test_other_failures_get_no_design_guidance() -> None:
    assert drift_guidance("frontend-build failed with exit 1: > prebuild", "1") is None


def _repository(tmp_path: Path) -> Path:
    (tmp_path / DRIFT_SCRIPT).parent.mkdir()
    (tmp_path / DRIFT_SCRIPT).write_text("")
    return tmp_path


def test_check_runs_the_gate_and_returns_guidance_only_on_failure(tmp_path: Path) -> None:
    repository = _repository(tmp_path)
    calls = []

    def runner(arguments, cwd, timeout=300):
        calls.append((tuple(arguments), cwd))
        return ProcessResult(1, "", DRIFT_OUTPUT)

    guidance = check_design_drift(repository, "1450", runner)
    assert guidance is not None and "screens/chat.html" in guidance
    assert calls[0][0][-1] == "check:design-sync-drift"
    assert "DESIGN_SYNC_BASE_SHA=origin/main" in calls[0][0]
    assert calls[0][1] == repository
    passing = check_design_drift(repository, "1450", lambda *a, **k: ProcessResult(0, "ok", ""))
    assert passing is None


def test_check_is_skipped_where_the_gate_does_not_exist(tmp_path: Path) -> None:
    def runner(*args, **kwargs):
        raise AssertionError("must not run")

    assert check_design_drift(tmp_path, "1", runner) is None
