from __future__ import annotations

from collections.abc import Sequence

import pytest

from openhands_factory import exact_duplicate_pr_guard as guard
from openhands_factory.exact_duplicate_pr_guard import PullRequestSnapshot


def _pr(
    number: int,
    tree: str,
    *,
    labels: frozenset[str] = frozenset(),
    head_ref: str | None = None,
    head_repository: str = "owner/repo",
    base_ref: str = "main",
    draft: bool = False,
    labels_complete: bool = True,
) -> PullRequestSnapshot:
    return PullRequestSnapshot(
        number=number,
        state="OPEN",
        base_ref=base_ref,
        head_ref=head_ref or f"provider/pr-{number}",
        head_sha=f"head-{number}",
        tree_oid=tree,
        head_repository=head_repository,
        is_draft=draft,
        labels=labels,
        labels_complete=labels_complete,
    )


def test_exact_tree_duplicate_keeps_oldest_external_pr() -> None:
    groups = guard.exact_duplicate_groups(
        (_pr(100, "same-tree"), _pr(103, "same-tree"), _pr(104, "other-tree")),
        repository="owner/repo",
        base_branch="main",
    )

    assert len(groups) == 1
    assert groups[0].canonical.number == 100
    assert [item.number for item in groups[0].duplicates] == [103]


def test_reviewed_duplicate_becomes_canonical_to_preserve_spent_review() -> None:
    groups = guard.exact_duplicate_groups(
        (
            _pr(100, "same-tree"),
            _pr(103, "same-tree", labels=frozenset({"factory-reviewed"})),
        ),
        repository="owner/repo",
        base_branch="main",
    )

    assert len(groups) == 1
    assert groups[0].canonical.number == 103
    assert [item.number for item in groups[0].duplicates] == [100]


def test_guard_ignores_prs_factory_would_not_review() -> None:
    groups = guard.exact_duplicate_groups(
        (
            _pr(100, "same-tree"),
            _pr(101, "same-tree", draft=True),
            _pr(102, "same-tree", head_ref="factory/102-owned"),
            _pr(103, "same-tree", head_repository="fork/repo"),
            _pr(104, "same-tree", labels=frozenset({"factory-skip"})),
            _pr(105, "same-tree", base_ref="develop"),
            _pr(106, "same-tree", labels_complete=False),
        ),
        repository="owner/repo",
        base_branch="main",
    )

    assert groups == ()


def test_different_full_tree_is_never_treated_as_duplicate() -> None:
    groups = guard.exact_duplicate_groups(
        (_pr(100, "tree-a"), _pr(101, "tree-b")),
        repository="owner/repo",
        base_branch="main",
    )

    assert groups == ()


def test_snapshot_marks_a_truncated_label_connection_incomplete() -> None:
    snapshot = guard._snapshot(
        {
            "number": 100,
            "baseRefName": "main",
            "headRefName": "external/change",
            "headRefOid": "head-sha",
            "headRepository": {"nameWithOwner": "owner/repo"},
            "labels": {"pageInfo": {"hasNextPage": True}, "nodes": []},
            "commits": {"nodes": [{"commit": {"tree": {"oid": "tree-oid"}}}]},
        }
    )

    assert not snapshot.labels_complete
    assert not snapshot.is_factory_review_candidate("owner/repo", "main")


def test_revalidation_fails_open_when_a_duplicate_head_changes(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    canonical = _pr(100, "same-tree")
    duplicate = _pr(101, "same-tree")
    fresh = {100: canonical, 101: _pr(101, "changed-tree")}
    monkeypatch.setattr(guard, "load_pull_request", lambda _repository, number: fresh[number])

    assert not guard._still_duplicate("owner/repo", "main", canonical, duplicate)


def test_close_revalidates_then_closes_and_marks_the_duplicate(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    canonical = _pr(100, "same-tree")
    duplicate = _pr(101, "same-tree")
    commands: list[tuple[str, ...]] = []
    monkeypatch.setattr(guard, "_still_duplicate", lambda *_arguments: True)
    monkeypatch.setattr(
        guard,
        "_run_gh",
        lambda arguments: commands.append(tuple(arguments)) or "",
    )

    assert guard.close_exact_duplicate("owner/repo", "main", canonical, duplicate)
    assert commands[0][:3] == ("pr", "close", "101")
    assert commands[1] == (
        "issue",
        "edit",
        "101",
        "--repo",
        "owner/repo",
        "--add-label",
        "factory-skip",
    )


def test_close_does_not_mutate_after_failed_revalidation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    canonical = _pr(100, "same-tree")
    duplicate = _pr(101, "same-tree")
    monkeypatch.setattr(guard, "_still_duplicate", lambda *_arguments: False)

    def unexpected_command(_arguments: Sequence[str]) -> str:
        raise AssertionError("GitHub mutation must not run after a failed revalidation")

    monkeypatch.setattr(guard, "_run_gh", unexpected_command)

    assert not guard.close_exact_duplicate("owner/repo", "main", canonical, duplicate)
