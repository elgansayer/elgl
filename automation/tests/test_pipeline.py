from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import ConversationResult
from openhands_factory.exceptions import FactoryError
from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.github import PullRequestStatus
from openhands_factory.models import JobState, Task
from openhands_factory.pipeline import FactoryPipeline


class GitHub:
    def __init__(self) -> None:
        self.labels: list[tuple[int, tuple[str, ...]]] = []
        self.statuses: list[PullRequestStatus] = []
        self.auto_merged: list[int] = []
        self.closed: list[int] = []
        self.reviewed: list[str] = []
        self.comments: list[tuple[int, str]] = []
        self.tasks = [Task("42", "Fix build", "Broken build", "github-issue", 0)]

    def ensure_factory_labels(self) -> None:
        return None

    def collect_open_issues(self, limit: int = 100) -> list[Task]:
        return self.tasks

    def add_issue_labels(self, issue: int, labels: tuple[str, ...]) -> None:
        self.labels.append((issue, labels))

    def add_comment(self, number: int, body: str) -> None:
        self.comments.append((number, body))

    def create_pull_request(self, branch: str, title: str, body: str) -> int:
        return 99

    def mark_ready(self, pull_request: int) -> None:
        return None

    def request_review(self, pull_request: int) -> None:
        return None

    def publish_review_status(self, head_sha: str, *, approved: bool, detail: str) -> None:
        assert approved
        self.reviewed.append(head_sha)

    def pull_request_status(self, pull_request: int) -> PullRequestStatus:
        return self.statuses.pop(0)

    def enable_auto_merge(self, pull_request: int) -> None:
        self.auto_merged.append(pull_request)

    def close_issue(self, issue: int) -> None:
        self.closed.append(issue)


class Conversations:
    def run(self, task: Task, workspace: Path, prompt: str) -> ConversationResult:
        if "review instructions" in prompt:
            import json

            (workspace / ".factory-review.json").write_text(
                json.dumps(
                    {
                        "approved": True,
                        "reviewed_sha": "abcdef1234567",
                        "summary": "OK",
                        "acceptance_criteria": [],
                        "blocking_findings": [],
                    }
                ),
                encoding="utf-8",
            )
        return ConversationResult(task.identifier, 1, True)


class SecurityReviewConversations:
    def __init__(self) -> None:
        self.prompts: list[str] = []

    def run(self, task: Task, workspace: Path, prompt: str) -> ConversationResult:
        self.prompts.append(prompt)
        return ConversationResult(task.identifier, 1, True)


class FailingConversations:
    def run(self, task: Task, workspace: Path, prompt: str) -> ConversationResult:
        raise FactoryError("Conversation exceeded the maximum task duration")


def config(tmp_path: Path) -> FactoryConfig:
    repository = tmp_path / "repository"
    repository.mkdir()
    prompt_dir = repository / "automation/prompts"
    prompt_dir.mkdir(parents=True)
    for name in ("task", "review", "repair", "security"):
        (prompt_dir / f"{name}.md").write_text(f"{name} instructions", encoding="utf-8")
    return FactoryConfig.from_environment(
        {
            "FACTORY_REPOSITORY": str(repository),
            "FACTORY_STATE_DIR": str(tmp_path / "state"),
            "FACTORY_LOG_DIR": str(tmp_path / "log"),
            "FACTORY_PROFILE_STORE": str(tmp_path / "profiles"),
            "FACTORY_WORKTREE_DIR": str(tmp_path / "worktrees"),
            "FACTORY_RECOVERY_DIR": str(tmp_path / "recovery"),
            "OPENCODE_GO_API_KEY": "key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "token",
            "GEMINI_ENABLED": "false",
        }
    )


def test_refresh_creates_durable_discovered_job(tmp_path: Path) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]

    jobs = pipeline.refresh()
    restored = pipeline.jobs.load()

    assert jobs["42"].state is JobState.DISCOVERED
    assert restored["42"].task.title == "Fix build"


