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


def test_conflict_marker_detection(tmp_path: Path) -> None:
    clean = tmp_path / "clean.txt"
    clean.write_text("ordinary content\n", encoding="utf-8")
    conflict = tmp_path / "conflict.txt"
    conflict.write_text("<<<<<<< ours\n=======\n>>>>>>> theirs\n", encoding="utf-8")
    assert find_conflict_markers(tmp_path) == [conflict]
