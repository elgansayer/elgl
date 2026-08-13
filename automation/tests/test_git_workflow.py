from collections.abc import Sequence
from pathlib import Path

import pytest

from openhands_factory.exceptions import RepositorySafetyError
from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.repository_guard import ProcessResult


class Runner:
    def __init__(self, results: list[ProcessResult]) -> None:
        self.results = results
        self.calls: list[tuple[str, ...]] = []

    def __call__(self, arguments: Sequence[str], cwd: Path, timeout: int = 300) -> ProcessResult:
        self.calls.append(tuple(arguments))
        return self.results.pop(0)


def test_prepare_worktree_fetches_and_branches_from_origin(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    (repository / "frontend/node_modules").mkdir(parents=True)
    worktree = tmp_path / "worktrees" / "issue-12"
    runner = Runner(
        [ProcessResult(0, "", ""), ProcessResult(1, "", ""), ProcessResult(0, "", "")]
    )
    workflow = GitWorkflow(repository, "main", runner)

    branch = workflow.prepare_worktree(worktree, "12", "Fix build")

    assert branch == "factory/12-fix-build"
    assert runner.calls[0] == ("git", "fetch", "origin", "main")
    assert runner.calls[2][-1] == "origin/main"
    assert (worktree / "frontend/node_modules").is_symlink()


def test_prepare_worktree_reclaims_stale_local_branch(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    worktree = tmp_path / "worktrees" / "issue-12"
    runner = Runner(
        [
            ProcessResult(0, "", ""),
            ProcessResult(0, "", ""),
            ProcessResult(0, "", ""),
            ProcessResult(0, "", ""),
        ]
    )
    workflow = GitWorkflow(repository, "main", runner)

    branch = workflow.prepare_worktree(worktree, "12", "Fix build")

    assert branch == "factory/12-fix-build"
    assert ("git", "branch", "-D", branch) in runner.calls


def test_remove_worktree_rejects_path_outside_factory_root(tmp_path: Path) -> None:
    repository = tmp_path / "state" / "repository"
    repository.mkdir(parents=True)
    workflow = GitWorkflow(repository, "main", Runner([]))

    with pytest.raises(RepositorySafetyError):
        workflow.remove_worktree(tmp_path / "outside")


def test_remove_worktree_can_force_retirement_after_archive(tmp_path: Path) -> None:
    repository = tmp_path / "state" / "repository"
    repository.mkdir(parents=True)
    workflow = GitWorkflow(repository, "main", Runner([ProcessResult(0, "", "")]))

    workflow.remove_worktree(tmp_path / "state" / "worktrees" / "issue-12", force=True)

    assert "--force" in workflow.runner.calls[0]


def test_archive_worktree_preserves_dirty_files(tmp_path: Path) -> None:
    repository = tmp_path / "state" / "repository"
    repository.mkdir(parents=True)
    worktree = tmp_path / "state" / "worktrees" / "issue-12"
    worktree.mkdir(parents=True)
    (worktree / "changed.ts").write_text("uncommitted", encoding="utf-8")
    recovery = tmp_path / "state" / "recovery" / "issue-12-archive"
    workflow = GitWorkflow(repository, "main", Runner([]))

    archived = workflow.archive_worktree(worktree, recovery)

    assert archived == recovery
    assert (recovery / "changed.ts").read_text(encoding="utf-8") == "uncommitted"
    assert (recovery / "RECOVERY.txt").is_file()
