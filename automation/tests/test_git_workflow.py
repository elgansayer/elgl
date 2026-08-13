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


def test_prepare_pull_request_worktree_checks_out_the_existing_branch(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    worktree = tmp_path / "worktrees" / "pr-99"
    runner = Runner(
        [ProcessResult(0, "", ""), ProcessResult(1, "", ""), ProcessResult(0, "", "")]
    )
    workflow = GitWorkflow(repository, "main", runner)

    workflow.prepare_pull_request_worktree(worktree, "bolt/optimize-quests")

    assert runner.calls[0] == ("git", "fetch", "origin", "bolt/optimize-quests")
    assert runner.calls[2] == (
        "git",
        "worktree",
        "add",
        "-b",
        "bolt/optimize-quests",
        str(worktree),
        "origin/bolt/optimize-quests",
    )


def test_push_allows_the_external_branch_a_pull_request_review_job_is_assigned(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    runner = Runner([ProcessResult(0, "", "")])
    workflow = GitWorkflow(repository, "main", runner, external_branch="bolt/optimize-quests")

    workflow.push("bolt/optimize-quests")

    assert runner.calls[0][:2] == ("git", "push")


def test_push_still_rejects_a_branch_outside_the_assigned_external_branch(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    workflow = GitWorkflow(
        repository, "main", Runner([]), external_branch="bolt/optimize-quests"
    )

    with pytest.raises(RepositorySafetyError):
        workflow.push("some/other-branch")


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
