from __future__ import annotations

import json
from pathlib import Path

from openhands_factory.branch_hygiene import (
    BranchAudit,
    BranchClassification,
    BranchRecord,
    audit_branches,
    classify_branch,
    delete_safe_branches,
    safe_deletion_candidates,
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


def test_safe_deletion_requires_zero_ahead_and_integrated_or_merged() -> None:
    records = (
        BranchRecord("merged-safe", "a" * 40, BranchClassification.MERGED, 0),
        BranchRecord("integrated-safe", "b" * 40, BranchClassification.INTEGRATED, 0),
        BranchRecord("merged-moved", "c" * 40, BranchClassification.MERGED, 1),
        BranchRecord("closed", "d" * 40, BranchClassification.CLOSED, 0),
        BranchRecord("orphan", "e" * 40, BranchClassification.ORPHAN, 2),
        BranchRecord("live", "f" * 40, BranchClassification.ACTIVE_CANONICAL, 0),
    )
    audit = BranchAudit("owner/repo", "main", "2026-08-17T00:00:00Z", records)

    assert [record.name for record in safe_deletion_candidates(audit)] == [
        "merged-safe",
        "integrated-safe",
    ]
    assert audit.safe_deletion_candidates == ("merged-safe", "integrated-safe")


def test_safe_cleanup_deletes_only_provably_integrated_remote_tips(tmp_path: Path) -> None:
    audit = BranchAudit(
        "owner/repo",
        "main",
        "2026-08-17T00:00:00Z",
        (
            BranchRecord("merged-safe", "a" * 40, BranchClassification.MERGED, 0),
            BranchRecord("orphan-work", "b" * 40, BranchClassification.ORPHAN, 3),
            BranchRecord("closed-work", "c" * 40, BranchClassification.CLOSED, 0),
            BranchRecord("active-work", "d" * 40, BranchClassification.ACTIVE_CANONICAL, 0),
        ),
    )
    calls: list[tuple[str, ...]] = []

    def runner(
        arguments: tuple[str, ...] | list[str],
        cwd: Path,
        timeout: int = 300,
    ) -> ProcessResult:
        del cwd, timeout
        args = tuple(arguments)
        calls.append(args)
        if args[:3] == ("gh", "pr", "list"):
            return ProcessResult(0, "[]", "")
        if args[:2] == ("git", "ls-remote"):
            return ProcessResult(
                0,
                f"{'a' * 40}\trefs/heads/merged-safe\n",
                "",
            )
        if args[:2] == ("git", "push"):
            return ProcessResult(0, "", "")
        raise AssertionError(args)

    deleted = delete_safe_branches(audit, tmp_path, runner=runner)

    assert deleted == ("merged-safe",)
    assert calls == [
        (
            "gh",
            "pr",
            "list",
            "--repo",
            "owner/repo",
            "--state",
            "open",
            "--head",
            "merged-safe",
            "--limit",
            "20",
            "--json",
            "number",
        ),
        ("git", "ls-remote", "--heads", "origin", "refs/heads/merged-safe"),
        (
            "git",
            "push",
            f"--force-with-lease=refs/heads/merged-safe:{'a' * 40}",
            "origin",
            ":refs/heads/merged-safe",
        ),
    ]


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

    def runner(
        arguments: tuple[str, ...] | list[str],
        cwd: Path,
        timeout: int = 300,
    ) -> ProcessResult:
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
    assert payload["safe_deletion_candidates"] == []
    assert all("delete" not in call and "push" not in call for call in calls)
    assert not any(call[:4] == ("gh", "pr", "create", "--repo") for call in calls)
