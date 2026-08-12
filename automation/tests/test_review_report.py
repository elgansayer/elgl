import json
from pathlib import Path
import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.review_report import extract_acceptance_criteria, validate_review_report


def test_extract_acceptance_criteria() -> None:
    body = """Some text
## Acceptance criteria
- User can login
- [ ] User can logout
- [x] Admin can delete
"""
    criteria = extract_acceptance_criteria(body)
    assert criteria == ["User can login", "User can logout", "Admin can delete"]


def test_validate_review_report_success(tmp_path: Path) -> None:
    report = {
        "approved": True,
        "summary": "LGTM",
        "acceptance_criteria": [{"criterion": "User can login", "passed": True}],
        "blocking_findings": [],
    }
    (tmp_path / ".factory-review.json").write_text(json.dumps(report))

    body = "## Acceptance criteria\n- User can login"
    result = validate_review_report(tmp_path, body)
    assert result.approved is True


def test_validate_review_report_missing_file(tmp_path: Path) -> None:
    with pytest.raises(FactoryError, match="missing"):
        validate_review_report(tmp_path, "")


def test_validate_review_report_missing_criterion(tmp_path: Path) -> None:
    report = {
        "approved": True,
        "summary": "LGTM",
        "acceptance_criteria": [],
        "blocking_findings": [],
    }
    (tmp_path / ".factory-review.json").write_text(json.dumps(report))

    body = "## Acceptance criteria\n- User can login"
    with pytest.raises(FactoryError, match="missing acceptance criterion"):
        validate_review_report(tmp_path, body)


def test_validate_review_report_failed_criterion(tmp_path: Path) -> None:
    report = {
        "approved": True,
        "summary": "LGTM",
        "acceptance_criteria": [{"criterion": "User can login", "passed": False}],
        "blocking_findings": [],
    }
    (tmp_path / ".factory-review.json").write_text(json.dumps(report))

    body = "## Acceptance criteria\n- User can login"
    with pytest.raises(FactoryError, match="failed"):
        validate_review_report(tmp_path, body)


def test_validate_review_report_blocking_findings(tmp_path: Path) -> None:
    report = {
        "approved": True,
        "summary": "LGTM",
        "acceptance_criteria": [],
        "blocking_findings": [{"severity": "blocking"}],
    }
    (tmp_path / ".factory-review.json").write_text(json.dumps(report))

    with pytest.raises(FactoryError, match="blocking findings"):
        validate_review_report(tmp_path, "")


def test_validate_review_report_not_approved(tmp_path: Path) -> None:
    report = {
        "approved": False,
        "summary": "Not good",
        "acceptance_criteria": [],
        "blocking_findings": [],
    }
    (tmp_path / ".factory-review.json").write_text(json.dumps(report))

    with pytest.raises(FactoryError, match="not approved"):
        validate_review_report(tmp_path, "")
