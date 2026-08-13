from pathlib import Path

import pytest

from openhands_factory.exceptions import RepositorySafetyError
from openhands_factory.repository_guard import (
    branch_name,
    ensure_push_target,
    find_conflict_markers,
)


def test_safe_branch_name() -> None:
    assert branch_name("issue-42", "Fix Payment Webhook!") == "factory/issue-42-fix-payment-webhook"


@pytest.mark.parametrize("branch", ["main", "master"])
def test_direct_push_is_forbidden(branch: str) -> None:
    with pytest.raises(RepositorySafetyError):
        ensure_push_target(branch, "main")


def test_arbitrary_non_factory_branch_is_forbidden_without_extra_allowed() -> None:
    with pytest.raises(RepositorySafetyError):
        ensure_push_target("bolt/optimize-quests", "main")


def test_extra_allowed_permits_the_assigned_pull_request_branch() -> None:
    ensure_push_target("bolt/optimize-quests", "main", extra_allowed="bolt/optimize-quests")


def test_extra_allowed_does_not_permit_a_different_branch() -> None:
    with pytest.raises(RepositorySafetyError):
        ensure_push_target("some/other-branch", "main", extra_allowed="bolt/optimize-quests")


@pytest.mark.parametrize("branch", ["main", "master"])
def test_protected_branch_is_forbidden_even_with_extra_allowed(branch: str) -> None:
    with pytest.raises(RepositorySafetyError):
        ensure_push_target(branch, "main", extra_allowed=branch)


def test_conflict_marker_detection(tmp_path: Path) -> None:
    clean = tmp_path / "clean.txt"
    clean.write_text("ordinary content\n", encoding="utf-8")
    conflict = tmp_path / "conflict.txt"
    conflict.write_text("<<<<<<< ours\n=======\n>>>>>>> theirs\n", encoding="utf-8")
    assert find_conflict_markers(tmp_path) == [conflict]
