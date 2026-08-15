from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.gitops import GitWorkflow
from openhands_factory.models import JobState, Task
from openhands_factory.pipeline import FactoryPipeline


class GitHub:
    def __init__(self) -> None:
        self.tasks = [Task(identifier="42", title="Fix build", body="Broken build")]
        self.prs: dict[str, int] = {}
        self.merged: set[int] = set()
        self.closed: set[int] = set()
        self.open_pull_requests: list[Task] = []

    def discover_open_issues(self) -> list[Task]:
        return self.tasks

    def discover_open_pull_requests(self) -> list[Task]:
        return self.open_pull_requests

    def find_pull_request(self, branch: str) -> int | None:
        return self.prs.get(branch)

    def pull_request_head_sha(self, number: int) -> str:
        return f"sha-{number}"

    def pull_request_is_merged(self, number: int) -> bool:
        return number in self.merged

    def pull_request_is_open(self, number: int) -> bool:
        return number not in self.closed

    def list_open_pull_requests(self, label: str | None = None) -> list[dict[str, object]]:
        _ = label
        return []

    def create_pull_request(self, branch: str, task: Task) -> int:
        _ = task
        number = 100
        self.prs[branch] = number
        return number

    def add_label(self, number: int, label: str) -> None:
        _ = (number, label)

    def remove_label(self, number: int, label: str) -> None:
        _ = (number, label)

    def close_issue(self, number: int) -> None:
        _ = number

    def comment_issue(self, number: int, body: str) -> None:
        _ = (number, body)

    def comment_pull_request(self, number: int, body: str) -> None:
        _ = (number, body)

    def merge_pull_request(self, number: int) -> None:
        self.merged.add(number)

    def repository_is_clean(self) -> bool:
        return True


def config(tmp_path: Path) -> FactoryConfig:
    repository = tmp_path / "repo"
    repository.mkdir()
    (repository / ".git").mkdir()
    return FactoryConfig(
        repository=repository,
        worktree_dir=tmp_path / "worktrees",
        state_dir=tmp_path / "state",
        recovery_dir=tmp_path / "recovery",
        task_image="test-image",
        opencode_go_api_key="test",
        opencode_go_model="test-model",
        github_token="test",
        max_parallel_jobs=1,
        maximum_pull_requests=1,
        minimum_free_disk_gib=1,
        max_consecutive_failures=3,
        monthly_variable_budget_usd=0,
        gemini_enabled=False,
        gemini_api_key=None,
        gemini_model="test-gemini",
        require_ready_label=False,
        podman_path="podman",
    )


def test_refresh_discovers_issue(tmp_path: Path) -> None:
    pipeline = FactoryPipeline(config(tmp_path), github=GitHub())  # type: ignore[arg-type]

    jobs = pipeline.refresh()

    assert jobs["42"].state is JobState.DISCOVERED


def test_refresh_reattaches_existing_pull_request(tmp_path: Path) -> None:
    github = GitHub()
    github.prs["factory/issue-42"] = 123
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    job = pipeline.refresh()["42"]
    job.branch = "factory/issue-42"
    job.state = JobState.PULL_REQUEST_OPEN
    pipeline.jobs.save({"42": job})

    refreshed = pipeline.refresh()["42"]

    assert refreshed.pull_request == 123
    assert refreshed.head_sha == "sha-123"


def test_refresh_marks_merged_pull_request_done(tmp_path: Path) -> None:
    github = GitHub()
    github.prs["factory/issue-42"] = 123
    github.merged.add(123)
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    job = pipeline.refresh()["42"]
    job.branch = "factory/issue-42"
    job.pull_request = 123
    job.state = JobState.PULL_REQUEST_OPEN
    pipeline.jobs.save({"42": job})

    refreshed = pipeline.refresh()["42"]

    assert refreshed.state is JobState.DONE


