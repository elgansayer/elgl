from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.conversation_runner import ConversationResult
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
        self.tasks = [Task("42", "Fix build", "Broken build", "github-issue", 0)]

    def ensure_factory_labels(self) -> None:
        return None

    def collect_open_issues(self, limit: int = 100) -> list[Task]:
        return self.tasks

    def add_issue_labels(self, issue: int, labels: tuple[str, ...]) -> None:
        self.labels.append((issue, labels))

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
        return ConversationResult(task.identifier, 1, True)


def config(tmp_path: Path) -> FactoryConfig:
    repository = tmp_path / "repository"
    repository.mkdir()
    prompt_dir = repository / "automation/prompts"
    prompt_dir.mkdir(parents=True)
    for name in ("task", "review", "repair"):
        (prompt_dir / f"{name}.md").write_text(f"{name} instructions", encoding="utf-8")
    return FactoryConfig.from_environment(
        {
            "FACTORY_REPOSITORY": str(repository),
            "FACTORY_STATE_DIR": str(tmp_path / "state"),
            "FACTORY_LOG_DIR": str(tmp_path / "log"),
            "FACTORY_PROFILE_STORE": str(tmp_path / "profiles"),
            "FACTORY_WORKTREE_DIR": str(tmp_path / "worktrees"),
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
        GitWorkflow, "remove_worktree", lambda workflow, path: removed.append(path)
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
        PullRequestStatus(99, "OPEN", False, "MERGEABLE", "", "head", True, False),
        PullRequestStatus(99, "MERGED", False, "UNKNOWN", "", "head", True, False),
    ]

    def prepare(
        workflow: GitWorkflow, worktree: Path, task_id: str, title: str
    ) -> str:
        worktree.mkdir(parents=True)
        (worktree / "AGENTS.md").write_text("Instructions", encoding="utf-8")
        return "factory/42-fix-build"

    monkeypatch.setattr(GitWorkflow, "prepare_worktree", prepare)
    monkeypatch.setattr(GitWorkflow, "has_changes", lambda workflow: True)
    monkeypatch.setattr(GitWorkflow, "changed_paths", lambda workflow: {Path("README.md")})
    monkeypatch.setattr(GitWorkflow, "stage_all", lambda workflow: None)
    monkeypatch.setattr(GitWorkflow, "commit", lambda workflow, message: None)
    monkeypatch.setattr(GitWorkflow, "push", lambda workflow, branch: None)
    monkeypatch.setattr(GitWorkflow, "head_sha", lambda workflow: "head")
    monkeypatch.setattr(GitWorkflow, "remove_worktree", lambda workflow, path: None)
    monkeypatch.setattr("openhands_factory.pipeline.run_verification", lambda commands: None)
    pipeline = FactoryPipeline(
        factory_config,
        github=github,  # type: ignore[arg-type]
        conversations=Conversations(),  # type: ignore[arg-type]
    )

    states = []
    for _ in range(8):
        job = pipeline.run_once()
        assert job is not None
        states.append(job.state)

    assert states == [
        JobState.IMPLEMENTING,
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
    assert github.reviewed == ["head"]


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
