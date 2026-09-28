import subprocess
from collections.abc import Mapping, Sequence
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
    (repository / "admin-portal/node_modules").mkdir(parents=True)
    worktree = tmp_path / "worktrees" / "issue-12"
    runner = Runner([ProcessResult(0, "", ""), ProcessResult(1, "", ""), ProcessResult(0, "", "")])
    workflow = GitWorkflow(repository, "main", runner)

    branch = workflow.prepare_worktree(worktree, "12", "Fix build")

    assert branch == "factory/12-fix-build"
    assert runner.calls[0] == ("git", "fetch", "origin", "main")
    assert runner.calls[2][-1] == "origin/main"
    assert (worktree / "frontend/node_modules").is_symlink()
    assert (worktree / "admin-portal/node_modules").is_symlink()


def test_prepare_worktree_retries_a_transient_lock_collision(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Every worktree shares one git dir. With more than one worker running
    concurrently, `git fetch`/`worktree add`/`push` against that shared git dir
    routinely collide on git's own short-lived advisory locks - a real, previously
    unfixed failure mode (`could not lock config file .git/config: File exists`).
    A lock collision means the operation was never attempted, so retrying is safe.
    """
    repository = tmp_path / "repository"
    repository.mkdir()
    worktree = tmp_path / "worktrees" / "issue-12"
    runner = Runner(
        [
            ProcessResult(128, "", "fatal: could not lock config file .git/config: File exists"),
            ProcessResult(0, "", ""),
            ProcessResult(1, "", ""),  # show-ref: no stale local branch to reclaim
            ProcessResult(0, "", ""),  # worktree add
        ]
    )
    monkeypatch.setattr("openhands_factory.git_workflow.time.sleep", lambda _seconds: None)
    workflow = GitWorkflow(repository, "main", runner)

    branch = workflow.prepare_worktree(worktree, "12", "Fix build")

    assert branch == "factory/12-fix-build"
    assert len(runner.calls) == 4
    assert runner.calls[0] == runner.calls[1] == ("git", "fetch", "origin", "main")


def test_prepare_worktree_does_not_retry_a_real_fetch_failure(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    worktree = tmp_path / "worktrees" / "issue-12"
    runner = Runner([ProcessResult(1, "", "fatal: could not resolve host")])
    workflow = GitWorkflow(repository, "main", runner)

    with pytest.raises(RepositorySafetyError, match="could not resolve host"):
        workflow.prepare_worktree(worktree, "12", "Fix build")

    assert len(runner.calls) == 1


def test_changed_paths_includes_untracked_files(tmp_path: Path) -> None:
    """has_changes() (git status) counts a new untracked file as a change, so
    changed_paths() (git diff, which never reports untracked files on its own)
    must too - otherwise a task whose only output is a new file passes the
    implementing-phase gate but then fails verification with a confusing
    "no changed paths" error instead of being judged on the file it added.
    """
    repository = tmp_path / "repository"
    repository.mkdir()
    runner = Runner(
        [
            ProcessResult(0, "src/existing.py\n", ""),
            ProcessResult(0, "src/new_file.py\n", ""),
        ]
    )
    workflow = GitWorkflow(repository, "main", runner)

    paths = workflow.changed_paths()

    assert paths == {Path("src/existing.py"), Path("src/new_file.py")}
    assert runner.calls[0] == ("git", "diff", "--name-only", "origin/main")
    assert runner.calls[1] == ("git", "ls-files", "--others", "--exclude-standard")


def test_change_fingerprint_detects_additional_edits_in_an_already_dirty_tree(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()

    def git(*arguments: str) -> None:
        subprocess.run(
            ("git", *arguments),
            cwd=repository,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    git("init", "--initial-branch=main")
    git("config", "user.name", "Factory Test")
    git("config", "user.email", "factory-test@example.invalid")
    tracked = repository / "tracked.txt"
    tracked.write_text("base\n", encoding="utf-8")
    git("add", "tracked.txt")
    git("commit", "-m", "test: seed repository")

    workflow = GitWorkflow(repository, "main")
    tracked.write_text("first repair target\n", encoding="utf-8")
    before = workflow.change_fingerprint()
    tracked.write_text("second repair target\n", encoding="utf-8")
    after_tracked_edit = workflow.change_fingerprint()
    untracked = repository / "new-file.txt"
    untracked.write_text("one\n", encoding="utf-8")
    after_untracked_add = workflow.change_fingerprint()
    untracked.write_text("two\n", encoding="utf-8")
    after_untracked_edit = workflow.change_fingerprint()

    assert len({before, after_tracked_edit, after_untracked_add, after_untracked_edit}) == 4


def test_change_fingerprint_tolerates_a_symlinked_node_modules(tmp_path: Path) -> None:
    """prepare_worktree symlinks node_modules in from a shared cache (see the
    node_modules symlink assertions above). A trailing-slash gitignore pattern
    does not match a symlink pointing at a directory, only a real directory, so
    the symlink itself shows up as a single untracked path -- and `git
    hash-object` cannot hash it (`fatal: Unable to hash (null)`), previously
    raising RepositorySafetyError and quarantining the task over something that
    was never a real safety problem. This is fixed at the source too (see the
    unslashed `node_modules` line added to .gitignore), but change_fingerprint
    must not hard-fail on an unhashable path regardless of why one occurs.
    """
    repository = tmp_path / "repository"
    repository.mkdir()

    def git(*arguments: str) -> None:
        subprocess.run(
            ("git", *arguments),
            cwd=repository,
            check=True,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )

    git("init", "--initial-branch=main")
    git("config", "user.name", "Factory Test")
    git("config", "user.email", "factory-test@example.invalid")
    (repository / "tracked.txt").write_text("base\n", encoding="utf-8")
    git("add", "tracked.txt")
    git("commit", "-m", "test: seed repository")
    # Deliberately do not gitignore node_modules, reproducing the exact gap:
    # a trailing-slash-only pattern would still miss a symlink.
    shared_cache = tmp_path / "shared-node-modules-cache"
    shared_cache.mkdir()
    (repository / "node_modules").symlink_to(shared_cache, target_is_directory=True)

    workflow = GitWorkflow(repository, "main")

    fingerprint = workflow.change_fingerprint()

    assert isinstance(fingerprint, str) and fingerprint


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


def test_prepare_claimed_worktree_reuses_canonical_branch_and_initial_base(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    worktree = tmp_path / "worktrees" / "issue-12"
    runner = Runner(
        [
            ProcessResult(0, "", ""),
            ProcessResult(1, "", ""),
            ProcessResult(0, "", ""),
        ]
    )
    workflow = GitWorkflow(repository, "main", runner)

    workflow.prepare_claimed_worktree(
        worktree,
        "factory/12-canonical",
        "initial-base-sha",
    )

    assert runner.calls[0] == ("git", "fetch", "origin", "main")
    assert runner.calls[2] == (
        "git",
        "worktree",
        "add",
        "-b",
        "factory/12-canonical",
        str(worktree),
        "initial-base-sha",
    )


def test_prepare_pull_request_worktree_checks_out_the_existing_branch(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    worktree = tmp_path / "worktrees" / "pr-99"
    runner = Runner([ProcessResult(0, "", ""), ProcessResult(1, "", ""), ProcessResult(0, "", "")])
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


def test_git_token_is_scoped_to_git_process_environment(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    captured: dict[str, object] = {}

    def run(
        arguments: Sequence[str],
        cwd: Path,
        timeout: int = 300,
        *,
        environment: Mapping[str, str] | None = None,
    ) -> ProcessResult:
        del cwd, timeout
        captured["arguments"] = tuple(arguments)
        captured["environment"] = dict(environment or {})
        return ProcessResult(0, "", "")

    monkeypatch.setenv("DATABASE_URL", "must-not-leak")
    monkeypatch.setattr("openhands_factory.git_workflow.run_process", run)
    workflow = GitWorkflow(repository, "main", github_token="repository-token")

    workflow.push("factory/42-token-scope")

    arguments = captured["arguments"]
    environment = captured["environment"]
    assert isinstance(arguments, tuple)
    assert isinstance(environment, dict)
    assert "repository-token" not in arguments
    assert environment["GH_TOKEN"] == "repository-token"
    assert "DATABASE_URL" not in environment


def test_push_still_rejects_a_branch_outside_the_assigned_external_branch(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    workflow = GitWorkflow(repository, "main", Runner([]), external_branch="bolt/optimize-quests")

    with pytest.raises(RepositorySafetyError):
        workflow.push("some/other-branch")


@pytest.mark.parametrize(
    "branch",
    ("--upload-pack=agent", "feature/../main", "feature/.hidden", "feature/main.lock"),
)
def test_external_pull_request_branch_must_be_a_safe_git_ref(
    tmp_path: Path,
    branch: str,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    workflow = GitWorkflow(repository, "main", Runner([]), external_branch=branch)

    with pytest.raises(RepositorySafetyError, match="Unsafe Git branch name"):
        workflow.prepare_pull_request_worktree(tmp_path / "worktree", branch)

    with pytest.raises(RepositorySafetyError, match="Unsafe Git branch name"):
        workflow.push(branch)


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
