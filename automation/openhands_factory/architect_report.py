"""Weekly gap-analysis report parsing and validation."""

import json
from dataclasses import dataclass
from pathlib import Path

from openhands_factory.exceptions import FactoryError


@dataclass(frozen=True)
class ArchitectProposal:
    title: str
    body: str


def load_architect_report(worktree: Path) -> list[ArchitectProposal]:
    """Parse the architect's proposed new issues, if it wrote any.

    Unlike the review report, this file is optional: a cycle that finds nothing new
    to propose is a legitimate, common outcome, not a failure.
    """
    report_path = worktree / ".factory-architect.json"
    if not report_path.exists():
        return []

    try:
        data = json.loads(report_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as error:
        raise FactoryError(f"Architect report invalid JSON: {error}") from error
    if not isinstance(data, dict):
        raise FactoryError("Architect report must be a JSON object")

    proposals_data = data.get("new_issues", [])
    if not isinstance(proposals_data, list):
        raise FactoryError("Architect report 'new_issues' must be a list")

    proposals: list[ArchitectProposal] = []
    for item in proposals_data:
        if not isinstance(item, dict):
            raise FactoryError("Each architect proposal must be an object")
        title = item.get("title")
        body = item.get("body")
        if not isinstance(title, str) or not title.strip():
            raise FactoryError("Each architect proposal needs a non-empty title")
        if not isinstance(body, str) or not body.strip():
            raise FactoryError("Each architect proposal needs a non-empty body")
        proposals.append(ArchitectProposal(title=title.strip(), body=body.strip()))
    return proposals
