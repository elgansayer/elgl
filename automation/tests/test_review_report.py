import json
from pathlib import Path

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.models import Task
from openhands_factory.review_report import (
    REVIEW_REPORT_FILENAME,
    extract_acceptance_criteria,
    load_review_report,
)


def task() -> Task:
    return Task(
        "42",
        "Implement real feature",
        """## Goal
Ship the feature.

## Acceptance criteria
- Uses the real API.
- Adds tests.

## Guardrails
Stay focused.
""",
        "github-issue",
        10,
    )


def write_report(worktree: Path, payload: object) -> None:
    (worktree / REVIEW_REPORT_FILENAME).write_text(json.dumps(payload), encoding="utf-8")


def test_extract_acceptance_criteria_is_bounded_to_section() -> None:
    assert extract_acceptance_criteria(task().body) == ["Uses the real API.", "Adds tests."]


def test_approved_report_must_cover_every_acceptance_criterion(tmp_path: Path) -> None:
    write_report(
        tmp_path,
        {
            "approved": True,
            "summary": "Looks good",
            "acceptance_criteria": [
                {
                    "criterion": "Uses the real API.",
                    "status": "pass",
                    "evidence": "backend/src/example.ts",
                }
            ],
            "blocking_findings": [],
        },
    )

    with pytest.raises(FactoryError, match="every acceptance criterion"):
        load_review_report(tmp_path, task())


def test_approval_cannot_coexist_with_blockers(tmp_path: Path) -> None:
    write_report(
        tmp_path,
        {
            "approved": True,
            "summary": "Incorrect approval",
            "acceptance_criteria": [
                {
                    "criterion": "Uses the real API.",
                    "status": "pass",
                    "evidence": "backend/src/example.ts",
                },
                {
                    "criterion": "Adds tests.",
                    "status": "pass",
                    "evidence": "backend/src/example.spec.ts",
                },
            ],
            "blocking_findings": [
                {"code": "production-mock", "message": "Still uses fake data"}
            ],
        },
    )

    with pytest.raises(FactoryError, match="cannot approve"):
        load_review_report(tmp_path, task())


def test_complete_clean_report_is_approved(tmp_path: Path) -> None:
    write_report(
        tmp_path,
        {
            "approved": True,
            "summary": "All criteria verified",
            "acceptance_criteria": [
                {
                    "criterion": "Uses the real API.",
                    "status": "pass",
                    "evidence": "backend/src/example.ts and contract test",
                },
                {
                    "criterion": "Adds tests.",
                    "status": "pass",
                    "evidence": "backend/src/example.spec.ts",
                },
            ],
            "blocking_findings": [],
        },
    )

    report = load_review_report(tmp_path, task())

    assert report.approved
    assert len(report.acceptance_criteria) == 2
