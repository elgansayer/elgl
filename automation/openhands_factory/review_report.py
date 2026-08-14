"""Review report parsing and validation."""

import json
import re
from dataclasses import dataclass
from pathlib import Path

from openhands_factory.exceptions import FactoryError


@dataclass
class ReviewReport:
    approved: bool
    summary: str
    acceptance_criteria: list[dict[str, object]]
    blocking_findings: list[dict[str, object]]


def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def extract_acceptance_criteria(body: str) -> list[str]:
    lines = body.splitlines()
    criteria = []
    in_criteria = False
    for line in lines:
        if line.strip().lower().startswith("## acceptance criteria"):
            in_criteria = True
            continue
        if in_criteria:
            if line.strip().startswith("## "):
                break
            if line.strip().startswith("- ") or line.strip().startswith("* "):
                # Extract bullet
                criterion = line.strip()[2:].strip()
                # Remove checkbox if present
                if (
                    criterion.startswith("[ ]")
                    or criterion.startswith("[x]")
                    or criterion.startswith("[X]")
                ):
                    criterion = criterion[3:].strip()
                criteria.append(normalize_whitespace(criterion))
    return criteria


def validate_review_report(worktree: Path, task_body: str) -> ReviewReport:
    report_path = worktree / ".factory-review.json"
    if not report_path.exists():
        raise FactoryError("Structured review report missing")

    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise FactoryError(f"Structured review report invalid JSON: {e}") from e

    approved = data.get("approved")
    summary = data.get("summary")
    criteria = data.get("acceptance_criteria", [])
    blockers = data.get("blocking_findings", [])

    if not isinstance(approved, bool):
        raise FactoryError("Structured review report missing 'approved' boolean")

    if not isinstance(criteria, list):
        raise FactoryError("Structured review report 'acceptance_criteria' must be a list")

    if not isinstance(blockers, list):
        raise FactoryError("Structured review report 'blocking_findings' must be a list")

    expected_criteria = extract_acceptance_criteria(task_body)

    report_criteria_text = [normalize_whitespace(c.get("criterion", "")) for c in criteria]

    for expected in expected_criteria:
        if expected not in report_criteria_text:
            raise FactoryError(f"Structured review report missing acceptance criterion: {expected}")

    for c in criteria:
        if not c.get("passed"):
            raise FactoryError(f"Acceptance criterion failed: {c.get('criterion')}")

    if blockers:
        raise FactoryError(f"Structured review report contains blocking findings: {blockers}")

    if not approved:
        raise FactoryError("Structured review report is not approved")

    return ReviewReport(
        approved=approved,
        summary=summary or "Approved",
        acceptance_criteria=criteria,
        blocking_findings=blockers,
    )
