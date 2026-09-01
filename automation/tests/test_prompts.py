from pathlib import Path

import pytest

from openhands_factory.models import Task
from openhands_factory.prompts import (
    MAX_PHASE_EXTRA_CHARS,
    MAX_TASK_BODY_CHARS,
    PHASE_TASK_BODY_LIMITS,
    build_phase_prompt,
    build_system_prompt,
    build_task_prompt,
)


def task() -> Task:
    return Task("42", "Fix build", "Broken build", "github-issue", 0)


def test_build_system_prompt_reads_the_system_contract(tmp_path: Path) -> None:
    (tmp_path / "system.md").write_text("system contract", encoding="utf-8")

    prompt = build_system_prompt(tmp_path)

    assert prompt == "system contract"


def test_profile_system_prompt_can_be_separate_from_shared_templates(tmp_path: Path) -> None:
    prompt_dir = tmp_path / "shared"
    prompt_dir.mkdir()
    (prompt_dir / "system.md").write_text("default", encoding="utf-8")
    profile_prompt = tmp_path / "workout-system.md"
    profile_prompt.write_text("workout", encoding="utf-8")

    assert build_system_prompt(prompt_dir, system_prompt_path=profile_prompt) == "workout"


def test_build_task_prompt_includes_issue_and_verification_sections(
    tmp_path: Path,
) -> None:
    (tmp_path / "task.md").write_text("task template", encoding="utf-8")

    prompt = build_task_prompt(tmp_path, task(), [], ["npm run build"], [])

    assert "task template" in prompt
    assert "Task ID: 42" in prompt
    assert "Required verification:\nnpm run build" in prompt
    assert "Untrusted-content rule" in prompt
    assert "reveal secrets" in prompt


def test_build_task_prompt_puts_stable_content_before_the_task_body(
    tmp_path: Path,
) -> None:
    # AGENTS.md and the verification list are identical across almost every
    # task; the issue body is unique per task. Stable content must form an
    # unbroken prefix - anything unique to this task appearing before it
    # would break prompt-cache reuse across different tasks.
    (tmp_path / "task.md").write_text("task template", encoding="utf-8")
    context_files = [(Path("AGENTS.md"), "agents contract content")]

    prompt = build_task_prompt(tmp_path, task(), context_files, ["npm run build"], [])

    assert prompt.index("agents contract content") < prompt.index("Task ID: 42")
    assert prompt.index("Required verification") < prompt.index("Task ID: 42")
    assert prompt.index("Untrusted-content rule") < prompt.index("Task ID: 42")


def test_build_task_prompt_bounds_large_issue_body_and_preserves_head_and_tail(
    tmp_path: Path,
) -> None:
    (tmp_path / "task.md").write_text("task template", encoding="utf-8")
    body = "HEAD-" + ("x" * (MAX_TASK_BODY_CHARS * 2)) + "-TAIL"
    large_task = Task("99", "Large task", body, "github-issue", 0)

    prompt = build_task_prompt(tmp_path, large_task, [], [], [])

    assert "HEAD-" in prompt
    assert "-TAIL" in prompt
    assert "Factory prompt budget omitted" in prompt
    assert len(prompt) < len(body)


def test_build_phase_prompt_supports_security_review(tmp_path: Path) -> None:
    for name in ("review", "repair", "security"):
        (tmp_path / f"{name}.md").write_text(f"{name} instructions", encoding="utf-8")

    prompt = build_phase_prompt(tmp_path, "security", task())

    assert "security instructions" in prompt
    assert "Task ID: 42" in prompt
    assert "Work only in the assigned" in prompt
    assert "Untrusted-content rule" in prompt
    assert "reveal secrets" in prompt
    assert prompt.index("Untrusted-content rule") < prompt.index("Task ID: 42")
    assert "## Begin untrusted task and evidence data" in prompt
    assert "## End untrusted task and evidence data" in prompt


def test_build_phase_prompt_blocks_non_blocking_review_mutations(tmp_path: Path) -> None:
    (tmp_path / "review.md").write_text("review instructions", encoding="utf-8")

    prompt = build_phase_prompt(tmp_path, "review", task())

    assert "only when required to correct a blocking" in prompt
    assert "Do not perform non-blocking cleanup" in prompt
    assert "If no blocking defect exists, leave tracked files unchanged" in prompt
    assert "If defects are found, correct them" not in prompt


def test_build_phase_prompt_bounds_large_evidence(tmp_path: Path) -> None:
    (tmp_path / "repair.md").write_text("repair instructions", encoding="utf-8")
    evidence = "EVIDENCE-HEAD-" + ("y" * (MAX_PHASE_EXTRA_CHARS * 2)) + "-EVIDENCE-TAIL"

    prompt = build_phase_prompt(tmp_path, "repair", task(), extra=evidence)

    assert "EVIDENCE-HEAD-" in prompt
    assert "-EVIDENCE-TAIL" in prompt
    assert "Factory prompt budget omitted" in prompt
    assert len(prompt) < len(evidence) + 2_000


def test_repeated_agent_phases_use_smaller_task_context_budgets(tmp_path: Path) -> None:
    for name in PHASE_TASK_BODY_LIMITS:
        (tmp_path / f"{name}.md").write_text(f"{name} instructions", encoding="utf-8")
    body = "HEAD-" + ("z" * (MAX_TASK_BODY_CHARS * 2)) + "-TAIL"
    large_task = Task("99", "Large task", body, "github-issue", 0)

    prompts = {
        phase: build_phase_prompt(tmp_path, phase, large_task) for phase in PHASE_TASK_BODY_LIMITS
    }

    for phase, prompt in prompts.items():
        assert "HEAD-" in prompt, phase
        assert "-TAIL" in prompt, phase
        assert "Factory prompt budget omitted" in prompt, phase
        assert prompt.count("z") <= PHASE_TASK_BODY_LIMITS[phase], phase

    assert prompts["repair"].count("z") < prompts["review"].count("z")
    assert prompts["quality_repair"].count("z") < prompts["security"].count("z")
    assert prompts["review"].count("z") < prompts["architect"].count("z")


def test_build_phase_prompt_rejects_unknown_phase(tmp_path: Path) -> None:
    (tmp_path / "security.md").write_text("security instructions", encoding="utf-8")

    with pytest.raises(ValueError, match="Unsupported factory phase"):
        build_phase_prompt(tmp_path, "unknown", task())
