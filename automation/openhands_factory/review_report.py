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
        stripped = line.strip()
        if re.fullmatch(r"#{1,6}\s+acceptance criteria\s*:?\s*", stripped, re.IGNORECASE):
            in_criteria = True
            continue
        if in_criteria:
            if re.match(r"^#{1,6}\s+", stripped):
                break
            if stripped.startswith("- ") or stripped.startswith("* "):
                # Extract bullet
                criterion = stripped[2:].strip()
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
    worktree: Path,
    task_body: str,
    *,
    require_approval: bool = True,
) -> ReviewReport:
    """Validate a review report.

    Which commit was reviewed is deliberately not read from the report: the caller
    already knows it via `git rev-parse HEAD`, run on the host before the
    conversation even started, which is the only trusted source for it anyway.
    Asking the model to correctly copy a 40-character hash into the report added a
    frequent, needless point of failure (a forgotten field, or a placeholder, would
    fail an otherwise-valid review) without adding any real integrity guarantee
    over the host-read value.
    """
    report_path = worktree / ".factory-review.json"
    if not report_path.exists():
        raise FactoryError("Structured review report missing")

    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise FactoryError(f"Structured review report invalid JSON: {e}") from e
    if not isinstance(data, dict):
        raise FactoryError("Structured review report must be a JSON object")

    approved = data.get("approved")
    summary = data.get("summary")
    criteria = data.get("acceptance_criteria", [])
    blockers = data.get("blocking_findings", [])

    if not isinstance(approved, bool):
        raise FactoryError("Structured review report missing 'approved' boolean")
    if not isinstance(summary, str) or not summary.strip():
        raise FactoryError("Structured review report missing non-empty 'summary'")

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

    if require_approval:
        for criterion in criteria:
            if not criterion.get("passed"):
                raise FactoryError(f"Acceptance criterion failed: {criterion.get('criterion')}")

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
