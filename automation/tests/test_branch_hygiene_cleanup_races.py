from __future__ import annotations

import json
from pathlib import Path

from openhands_factory.branch_hygiene import (
    BranchAudit,
    BranchClassification,
    BranchRecord,
    delete_safe_branches,
)
from openhands_factory.repository_guard import ProcessResult


def _audit() -> BranchAudit:
    return BranchAudit(
        "owner/repo",
        "main",
        "2026-08-17T00:00:00Z",
        (
            BranchRecord(
                "merged-safe",
                "a" * 40,
                BranchClassification.MERGED,
                0,
                (42,),
            ),
        ),
    )


def test_cleanup_rechecks_open_pr_ownership_before_delete(tmp_path: Path) -> None:
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
            return ProcessResult(0, json.dumps([{"number": 99}]), "")
        raise AssertionError(args)

    assert delete_safe_branches(_audit(), tmp_path, runner=runner) == ()
    assert not any(call[:2] == ("git", "push") for call in calls)
    assert not any(call[:2] == ("git", "ls-remote") for call in calls)


def test_cleanup_skips_branch_when_remote_tip_moved_after_audit(tmp_path: Path) -> None:
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
                f"{'b' * 40}\trefs/heads/merged-safe\n",
                "",
            )
        raise AssertionError(args)

    assert delete_safe_branches(_audit(), tmp_path, runner=runner) == ()
    assert not any(call[:2] == ("git", "push") for call in calls)


def test_cleanup_skips_branch_deleted_by_another_actor(tmp_path: Path) -> None:
    def runner(
        arguments: tuple[str, ...] | list[str],
        cwd: Path,
        timeout: int = 300,
    ) -> ProcessResult:
        del cwd, timeout
        args = tuple(arguments)
        if args[:3] == ("gh", "pr", "list"):
            return ProcessResult(0, "[]", "")
        if args[:2] == ("git", "ls-remote"):
            return ProcessResult(0, "", "")
        raise AssertionError(args)

    assert delete_safe_branches(_audit(), tmp_path, runner=runner) == ()


def test_cleanup_deletion_is_bound_to_audited_sha(tmp_path: Path) -> None:
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

    assert delete_safe_branches(_audit(), tmp_path, runner=runner) == ("merged-safe",)
    assert (
        "git",
        "push",
        f"--force-with-lease=refs/heads/merged-safe:{'a' * 40}",
        "origin",
        ":refs/heads/merged-safe",
    ) in calls


def test_cleanup_lease_race_does_not_claim_branch_was_deleted(tmp_path: Path) -> None:
    def runner(
        arguments: tuple[str, ...] | list[str],
        cwd: Path,
        timeout: int = 300,
    ) -> ProcessResult:
        del cwd, timeout
        args = tuple(arguments)
        if args[:3] == ("gh", "pr", "list"):
            return ProcessResult(0, "[]", "")
        if args[:2] == ("git", "ls-remote"):
            return ProcessResult(
                0,
                f"{'a' * 40}\trefs/heads/merged-safe\n",
                "",
            )
        if args[:2] == ("git", "push"):
            return ProcessResult(1, "", "! [rejected] merged-safe (stale info)")
        raise AssertionError(args)

    assert delete_safe_branches(_audit(), tmp_path, runner=runner) == ()
