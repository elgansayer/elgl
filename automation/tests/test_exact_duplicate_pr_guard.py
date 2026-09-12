from __future__ import annotations

from openhands_factory.exact_duplicate_pr_guard import (
    PullRequestSnapshot,
    exact_duplicate_groups,
)


def _pr(
    number: int,
    tree: str,
    *,
    labels: frozenset[str] = frozenset(),
    head_ref: str | None = None,
    head_repository: str = "owner/repo",
    base_ref: str = "main",
    draft: bool = False,
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
    )


def test_exact_tree_duplicate_keeps_oldest_external_pr() -> None:
    groups = exact_duplicate_groups(
        (_pr(100, "same-tree"), _pr(103, "same-tree"), _pr(104, "other-tree")),
        repository="owner/repo",
        base_branch="main",
    )

    assert len(groups) == 1
    assert groups[0].canonical.number == 100
    assert [item.number for item in groups[0].duplicates] == [103]


def test_reviewed_duplicate_becomes_canonical_to_preserve_spent_review() -> None:
    groups = exact_duplicate_groups(
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
    groups = exact_duplicate_groups(
        (
            _pr(100, "same-tree"),
            _pr(101, "same-tree", draft=True),
            _pr(102, "same-tree", head_ref="factory/102-owned"),
            _pr(103, "same-tree", head_repository="fork/repo"),
            _pr(104, "same-tree", labels=frozenset({"factory-skip"})),
            _pr(105, "same-tree", base_ref="develop"),
        ),
        repository="owner/repo",
        base_branch="main",
    )

    assert groups == ()


def test_different_full_tree_is_never_treated_as_duplicate() -> None:
    groups = exact_duplicate_groups(
        (_pr(100, "tree-a"), _pr(101, "tree-b")),
        repository="owner/repo",
        base_branch="main",
    )

    assert groups == ()
