"""Fail-closed parsing for the independent factory review report."""

from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path

from openhands_factory.exceptions import FactoryError
from openhands_factory.models import Task

REVIEW_REPORT_FILENAME = ".factory-review.json"


@dataclass(frozen=True)
class ReviewCriterion:
    criterion: str
    status: str
    evidence: str


@dataclass(frozen=True)
class ReviewFinding:
    code: str
    message: str
    path: str | None = None
    line: int | None = None


@dataclass(frozen=True)
class ReviewReport:
    approved: bool
    summary: str
    acceptance_criteria: tuple[ReviewCriterion, ...]
    blocking_findings: tuple[ReviewFinding, ...]


def extract_acceptance_criteria(body: str) -> list[str]:
    criteria: list[str] = []
    in_section = False
    for raw_line in body.splitlines():
        stripped = raw_line.strip()
        if stripped.startswith("#"):
            heading = stripped.lstrip("#").strip().lower()
            if in_section and heading != "acceptance criteria":
                break
            in_section = heading == "acceptance criteria"
            continue
        if in_section and stripped.startswith(("- ", "* ")):
            criterion = stripped[2:].strip()
            if criterion:
                criteria.append(criterion)
    return criteria


def _normalise(value: str) -> str:
    return " ".join(value.split())


def _parse_criterion(item: object) -> ReviewCriterion:
    if not isinstance(item, dict):
        raise FactoryError("Review report acceptance criteria entries must be objects")
    criterion = item.get("criterion")
    status = item.get("status")
    evidence = item.get("evidence")
    if not isinstance(criterion, str) or not criterion.strip():
        raise FactoryError("Review report criterion text is missing")
    if status not in {"pass", "fail"}:
        raise FactoryError("Review report criterion status must be `pass` or `fail`")
    if not isinstance(evidence, str) or not evidence.strip():
        raise FactoryError("Review report criterion evidence is missing")
    return ReviewCriterion(criterion.strip(), status, evidence.strip())


def _parse_finding(item: object) -> ReviewFinding:
    if not isinstance(item, dict):
        raise FactoryError("Review report blocking findings must be objects")
    code = item.get("code")
    message = item.get("message")
    path = item.get("path")
    line = item.get("line")
    if not isinstance(code, str) or not code.strip():
        raise FactoryError("Review report finding code is missing")
    if not isinstance(message, str) or not message.strip():
        raise FactoryError("Review report finding message is missing")
    if path is not None and not isinstance(path, str):
        raise FactoryError("Review report finding path must be a string or null")
    if line is not None and (not isinstance(line, int) or line <= 0):
        raise FactoryError("Review report finding line must be a positive integer or null")
    return ReviewFinding(code.strip(), message.strip(), path, line)


def load_review_report(worktree: Path, task: Task) -> ReviewReport:
    path = worktree / REVIEW_REPORT_FILENAME
    if not path.is_file():
        raise FactoryError("Independent review did not produce .factory-review.json")
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise FactoryError(f"Independent review report is unreadable: {error}") from error
    if not isinstance(payload, dict):
        raise FactoryError("Independent review report must be a JSON object")

    approved = payload.get("approved")
    summary = payload.get("summary")
    criteria_payload = payload.get("acceptance_criteria")
    findings_payload = payload.get("blocking_findings")
    if not isinstance(approved, bool):
        raise FactoryError("Independent review report is missing boolean `approved`")
    if not isinstance(summary, str) or not summary.strip():
        raise FactoryError("Independent review report is missing `summary`")
    if not isinstance(criteria_payload, list):
        raise FactoryError("Independent review report is missing `acceptance_criteria` list")
    if not isinstance(findings_payload, list):
        raise FactoryError("Independent review report is missing `blocking_findings` list")

    criteria = tuple(_parse_criterion(item) for item in criteria_payload)
    findings = tuple(_parse_finding(item) for item in findings_payload)
    expected = extract_acceptance_criteria(task.body)
    actual = {_normalise(item.criterion): item for item in criteria}
    missing = [criterion for criterion in expected if _normalise(criterion) not in actual]
    if missing:
        raise FactoryError(
            "Independent review did not assess every acceptance criterion: " + "; ".join(missing)
        )
    failed = [item for item in criteria if item.status == "fail"]
    if approved and (failed or findings):
        raise FactoryError(
            "Independent review report cannot approve with failed criteria or blocking findings"
        )
    return ReviewReport(approved, summary.strip(), criteria, findings)


def format_blocking_review(report: ReviewReport, *, limit: int = 20) -> str:
    lines = [report.summary]
    for finding in report.blocking_findings[:limit]:
        location = ""
        if finding.path:
            location = f" {finding.path}"
            if finding.line:
                location += f":{finding.line}"
        lines.append(f"- {finding.code}:{location} {finding.message}")
    failed = [item for item in report.acceptance_criteria if item.status == "fail"]
    for criterion in failed[: max(0, limit - len(report.blocking_findings))]:
        lines.append(f"- acceptance-criterion: {criterion.criterion} — {criterion.evidence}")
    return "\n".join(lines)[:8000]
