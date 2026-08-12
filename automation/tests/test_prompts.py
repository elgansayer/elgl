from pathlib import Path

import pytest

from openhands_factory.models import Task
from openhands_factory.prompts import (
    build_phase_prompt,
    build_quality_prompt,
    build_system_prompt,
    build_task_prompt,
)
from openhands_factory.quality_gate import QualityFinding


def task() -> Task:
    return Task("42", "Fix build", "Broken build", "github-issue", 0)


def test_build_system_prompt_reads_the_system_contract(tmp_path: Path) -> None:
    (tmp_path / "system.md").write_text("system contract", encoding="utf-8")

    prompt = build_system_prompt(tmp_path)

    assert prompt == "system contract"


def test_build_task_prompt_includes_issue_and_verification_sections(
    tmp_path: Path,
) -> None:
    (tmp_path / "task.md").write_text("task template", encoding="utf-8")

    prompt = build_task_prompt(tmp_path, task(), [], ["npm run build"], [])

    assert "task template" in prompt
    assert "Task ID: 42" in prompt
    assert "Required verification:\nnpm run build" in prompt
    assert "Untrusted-content rule" in prompt


def test_build_phase_prompt_supports_security_review(tmp_path: Path) -> None:
    for name in ("review", "repair", "security"):
        (tmp_path / f"{name}.md").write_text(f"{name} instructions", encoding="utf-8")

    prompt = build_phase_prompt(tmp_path, "security", task())

    assert "security instructions" in prompt
    assert "Task ID: 42" in prompt
    assert "Work only in the assigned" in prompt


def test_build_quality_prompt_includes_blocking_findings(tmp_path: Path) -> None:
    (tmp_path / "quality.md").write_text("quality instructions", encoding="utf-8")
    finding = QualityFinding(
        "production-mock",
        Path("frontend/src/app/example.ts"),
        12,
        "new production code contains mock behaviour",
    )

    prompt = build_quality_prompt(tmp_path, task(), [finding])

    assert "quality instructions" in prompt
    assert "production-mock" in prompt
    assert "frontend/src/app/example.ts:12" in prompt


def test_build_phase_prompt_rejects_unknown_phase(tmp_path: Path) -> None:
    (tmp_path / "security.md").write_text("security instructions", encoding="utf-8")

    with pytest.raises(ValueError, match="Unsupported factory phase"):
        build_phase_prompt(tmp_path, "unknown", task())
