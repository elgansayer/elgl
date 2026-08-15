from datetime import UTC, datetime
from pathlib import Path

import pytest

from openhands_factory.architect_report import ArchitectProposal
from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import ConversationResult
from openhands_factory.exceptions import FactoryError
from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.github import PullRequestStatus
from openhands_factory.models import Job, JobState, Task
from openhands_factory.pipeline import FactoryPipeline
from openhands_factory.repository_guard import ensure_push_target
from openhands_factory.state import atomic_write_json


class GitHub:
    def __init__(self) -> None:
        self.labels: list[tuple[int, tuple[str, ...]]] = []
        self.statuses: list[PullRequestStatus] = []
        self.auto_merged: list[int] = []
        self.closed: list[int] = []
        self.reviewed: list[str] = []
        self.comments: list[tuple[int, str]] = []
        self.tasks = [Task("42", "Fix build", "Broken build", "github-issue", 0)]
        self.pull_requests: list[Task] = []
        self.open_issue_titles: set[str] = set()
        self.created_issues: list[tuple[str, str, tuple[str, ...]]] = []
        self._next_issue_number = 200

    def ensure_factory_labels(self) -> None:
        return None

    def collect_open_issues(self, limit: int = 100) -> list[Task]:
        return self.tasks

    def collect_open_pull_requests(self, limit: int = 100) -> list[Task]:
        return self.pull_requests

    def list_all_open_issue_titles(self, limit: int = 100) -> set[str]:
        return self.open_issue_titles

    def create_issue(self, title: str, body: str, labels: tuple[str, ...] = ()) -> int:
        self.created_issues.append((title, body, labels))
        self._next_issue_number += 1
        return self._next_issue_number

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


class ArchitectConversations:
    def __init__(self, *, propose_issues: bool = False, edit_roadmap: bool = False) -> None:
        self.propose_issues = propose_issues
        self.edit_roadmap = edit_roadmap

    def run(self, task: Task, workspace: Path, prompt: str) -> ConversationResult:
        if "architect instructions" not in prompt:
            return ConversationResult(task.identifier, 1, True)
        if self.propose_issues:
            import json

            (workspace / ".factory-architect.json").write_text(
                json.dumps(
                    {
                        "new_issues": [
                            {"title": "Add rate limiting to /auth/login", "body": "Detail."},
                            {"title": "Existing gap already tracked", "body": "Detail."},
                        ]
                    }
                ),
                encoding="utf-8",
            )
        if self.edit_roadmap:
            (workspace / "ROADMAP.md").write_text("Updated roadmap", encoding="utf-8")
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


def _seed_prompts(directory: Path) -> None:
    """Populate a fake worktree with the prompt files _advance() reads from it.

    Production reads phase prompts from each task's own worktree (always freshly
    checked out from origin/main), not the shared base checkout, so any fake
    worktree a test creates must carry its own copy too.
    """
    directory.mkdir(parents=True, exist_ok=True)
    for name in ("task", "review", "repair", "security", "quality_repair", "architect"):
        (directory / f"{name}.md").write_text(f"{name} instructions", encoding="utf-8")


def config(tmp_path: Path) -> FactoryConfig:
    repository = tmp_path / "repository"
    repository.mkdir()
    _seed_prompts(repository / "automation/prompts")
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
        _seed_prompts(worktree / "automation/prompts")
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


