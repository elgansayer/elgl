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


def validate_review_report(
    worktree: Path, task_body: str, expected_head_sha: str | None = None
) -> ReviewReport:
    report_path = worktree / ".factory-review.json"
    if not report_path.exists():
        raise FactoryError("Structured review report missing")

    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise FactoryError(f"Structured review report invalid JSON: {e}") from e

    approved = data.get("approved")
    summary = data.get("summary")
    reviewed_sha = data.get("reviewed_sha")
    criteria = data.get("acceptance_criteria", [])
    blockers = data.get("blocking_findings", [])

    if not isinstance(approved, bool):
        raise FactoryError("Structured review report missing 'approved' boolean")
    if not isinstance(summary, str) or not summary.strip():
        raise FactoryError("Structured review report missing non-empty 'summary'")
    if not isinstance(reviewed_sha, str) or not re.fullmatch(r"[0-9a-fA-F]{7,64}", reviewed_sha):
        raise FactoryError("Structured review report missing valid 'reviewed_sha'")
    if expected_head_sha is not None and reviewed_sha != expected_head_sha:
        raise FactoryError(
            f"Structured review report SHA {reviewed_sha} does not match expected head "
            f"{expected_head_sha}"
        )

    if not isinstance(criteria, list):
        raise FactoryError("Structured review report 'acceptance_criteria' must be a list")

    if not isinstance(blockers, list):
        raise FactoryError("Structured review report 'blocking_findings' must be a list")
    for finding in blockers:
        if not isinstance(finding, dict):
            raise FactoryError("Each blocking finding must be an object")
        if not isinstance(finding.get("severity"), str) or not isinstance(
            finding.get("summary"), str
        ):
            raise FactoryError("Each blocking finding needs severity and summary")
        evidence = finding.get("evidence")
        if not isinstance(evidence, list) or not all(isinstance(item, str) for item in evidence):
            raise FactoryError("Each blocking finding needs an evidence list of strings")

    expected_criteria = extract_acceptance_criteria(task_body)

    report_criteria_text: list[str] = []
    for criterion in criteria:
        if not isinstance(criterion, dict):
            raise FactoryError("Each acceptance criterion must be an object")
        criterion_text = criterion.get("criterion")
        passed = criterion.get("passed")
        evidence = criterion.get("evidence")
        if not isinstance(criterion_text, str) or not criterion_text.strip():
            raise FactoryError("Each acceptance criterion needs a non-empty criterion")
        if not isinstance(passed, bool):
            raise FactoryError("Each acceptance criterion needs a boolean passed value")
        if not isinstance(evidence, list) or not all(isinstance(item, str) for item in evidence):
            raise FactoryError("Each acceptance criterion needs an evidence list of strings")
        if not evidence:
            raise FactoryError("Each acceptance criterion needs evidence")
        report_criteria_text.append(normalize_whitespace(criterion_text))

    if len(report_criteria_text) != len(set(report_criteria_text)):
        raise FactoryError("Structured review report contains duplicate acceptance criteria")

    for expected in expected_criteria:
        if expected not in report_criteria_text:
            raise FactoryError(f"Structured review report missing acceptance criterion: {expected}")

    if expected_criteria and set(report_criteria_text) != set(expected_criteria):
        raise FactoryError("Structured review report contains unrequested acceptance criteria")

    for c in criteria:
        if not c.get("passed"):
            raise FactoryError(f"Acceptance criterion failed: {c.get('criterion')}")

    if blockers:
        raise FactoryError(f"Structured review report contains blocking findings: {blockers}")

    if not approved:
        raise FactoryError("Structured review report is not approved")

    return ReviewReport(
        approved=approved,
        summary=summary,
        acceptance_criteria=criteria,
        blocking_findings=blockers,
    )
