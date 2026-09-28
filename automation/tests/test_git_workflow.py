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


def test_prepare_worktree_resolves_dependency_links_from_repository_alias(
    tmp_path: Path,
) -> None:
    real_repository = tmp_path / "source" / "repository"
    real_repository.mkdir(parents=True)
    (real_repository / "frontend/node_modules").mkdir(parents=True)
    repository = tmp_path / "configured-repository"
    repository.symlink_to(real_repository, target_is_directory=True)
    worktree = tmp_path / "worktrees" / "issue-12"
    runner = Runner([ProcessResult(0, "", ""), ProcessResult(1, "", ""), ProcessResult(0, "", "")])
    workflow = GitWorkflow(repository, "main", runner)

    workflow.prepare_worktree(worktree, "12", "Fix build")

    dependency_link = worktree / "frontend/node_modules"
    assert dependency_link.is_symlink()
    assert dependency_link.readlink() == (real_repository / "frontend/node_modules").resolve()


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


@pytest.mark.parametrize(("returncode", "expected"), [(0, True), (1, False)])
def test_contains_current_base_uses_latest_remote_base(
    tmp_path: Path,
    returncode: int,
    expected: bool,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    runner = Runner(
        [
            ProcessResult(0, "", ""),
            ProcessResult(returncode, "", ""),
        ]
    )
    workflow = GitWorkflow(repository, "main", runner)

    assert workflow.contains_current_base() is expected
    assert runner.calls == [
        ("git", "fetch", "origin", "main"),
        ("git", "merge-base", "--is-ancestor", "origin/main", "HEAD"),
    ]


def test_merge_base_for_repair_leaves_conflicts_for_the_repair_agent(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    runner = Runner(
        [
            ProcessResult(0, "", ""),
            ProcessResult(0, "", ""),
            ProcessResult(1, "", "CONFLICT (content): merge conflict"),
            ProcessResult(0, "src/conflicted.ts\n", ""),
        ]
    )
    workflow = GitWorkflow(repository, "main", runner)

    conflicted = workflow.merge_base_for_repair()

    assert conflicted is True
    assert runner.calls == [
        ("git", "diff", "--name-only", "--diff-filter=U"),
        ("git", "fetch", "origin", "main"),
        ("git", "merge", "--no-commit", "--no-ff", "origin/main"),
        ("git", "diff", "--name-only", "--diff-filter=U"),
    ]


def test_merge_base_for_repair_accepts_a_clean_uncommitted_merge(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    runner = Runner(
        [
            ProcessResult(0, "", ""),
            ProcessResult(0, "", ""),
            ProcessResult(0, "Automatic merge went well", ""),
        ]
    )
    workflow = GitWorkflow(repository, "main", runner)

    assert workflow.merge_base_for_repair() is False


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
    runner = Runner([ProcessResult(0, "", "")])
    workflow = GitWorkflow(repository, "main", runner)

    workflow.remove_worktree(tmp_path / "state" / "worktrees" / "issue-12", force=True)

    assert "--force" in runner.calls[0]


def test_remove_worktree_accepts_configured_root_outside_repository_parent(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "control" / "repository"
    repository.mkdir(parents=True)
    worktree_root = tmp_path / "mounted-volume" / "worktrees"
    runner = Runner([ProcessResult(0, "", "")])
    workflow = GitWorkflow(
        repository,
        "main",
        runner,
        worktree_root=worktree_root,
    )

    workflow.remove_worktree(worktree_root / "issue-12", force=True)

    assert runner.calls[0][-1] == str(worktree_root / "issue-12")


def test_remove_worktree_rejects_path_outside_configured_root(tmp_path: Path) -> None:
    repository = tmp_path / "control" / "repository"
    repository.mkdir(parents=True)
    workflow = GitWorkflow(
        repository,
        "main",
        Runner([]),
        worktree_root=tmp_path / "mounted-volume" / "worktrees",
    )

    with pytest.raises(RepositorySafetyError):
        workflow.remove_worktree(tmp_path / "mounted-volume" / "other" / "issue-12")


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


def test_committed_change_fingerprint_uses_resulting_blobs_and_deletion_markers(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    runner = Runner(
        [
            ProcessResult(0, "automation/changed.py\nautomation/deleted.py\n", ""),
            ProcessResult(0, "", ""),
            ProcessResult(0, "blob-changed\n", ""),
            ProcessResult(1, "", "missing path"),
        ]
    )
    workflow = GitWorkflow(repository, "main", runner)

    fingerprint = workflow.committed_change_fingerprint()

    assert len(fingerprint) == 64
    assert runner.calls[-2:] == [
        ("git", "rev-parse", "HEAD:automation/changed.py"),
        ("git", "rev-parse", "HEAD:automation/deleted.py"),
    ]


def test_sync_remote_branch_is_bound_to_the_inspected_factory_head(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    branch = "factory/42-existing"
    runner = Runner(
        [
            ProcessResult(0, f"old-head\trefs/heads/{branch}\n", ""),
            ProcessResult(0, "", ""),
        ]
    )
    workflow = GitWorkflow(repository, "main", runner)

    workflow.sync_remote_branch(branch, "old-head")

    assert runner.calls[-1] == (
        "git",
        "push",
        f"--force-with-lease=refs/heads/{branch}:old-head",
        "origin",
        f"HEAD:refs/heads/{branch}",
    )


def test_sync_remote_branch_refuses_a_head_that_moved_after_inspection(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    branch = "factory/42-existing"
    runner = Runner([ProcessResult(0, f"new-head\trefs/heads/{branch}\n", "")])
    workflow = GitWorkflow(repository, "main", runner)

    with pytest.raises(RepositorySafetyError, match="moved after"):
        workflow.sync_remote_branch(branch, "old-head")

    assert not any(call[:2] == ("git", "push") for call in runner.calls)


def test_sync_remote_branch_can_restore_a_deleted_factory_branch_with_empty_lease(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    branch = "factory/42-existing"
    runner = Runner([ProcessResult(0, "", ""), ProcessResult(0, "", "")])
    workflow = GitWorkflow(repository, "main", runner)

    workflow.sync_remote_branch(branch, "old-head")

    assert f"--force-with-lease=refs/heads/{branch}:" in runner.calls[-1]


def test_delete_remote_branch_requires_the_exact_duplicate_tip(tmp_path: Path) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    branch = "factory/42-replay"
    runner = Runner(
        [
            ProcessResult(0, f"replay-head\trefs/heads/{branch}\n", ""),
            ProcessResult(0, "", ""),
        ]
    )
    workflow = GitWorkflow(repository, "main", runner)

    workflow.delete_remote_branch(branch, "replay-head")

    assert runner.calls[-1] == (
        "git",
        "push",
        f"--force-with-lease=refs/heads/{branch}:replay-head",
        "origin",
        f":refs/heads/{branch}",
    )


def test_delete_remote_branch_is_idempotent_when_branch_is_already_absent(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "repository"
    repository.mkdir()
    runner = Runner([ProcessResult(0, "", "")])
    workflow = GitWorkflow(repository, "main", runner)

    workflow.delete_remote_branch("factory/42-replay", "replay-head")

    assert not any(call[:2] == ("git", "push") for call in runner.calls)


def test_archive_worktree_accepts_configured_roots_outside_repository_parent(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "control" / "repository"
    repository.mkdir(parents=True)
    worktree_root = tmp_path / "mounted-volume" / "worktrees"
    worktree = worktree_root / "issue-12"
    worktree.mkdir(parents=True)
    (worktree / "changed.ts").write_text("uncommitted", encoding="utf-8")
    recovery_root = tmp_path / "mounted-volume" / "recovery"
    recovery = recovery_root / "issue-12-archive"
    workflow = GitWorkflow(
        repository,
        "main",
        Runner([]),
        worktree_root=worktree_root,
        recovery_root=recovery_root,
    )

    workflow.archive_worktree(worktree, recovery)

    assert (recovery / "changed.ts").read_text(encoding="utf-8") == "uncommitted"


def test_archive_worktree_rejects_path_outside_configured_recovery_root(
    tmp_path: Path,
) -> None:
    repository = tmp_path / "control" / "repository"
    repository.mkdir(parents=True)
    worktree_root = tmp_path / "mounted-volume" / "worktrees"
    worktree = worktree_root / "issue-12"
    worktree.mkdir(parents=True)
    workflow = GitWorkflow(
        repository,
        "main",
        Runner([]),
        worktree_root=worktree_root,
        recovery_root=tmp_path / "mounted-volume" / "recovery",
    )

    with pytest.raises(RepositorySafetyError, match="recovery root"):
        workflow.archive_worktree(
            worktree,
            tmp_path / "mounted-volume" / "other" / "issue-12-archive",
        )


def test_archive_worktree_excludes_regenerable_build_artifacts(tmp_path: Path) -> None:
    # None of these are ever hand-edited - all regenerable via npm/uv install
    # or a build - and copying them in full turned a ~63 MB archive into a
    # 2+ GB one, exhausting the disk-space reserve that gates scheduling.
    repository = tmp_path / "state" / "repository"
    repository.mkdir(parents=True)
    worktree = tmp_path / "state" / "worktrees" / "issue-12"
    (worktree / "frontend" / "node_modules" / "some-pkg").mkdir(parents=True)
    (worktree / "frontend" / "node_modules" / "some-pkg" / "index.js").write_text(
        "module.exports = {}", encoding="utf-8"
    )
    (worktree / "frontend" / "dist").mkdir(parents=True)
    (worktree / "frontend" / "dist" / "bundle.js").write_text("built output", encoding="utf-8")
    (worktree / "frontend" / "src").mkdir(parents=True)
    (worktree / "frontend" / "src" / "app.ts").write_text("uncommitted source", encoding="utf-8")
    (worktree / "automation" / "__pycache__").mkdir(parents=True)
    (worktree / "automation" / "__pycache__" / "mod.pyc").write_text("bytecode", encoding="utf-8")
    recovery = tmp_path / "state" / "recovery" / "issue-12-archive"
    workflow = GitWorkflow(repository, "main", Runner([]))

    workflow.archive_worktree(worktree, recovery)

    assert not (recovery / "frontend" / "node_modules").exists()
    assert not (recovery / "frontend" / "dist").exists()
    assert not (recovery / "automation" / "__pycache__").exists()
    assert (recovery / "frontend" / "src" / "app.ts").read_text(
        encoding="utf-8"
    ) == "uncommitted source"