def test_pull_request_review_skips_implementation_and_reuses_merge_flow(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory_config = config(tmp_path)
    github = GitHub()
    github.tasks = []
    github.pull_requests = [
        Task(
            "77",
            "Optimize quests",
            "Body",
            "github-pull-request",
            10,
            pr_branch="bolt/optimize-quests",
        )
    ]
    github.statuses = [
        PullRequestStatus(77, "OPEN", False, "MERGEABLE", "", "abcdef1234567", True, False),
        PullRequestStatus(77, "MERGED", False, "UNKNOWN", "", "abcdef1234567", True, False),
    ]

    def prepare_pr(workflow: GitWorkflow, worktree: Path, branch: str) -> None:
        worktree.mkdir(parents=True)
        _seed_prompts(worktree / "automation/prompts")

    monkeypatch.setattr(GitWorkflow, "prepare_pull_request_worktree", prepare_pr)
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: False)
    monkeypatch.setattr(GitWorkflow, "head_sha", lambda workflow: "abcdef1234567")
    monkeypatch.setattr(GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: None)
    pipeline = FactoryPipeline(
        factory_config,
        github=github,  # type: ignore[arg-type]
        conversations=Conversations(),  # type: ignore[arg-type]
    )
    pipeline.refresh()

    states = []
    for _ in range(5):
        job = pipeline.run_job("77")
        assert job is not None
        states.append(job.state)

    assert states == [
        JobState.REVIEWING,
        JobState.CI_PENDING,
        JobState.MERGE_QUEUED,
        JobState.MERGED,
        JobState.DONE,
    ]
    assert github.auto_merged == [77]
    # Merging a pull request already closes it on GitHub - the factory must not also
    # try to close_issue() a pull request number.
    assert github.closed == []
    assert github.reviewed == ["abcdef1234567"]


def test_pull_request_review_can_push_repair_commits_to_its_own_branch(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory_config = config(tmp_path)
    github = GitHub()
    pushed: list[str] = []

    def fake_push(workflow: GitWorkflow, branch: str) -> None:
        # Exercises the real safety check rather than bypassing it, so this proves
        # the pipeline actually threads external_branch through, not just that push
        # was stubbed out.
        ensure_push_target(branch, workflow.base_branch, extra_allowed=workflow.external_branch)
        pushed.append(branch)

    worktree = factory_config.worktree_dir / "issue-77"
    worktree.mkdir(parents=True)
    _seed_prompts(worktree / "automation/prompts")
    task = Task(
        "77",
        "Optimize quests",
        "Body",
        "github-pull-request",
        10,
        pr_branch="bolt/optimize-quests",
    )
    job = Job(
        task=task,
        state=JobState.REVIEWING,
        branch="bolt/optimize-quests",
        pull_request=77,
        head_sha="abcdef1234567",
    )
    pipeline = FactoryPipeline(
        factory_config,
        github=github,  # type: ignore[arg-type]
        conversations=Conversations(),  # type: ignore[arg-type]
    )
    pipeline.jobs.save({"77": job})
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: True)
    monkeypatch.setattr(GitWorkflow, "changed_paths", lambda workflow: {Path("README.md")})
    monkeypatch.setattr(GitWorkflow, "stage_all", lambda workflow: None)
    monkeypatch.setattr(GitWorkflow, "commit", lambda workflow, message: None)
    monkeypatch.setattr(GitWorkflow, "push", fake_push)
    monkeypatch.setattr(GitWorkflow, "head_sha", lambda workflow: "1111111")
    monkeypatch.setattr("openhands_factory.pipeline.run_verification", lambda commands: None)

    result = pipeline.run_job("77")

    assert result is not None and result.last_error is None
    assert pushed == ["bolt/optimize-quests"]


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