def test_refresh_preserves_active_implementation_when_discovery_temporarily_misses_issue(
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


def test_refresh_migrates_a_quarantined_closed_issue_into_normal_completion(
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

    assert refreshed["42"].state is JobState.DONE
    assert refreshed["42"].last_error == "Issue closed before pull request creation"


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
    monkeypatch.setattr(GitWorkflow, "remove_worktree", lambda workflow, path, **kwargs: None)
    github.tasks = []

    refreshed = pipeline.refresh()

    assert refreshed["42"].state is JobState.DONE
    assert refreshed["42"].last_error == "Issue closed before pull request creation"


def test_run_once_respects_retry_backoff(tmp_path: Path) -> None:
    pipeline = FactoryPipeline(config(tmp_path), github=GitHub())  # type: ignore[arg-type]
    job = pipeline.refresh()["42"]
    job.next_attempt_at = datetime.now(UTC) + timedelta(hours=1)
    pipeline.jobs.save({"42": job})

    assert pipeline.run_once() is None


def test_run_once_selects_lowest_priority_then_identifier(tmp_path: Path) -> None:
    github = GitHub()
    github.tasks = [
        Task(identifier="100", title="Later", body="Later", priority=10),
        Task(identifier="42", title="First", body="First", priority=0),
    ]
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    pipeline.refresh()
    selected: list[str] = []
    pipeline._advance = lambda job: selected.append(job.task.identifier)  # type: ignore[method-assign]

    pipeline.run_once()

    assert selected == ["42"]


def test_run_once_records_retry_after_failure(tmp_path: Path) -> None:
    pipeline = FactoryPipeline(config(tmp_path), github=GitHub())  # type: ignore[arg-type]
    pipeline.refresh()

    def fail(job: object) -> None:
        _ = job
        raise RuntimeError("boom")

    pipeline._advance = fail  # type: ignore[method-assign]
    result = pipeline.run_once()

    assert result is not None
    assert result.attempts == 1
    assert result.last_error == "boom"
    assert result.next_attempt_at is not None


def test_run_once_caps_retry_backoff_at_one_day(tmp_path: Path) -> None:
    pipeline = FactoryPipeline(config(tmp_path), github=GitHub())  # type: ignore[arg-type]
    pipeline.refresh()
    job = pipeline.jobs.load()["42"]
    job.attempts = 20
    pipeline.jobs.save({"42": job})

    before = datetime.now(UTC)
    pipeline._advance = lambda job: (_ for _ in ()).throw(RuntimeError("boom"))  # type: ignore[method-assign]
    result = pipeline.run_once()
    after = datetime.now(UTC)

    assert result is not None
    assert result.next_attempt_at is not None
    assert before + timedelta(days=1) <= result.next_attempt_at <= after + timedelta(days=1)


def test_run_job_merges_only_selected_job_state(tmp_path: Path) -> None:
    github = GitHub()
    github.tasks = [
        Task(identifier="42", title="First", body="First"),
        Task(identifier="43", title="Second", body="Second"),
    ]
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    pipeline.refresh()
    other = pipeline.jobs.load()["43"]
    other.state = JobState.IMPLEMENTING
    pipeline.jobs.save_job(other)

    def advance(job: object) -> None:
        assert hasattr(job, "state")
        job.state = JobState.PULL_REQUEST_OPEN  # type: ignore[attr-defined]

    pipeline._advance = advance  # type: ignore[method-assign]
    result = pipeline.run_job("42")

    assert result is not None
    jobs = pipeline.jobs.load()
    assert jobs["42"].state is JobState.PULL_REQUEST_OPEN
    assert jobs["43"].state is JobState.IMPLEMENTING


def test_refresh_uses_preloaded_tasks_without_second_discovery(tmp_path: Path) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(config(tmp_path), github=github)  # type: ignore[arg-type]
    preloaded = [Task(identifier="99", title="Preloaded", body="Preloaded")]
    github.tasks = []

    refreshed = pipeline.refresh(preloaded_tasks=preloaded)

    assert "99" in refreshed


def test_pipeline_exposes_scheduler_compatible_active_job_count(tmp_path: Path) -> None:
    pipeline = FactoryPipeline(config(tmp_path), github=GitHub())  # type: ignore[arg-type]
    pipeline.refresh()

    assert pipeline.active_job_count() == 1


def test_pipeline_releases_task_lock_when_job_finishes(tmp_path: Path) -> None:
    pipeline = FactoryPipeline(config(tmp_path), github=GitHub())  # type: ignore[arg-type]
    pipeline.refresh()
    pipeline.tasks.acquire("42")
    job = pipeline.jobs.load()["42"]
    job.state = JobState.DONE
    pipeline.jobs.save_job(job)

    pipeline.refresh()

    assert pipeline.tasks.acquire("42")


def test_scheduler_config_namespace_is_available(tmp_path: Path) -> None:
    pipeline = FactoryPipeline(config(tmp_path), github=GitHub())  # type: ignore[arg-type]

    scheduler = SimpleNamespace(
        max_parallel_jobs=pipeline.config.max_parallel_jobs,
        maximum_pull_requests=pipeline.config.maximum_pull_requests,
    )

    assert scheduler.max_parallel_jobs == 1
    assert scheduler.maximum_pull_requests == 1
