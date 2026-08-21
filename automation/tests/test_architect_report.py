import json
from pathlib import Path

import pytest

from openhands_factory.architect_report import load_architect_report
from openhands_factory.exceptions import FactoryError


def test_missing_report_is_a_legitimate_empty_result(tmp_path: Path) -> None:
    assert load_architect_report(tmp_path) == []


def test_parses_proposed_issues(tmp_path: Path) -> None:
    (tmp_path / ".factory-architect.json").write_text(
        json.dumps(
            {
                "new_issues": [
                    {"title": "Add rate limiting to /auth/login", "body": "No throttling exists."}
                ]
            }
        ),
        encoding="utf-8",
    )

    proposals = load_architect_report(tmp_path)

    assert len(proposals) == 1
    assert proposals[0].title == "Add rate limiting to /auth/login"


def test_invalid_json_raises(tmp_path: Path) -> None:
    (tmp_path / ".factory-architect.json").write_text("not json", encoding="utf-8")

    with pytest.raises(FactoryError, match="invalid JSON"):
        load_architect_report(tmp_path)


def test_report_requires_a_json_object(tmp_path: Path) -> None:
    (tmp_path / ".factory-architect.json").write_text("[]", encoding="utf-8")

    with pytest.raises(FactoryError, match="must be a JSON object"):
        load_architect_report(tmp_path)


def test_new_issues_must_be_a_list(tmp_path: Path) -> None:
    (tmp_path / ".factory-architect.json").write_text(
        json.dumps({"new_issues": "nope"}), encoding="utf-8"
    )

    with pytest.raises(FactoryError, match="must be a list"):
        load_architect_report(tmp_path)


def test_proposal_needs_a_non_empty_title_and_body(tmp_path: Path) -> None:
    (tmp_path / ".factory-architect.json").write_text(
        json.dumps({"new_issues": [{"title": "", "body": "Something"}]}), encoding="utf-8"
    )

    with pytest.raises(FactoryError, match="non-empty title"):
        load_architect_report(tmp_path)