def test_verify_only_serializes_the_exclusive_command(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Shared commands (lint, build, unit tests, backend-test:e2e) must run
    without holding verification_slots, so other workers' verification isn't
    blocked behind them; only the fixed-port frontend-e2e command should ever
    acquire that single global slot.
    """
    from threading import Semaphore

    from openhands_factory.verification import VerificationCommand

    pipeline = FactoryPipeline(
        config(tmp_path),
        github=GitHub(),  # type: ignore[arg-type]
        verification_slots=Semaphore(1),
    )
    fake_commands = [
        VerificationCommand("frontend-lint:check", ("true",), tmp_path),
        VerificationCommand("frontend-e2e", ("true",), tmp_path, exclusive=True),
        VerificationCommand("backend-test:e2e", ("true",), tmp_path),
    ]
    monkeypatch.setattr(
        "openhands_factory.pipeline.commands_for", lambda repository, changed: fake_commands
    )
    monkeypatch.setattr(GitWorkflow, "changed_paths", lambda workflow: {Path("frontend/x.ts")})
    slot_held_during: dict[str, bool] = {}

    def fake_run_verification(commands: list[VerificationCommand]) -> None:
        held = pipeline.verification_slots.acquire(blocking=False)  # type: ignore[union-attr]
        if held:
            pipeline.verification_slots.release()  # type: ignore[union-attr]
        for command in commands:
            slot_held_during[command.name] = not held

    monkeypatch.setattr("openhands_factory.pipeline.run_verification", fake_run_verification)
    workflow = GitWorkflow(tmp_path, "main")

    pipeline._verify(workflow)

    assert slot_held_during == {
        "frontend-lint:check": False,
        "backend-test:e2e": False,
        "frontend-e2e": True,
    }


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


def test_conversation_timeout_retries_durably_with_backoff_and_never_quarantines(
    tmp_path: Path,
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
    _seed_prompts(pipeline.config.worktree_dir / "issue-42" / "automation/prompts")

    first = pipeline.run_job("42")
    second = pipeline.run_job("42")
    third = pipeline.run_job("42")
    fourth = pipeline.run_job("42")

    assert first is not None and first.attempts == 1
    assert second is not None and second.attempts == 2
    assert third is not None and third.attempts == 3
    assert fourth is not None and fourth.attempts == 4
    assert fourth.state is JobState.IMPLEMENTING
    assert fourth.next_attempt_at is not None
    assert fourth.next_attempt_at > datetime.now(UTC)
    restored = pipeline.jobs.load()["42"]
    assert restored.state is JobState.IMPLEMENTING
    assert restored.next_attempt_at is not None
    # There is no permanent give-up state and no needs-human label: the factory
    # keeps retrying this issue forever, just with a growing delay between tries.
    assert not github.labels


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
    _seed_prompts(pipeline.config.worktree_dir / "issue-42" / "automation/prompts")
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: False)
    monkeypatch.setattr(GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: None)

    result = None
    for _ in range(3):
        result = pipeline.run_job("42")

    assert result is not None and result.state is JobState.DONE
    assert github.closed == [42]
    assert not any(labels == ("factory-quarantined", "needs-human") for _, labels in github.labels)
    assert any("already satisfied" in body for _, body in github.comments)


def test_refresh_preserves_a_retrying_job_whose_issue_is_still_open(
    tmp_path: Path,
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
    _seed_prompts(pipeline.config.worktree_dir / "issue-42" / "automation/prompts")

    for _ in range(4):
        pipeline.run_job("42")

    refreshed = pipeline.refresh()

    assert refreshed["42"].state is JobState.IMPLEMENTING
    assert refreshed["42"].last_error == "Conversation exceeded the maximum task duration"
    assert refreshed["42"].next_attempt_at is not None


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
    prompt_dir = pipeline.config.worktree_dir / "issue-42" / "automation/prompts"
    _seed_prompts(prompt_dir)
    (prompt_dir / "security.md").write_text(
        "Security Review Workflow instructions", encoding="utf-8"
    )

    first = pipeline.run_job("42")
    second = pipeline.run_job("42")

    assert first is not None and first.state is JobState.SECURITY_REVIEW
    assert second is not None and second.state is JobState.VERIFYING
    assert len(conversations.prompts) == 2
    assert "Security Review Workflow" in conversations.prompts[1]


def test_security_review_conversation_failure_retries_with_backoff(
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
    assert third is not None and third.attempts == 3
    assert third.state is JobState.SECURITY_REVIEW
    assert third.next_attempt_at is not None


def test_architect_due_defaults_true_and_respects_cooldown(tmp_path: Path) -> None:
    pipeline = FactoryPipeline(config(tmp_path), github=GitHub())  # type: ignore[arg-type]

    assert pipeline.architect_due() is True

    atomic_write_json(
        pipeline._architect_state_path(), {"last_run_at": datetime.now(UTC).isoformat()}
    )

    assert pipeline.architect_due() is False


def test_create_deduplicated_issues_skips_titles_that_already_exist(tmp_path: Path) -> None:
    github = GitHub()
    github.open_issue_titles = {"Existing gap already tracked"}
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    proposals = [
        ArchitectProposal(title="Add rate limiting to /auth/login", body="Detail."),
        ArchitectProposal(title="Existing gap already tracked", body="Detail."),
    ]

    created = pipeline._create_deduplicated_issues(proposals)

    assert len(created) == 1
    assert github.created_issues[0][0] == "Add rate limiting to /auth/login"


def test_create_deduplicated_issues_respects_the_configured_cap(tmp_path: Path) -> None:
    github = GitHub()
    factory_config = config(tmp_path).model_copy(update={"architect_max_new_issues": 1})
    pipeline = FactoryPipeline(factory_config, github=github)  # type: ignore[arg-type]
    proposals = [
        ArchitectProposal(title="A", body="Detail."),
        ArchitectProposal(title="B", body="Detail."),
    ]

    created = pipeline._create_deduplicated_issues(proposals)

    assert len(created) == 1


def test_architect_cycle_opens_a_pull_request_when_docs_change(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    github.open_issue_titles = {"Existing gap already tracked"}
    pipeline = FactoryPipeline(
        config(tmp_path),
        github=github,  # type: ignore[arg-type]
        conversations=ArchitectConversations(  # type: ignore[arg-type]
            propose_issues=True, edit_roadmap=True
        ),
    )

    def prepare(workflow: GitWorkflow, worktree: Path, task_id: str, title: str) -> str:
        worktree.mkdir(parents=True)
        _seed_prompts(worktree / "automation/prompts")
        return f"factory/{task_id}-weekly-gap-analysis"

    monkeypatch.setattr(GitWorkflow, "prepare_worktree", prepare)
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: True)
    monkeypatch.setattr(GitWorkflow, "changed_paths", lambda workflow: {Path("ROADMAP.md")})
    monkeypatch.setattr(GitWorkflow, "stage_all", lambda workflow: None)
    monkeypatch.setattr(GitWorkflow, "commit", lambda workflow, message: None)
    monkeypatch.setattr(GitWorkflow, "push", lambda workflow, branch: None)
    monkeypatch.setattr(GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: None)
    monkeypatch.setattr("openhands_factory.pipeline.run_verification", lambda commands: None)

    pipeline.run_architect_cycle()

    assert len(github.created_issues) == 1
    assert github.created_issues[0][0] == "Add rate limiting to /auth/login"
    jobs = pipeline.jobs.load()
    assert len(jobs) == 1
    saved_job = next(iter(jobs.values()))
    assert saved_job.task.source == "github-pull-request"
    assert saved_job.task.identifier == "99"
    assert saved_job.state == JobState.DISCOVERED


def test_architect_cycle_does_nothing_when_no_proposals_or_changes(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(
        config(tmp_path),
        github=github,  # type: ignore[arg-type]
        conversations=ArchitectConversations(),  # type: ignore[arg-type]
    )
    removed: list[Path] = []

    def prepare(workflow: GitWorkflow, worktree: Path, task_id: str, title: str) -> str:
        worktree.mkdir(parents=True)
        _seed_prompts(worktree / "automation/prompts")
        return f"factory/{task_id}-weekly-gap-analysis"

    monkeypatch.setattr(GitWorkflow, "prepare_worktree", prepare)
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: False)
    monkeypatch.setattr(
        GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: removed.append(path)
    )

    pipeline.run_architect_cycle()

    assert github.created_issues == []
    assert pipeline.jobs.load() == {}
    assert removed == [pipeline.config.worktree_dir / "architect"]
