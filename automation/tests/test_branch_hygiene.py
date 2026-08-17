from __future__ import annotations

import json
from pathlib import Path

from openhands_factory.branch_hygiene import (
    BranchClassification,
    audit_branches,
    classify_branch,
)
from openhands_factory.repository_guard import ProcessResult


def test_open_pr_branch_is_active_and_never_mistaken_for_orphan() -> None:
    record = classify_branch(
        name="factory/123-example",
        sha="a" * 40,
        base_branch="main",
        ahead_by=3,
        integrated=False,
        pull_requests=[{"number": 42, "state": "OPEN", "labels": []}],
    )

    assert record.classification is BranchClassification.ACTIVE_CANONICAL
    assert record.pull_requests == (42,)


def test_superseded_open_pr_is_noncanonical() -> None:
    record = classify_branch(
        name="factory/123-example",
        sha="a" * 40,
        base_branch="main",
        ahead_by=2,
        integrated=False,
        pull_requests=[
            {
                "number": 43,
                "state": "OPEN",
                "labels": [{"name": "superseded"}],
            }
        ],
    )

    assert record.classification is BranchClassification.ACTIVE_NON_CANONICAL


def test_provider_and_integrated_branches_are_not_orphans() -> None:
    dependabot = classify_branch(
        name="dependabot/npm_and_yarn/frontend/typescript-6",
        sha="b" * 40,
        base_branch="main",
        ahead_by=1,
        integrated=False,
        pull_requests=[],
    )
    integrated = classify_branch(
        name="old/completed-work",
        sha="c" * 40,
        base_branch="main",
        ahead_by=0,
        integrated=True,
        pull_requests=[],
    )

    assert dependabot.classification is BranchClassification.DEPENDABOT
    assert integrated.classification is BranchClassification.INTEGRATED


def test_unowned_unmerged_branch_is_reported_as_orphan() -> None:
    record = classify_branch(
        name="mystery-work",
        sha="d" * 40,
        base_branch="main",
        ahead_by=4,
        integrated=False,
        pull_requests=[],
    )

    assert record.classification is BranchClassification.ORPHAN


def test_audit_is_read_only_and_emits_machine_readable_counts(tmp_path: Path) -> None:
    calls: list[tuple[str, ...]] = []
    prs = [
        {
            "number": 77,
            "state": "OPEN",
            "mergedAt": None,
            "headRefName": "factory/77-live",
            "labels": [],
            "updatedAt": "2026-08-17T00:00:00Z",
            "url": "https://example.invalid/77",
            "title": "live",
        }
    ]

    def runner(arguments: tuple[str, ...] | list[str], cwd: Path, timeout: int = 300) -> ProcessResult:
        del cwd, timeout
        args = tuple(arguments)
        calls.append(args)
        if args[:2] == ("git", "fetch"):
            return ProcessResult(0, "", "")
        if args[:2] == ("git", "for-each-ref"):
            return ProcessResult(
                0,
                "origin/main|" + "1" * 40 + "\n"
                "origin/factory/77-live|" + "2" * 40 + "\n"
                "origin/orphan-work|" + "3" * 40 + "\n",
                "",
            )
        if args[:3] == ("gh", "pr", "list"):
            return ProcessResult(0, json.dumps(prs), "")
        if args[:2] == ("git", "rev-list"):
            target = args[-1]
            if target.endswith(".." + "1" * 40):
                return ProcessResult(0, "0\n", "")
            if target.endswith(".." + "2" * 40):
                return ProcessResult(0, "1\n", "")
            return ProcessResult(0, "2\n", "")
        if args[:2] == ("git", "merge-base"):
            sha = args[-2]
            return ProcessResult(0 if sha == "1" * 40 else 1, "", "")
        raise AssertionError(args)

    audit = audit_branches("elgansayer/elgl", tmp_path, runner=runner)
    payload = json.loads(audit.to_json())

    assert payload["counts"]["active-canonical-pr"] == 1
    assert payload["counts"]["orphan"] == 1
    assert all("delete" not in call and "push" not in call for call in calls)
    assert not any(call[:4] == ("gh", "pr", "create", "--repo") for call in calls)