def test_refresh_releases_closed_issue_before_pull_request(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    job = pipeline.refresh()["42"]
    job.state = JobState.IMPLEMENTING
    pipeline.jobs.save({"42": job})
    worktree = pipeline.config.worktree_dir / "issue-42"
    worktree.mkdir(parents=True)
    removed: list[Path] = []
    monkeypatch.setattr(
        GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: removed.append(path)
    )
    github.tasks = []

    refreshed = pipeline.refresh()

    assert refreshed["42"].state is JobState.DONE
    assert refreshed["42"].last_error == "Issue closed before pull request creation"
    assert removed == [worktree]


def test_refresh_does_not_remove_a_closed_issue_while_its_worker_is_active(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    job = pipeline.refresh()["42"]
    job.state = JobState.IMPLEMENTING
    pipeline.jobs.save({"42": job})
    worktree = pipeline.config.worktree_dir / "issue-42"
    worktree.mkdir(parents=True)
    removed: list[Path] = []
    monkeypatch.setattr(
        GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: removed.append(path)
    )
    github.tasks = []

    refreshed = pipeline.refresh({"42"})

    assert refreshed["42"].state is JobState.IMPLEMENTING
    assert removed == []


def test_refresh_preserves_a_quarantined_issue_until_human_recovery(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    job = pipeline.refresh()["42"]
    job.state = JobState.QUARANTINED
    pipeline.jobs.save({"42": job})
    worktree = pipeline.config.worktree_dir / "issue-42"
    worktree.mkdir(parents=True)
    monkeypatch.setattr(GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: None)
    github.tasks = []

    refreshed = pipeline.refresh()

    assert refreshed["42"].state is JobState.QUARANTINED
    assert refreshed["42"].last_error is None


def test_refresh_releases_a_closed_issue_during_security_review(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    job = pipeline.refresh()["42"]
    job.state = JobState.SECURITY_REVIEW
    pipeline.jobs.save({"42": job})
    worktree = pipeline.config.worktree_dir / "issue-42"
    worktree.mkdir(parents=True)
    removed: list[Path] = []
    monkeypatch.setattr(
        GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: removed.append(path)
    )
    github.tasks = []

    refreshed = pipeline.refresh()

    assert refreshed["42"].state is JobState.DONE
    assert refreshed["42"].last_error == "Issue closed before pull request creation"
    assert removed == [worktree]


def test_complete_pipeline_reaches_done_only_after_merge(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory_config = config(tmp_path)
    github = GitHub()
    github.statuses = [
        PullRequestStatus(
            99, "OPEN", False, "MERGEABLE", "", "abcdef1234567", True, False
        ),
        PullRequestStatus(
            99, "MERGED", False, "UNKNOWN", "", "abcdef1234567", True, False
        ),
    ]

    def prepare(workflow: GitWorkflow, worktree: Path, task_id: str, title: str) -> str:
        worktree.mkdir(parents=True)
        (worktree / "AGENTS.md").write_text("Instructions", encoding="utf-8")
        return "factory/42-fix-build"

    monkeypatch.setattr(GitWorkflow, "prepare_worktree", prepare)
    has_changes = iter((True, False))
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: next(has_changes))
    monkeypatch.setattr(GitWorkflow, "changed_paths", lambda workflow: {Path("README.md")})
    monkeypatch.setattr(GitWorkflow, "stage_all", lambda workflow: None)
    monkeypatch.setattr(GitWorkflow, "commit", lambda workflow, message: None)
    monkeypatch.setattr(GitWorkflow, "push", lambda workflow, branch: None)
    monkeypatch.setattr(GitWorkflow, "head_sha", lambda workflow: "abcdef1234567")
    monkeypatch.setattr(GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: None)
    monkeypatch.setattr("openhands_factory.pipeline.run_verification", lambda commands: None)
    monkeypatch.setattr(
        "openhands_factory.pipeline.check_quality_gate", lambda workflow, base_branch: []
    )
    pipeline = FactoryPipeline(
        factory_config,
        github=github,  # type: ignore[arg-type]
        conversations=Conversations(),  # type: ignore[arg-type]
    )

    states = []
    for _ in range(9):
        job = pipeline.run_once()
        assert job is not None
        states.append(job.state)

    assert states == [
        JobState.IMPLEMENTING,
        JobState.SECURITY_REVIEW,
        JobState.VERIFYING,
        JobState.PR_DRAFT,
        JobState.REVIEWING,
        JobState.CI_PENDING,
        JobState.MERGE_QUEUED,
        JobState.MERGED,
        JobState.DONE,
    ]
    assert github.auto_merged == [99]
    assert github.closed == [42]
    assert github.reviewed == ["abcdef1234567"]
    assert [number for number, _ in github.comments].count(42) == 1
    assert [number for number, _ in github.comments].count(99) == 3


def test_successful_transition_resets_previous_failures(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    job = pipeline.refresh()["42"]
    job.attempts = 2
    job.last_error = "temporary failure"
    pipeline.jobs.save({"42": job})
    monkeypatch.setattr(
        GitWorkflow,
        "prepare_worktree",
        lambda workflow, worktree, task_id, title: "factory/42-fix-build",
    )

    advanced = pipeline.run_once()

    assert advanced is not None
    assert advanced.state is JobState.IMPLEMENTING
    assert advanced.attempts == 0
    assert advanced.last_error is None


def test_discovery_retry_releases_lease_and_retires_stale_worktree(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    job = pipeline.refresh()["42"]
    worktree = pipeline.config.worktree_dir / "issue-42"
    worktree.mkdir(parents=True)
    removed: list[Path] = []
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: False)
    monkeypatch.setattr(
        GitWorkflow,
        "remove_worktree",
        lambda workflow, path, **kwargs: removed.append(path),
    )
    monkeypatch.setattr(
        GitWorkflow,
        "prepare_worktree",
        lambda workflow, path, task_id, title: "factory/42-fix-build",
    )

    advanced = pipeline.run_job(job.task.identifier)

    assert advanced is not None
    assert advanced.state is JobState.IMPLEMENTING
    assert removed == [worktree]
    assert pipeline.tasks.leases()["42"].owner == "factory"


def test_run_job_advances_only_the_selected_durable_job(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    github.tasks.append(Task("43", "Fix lint", "Broken lint", "github-issue", 0))
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    pipeline.refresh()
    monkeypatch.setattr(
        GitWorkflow,
        "prepare_worktree",
        lambda workflow, worktree, task_id, title: f"factory/{task_id}",
    )

    advanced = pipeline.run_job("43")
    restored = pipeline.jobs.load()

    assert advanced is not None
    assert restored["43"].state is JobState.IMPLEMENTING
    assert restored["42"].state is JobState.DISCOVERED


def test_conversation_timeout_retries_durably_then_quarantines(tmp_path: Path) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(
        config(tmp_path),
        github=github,  # type: ignore[arg-type]
        conversations=FailingConversations(),  # type: ignore[arg-type]
    )
    job = pipeline.refresh()["42"]
    job.state = JobState.IMPLEMENTING
    pipeline.jobs.save({"42": job})

    first = pipeline.run_job("42")
    second = pipeline.run_job("42")
    third = pipeline.run_job("42")

    assert first is not None and first.attempts == 1
    assert second is not None and second.attempts == 2
    assert third is not None and third.state is JobState.QUARANTINED
    restored = pipeline.jobs.load()["42"]
    assert restored.attempts == 3
    assert restored.state is JobState.QUARANTINED
    assert (42, ("factory-quarantined", "needs-human")) in github.labels


def test_no_changes_after_repeated_attempts_closes_issue_as_already_done(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(
        config(tmp_path),
        github=github,  # type: ignore[arg-type]
        conversations=Conversations(),  # type: ignore[arg-type]
    )
    job = pipeline.refresh()["42"]
    job.state = JobState.IMPLEMENTING
    pipeline.jobs.save({"42": job})
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: False)
    monkeypatch.setattr(GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: None)

    result = None
    for _ in range(3):
        result = pipeline.run_job("42")

    assert result is not None and result.state is JobState.DONE
    assert github.closed == [42]
    assert not any(labels == ("factory-quarantined", "needs-human") for _, labels in github.labels)
    assert any("already satisfied" in body for _, body in github.comments)


def test_refresh_does_not_reclassify_quarantined_jobs_as_closed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(
        config(tmp_path),
        github=github,  # type: ignore[arg-type]
        conversations=FailingConversations(),  # type: ignore[arg-type]
    )
    job = pipeline.refresh()["42"]
    job.state = JobState.IMPLEMENTING
    pipeline.jobs.save({"42": job})
    monkeypatch.setattr("openhands_factory.pipeline.AlertService.send", lambda *_args: True)

    for _ in range(3):
        pipeline.run_job("42")

    github.tasks = []
    refreshed = pipeline.refresh()

    assert refreshed["42"].state is JobState.QUARANTINED
    assert refreshed["42"].last_error == "Conversation exceeded the maximum task duration"


def test_security_review_runs_between_implementation_and_verification(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    conversations = SecurityReviewConversations()
    pipeline = FactoryPipeline(
        config(tmp_path),
        github=github,  # type: ignore[arg-type]
        conversations=conversations,  # type: ignore[arg-type]
    )
    job = pipeline.refresh()["42"]
    job.state = JobState.IMPLEMENTING
    pipeline.jobs.save({"42": job})
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: True)
    prompt_dir = pipeline.config.repository / "automation/prompts"
    (prompt_dir / "security.md").write_text(
        "Security Review Workflow instructions", encoding="utf-8"
    )

    first = pipeline.run_job("42")
    second = pipeline.run_job("42")

    assert first is not None and first.state is JobState.SECURITY_REVIEW
    assert second is not None and second.state is JobState.VERIFYING
    assert len(conversations.prompts) == 2
    assert "Security Review Workflow" in conversations.prompts[1]


def test_security_review_conversation_failure_retries_then_quarantines(
    tmp_path: Path,
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(
        config(tmp_path),
        github=github,  # type: ignore[arg-type]
        conversations=FailingConversations(),  # type: ignore[arg-type]
    )
    job = pipeline.refresh()["42"]
    job.state = JobState.SECURITY_REVIEW
    pipeline.jobs.save({"42": job})

    first = pipeline.run_job("42")
    second = pipeline.run_job("42")
    third = pipeline.run_job("42")

    assert first is not None and first.attempts == 1
    assert second is not None and second.attempts == 2
    assert third is not None and third.state is JobState.QUARANTINED
