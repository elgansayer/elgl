from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from openhands_factory.jobs import JobStore
from openhands_factory.models import JobState, Task
from openhands_factory.state import atomic_write_json


def test_reconcile_is_idempotent_and_preserves_progress(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("7", "Fix tests", "Body", "github-issue", 0)

    jobs = store.reconcile([task])
    jobs["7"].state = JobState.IMPLEMENTING
    jobs["7"].branch = "factory/7-fix-tests"
    store.save(jobs)

    restored = store.reconcile([task])

    assert restored["7"].state is JobState.IMPLEMENTING
    assert restored["7"].branch == "factory/7-fix-tests"


def test_reconcile_adds_new_tasks_without_dropping_old_jobs(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    first = Task("1", "First", "", "github-issue", 10)
    second = Task("2", "Second", "", "github-issue", 10)

    store.reconcile([first])
    jobs = store.reconcile([second])

    assert set(jobs) == {"1", "2"}


def test_reconcile_requeues_open_issue_marked_done_without_a_pr(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("9", "Retry issue", "", "github-issue", 0)
    jobs = store.reconcile([task])
    jobs["9"].state = JobState.DONE
    jobs["9"].last_error = "Issue closed before pull request creation"
    jobs["9"].failure_counts = {"transient": 4}
    jobs["9"].last_failure_kind = "transient"
    jobs["9"].last_failure_fingerprint = "abc123"
    jobs["9"].repeated_failure_count = 4
    store.save(jobs)

    restored = store.reconcile([task])

    assert restored["9"].state is JobState.DISCOVERED
    assert restored["9"].last_error is None
    assert restored["9"].failure_counts == {}
    assert restored["9"].last_failure_kind is None
    assert restored["9"].last_failure_fingerprint is None
    assert restored["9"].repeated_failure_count == 0


def test_reconcile_migrates_quarantined_job_not_in_active_tasks(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    stale = Task("258", "Historical issue", "", "github-issue", 0)
    jobs = store.reconcile([stale])
    jobs["258"].state = JobState.QUARANTINED
    jobs["258"].attempts = 12
    jobs["258"].repair_attempts = 5
    jobs["258"].last_error = "legacy permanent failure"
    jobs["258"].failure_counts = {"tool": 7}
    jobs["258"].last_failure_kind = "tool"
    jobs["258"].last_failure_fingerprint = "deadbeef"
    jobs["258"].repeated_failure_count = 7
    store.save(jobs)

    restored = store.reconcile([])

    assert restored["258"].state is JobState.DISCOVERED
    assert restored["258"].attempts == 0
    assert restored["258"].repair_attempts == 0
    assert restored["258"].last_error is None
    assert restored["258"].next_attempt_at is None
    assert restored["258"].failure_counts == {}
    assert restored["258"].last_failure_kind is None
    assert restored["258"].last_failure_fingerprint is None
    assert restored["258"].repeated_failure_count == 0


def test_load_normalizes_legacy_quarantine_without_reconciliation(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("259", "Legacy quarantined issue", "", "github-issue", 0)
    jobs = store.reconcile([task])
    jobs["259"].state = JobState.QUARANTINED
    jobs["259"].attempts = 8
    jobs["259"].repair_attempts = 3
    jobs["259"].quality_repairs = 2
    jobs["259"].last_error = "legacy terminal state"
    jobs["259"].failure_counts = {"task-timeout": 2}
    jobs["259"].last_failure_kind = "task-timeout"
    jobs["259"].last_failure_fingerprint = "cafebabe"
    jobs["259"].repeated_failure_count = 2
    store.save(jobs)

    restored = store.load()

    assert restored["259"].state is JobState.DISCOVERED
    assert restored["259"].attempts == 0
    assert restored["259"].repair_attempts == 0
    assert restored["259"].quality_repairs == 0
    assert restored["259"].last_error is None
    assert restored["259"].next_attempt_at is None
    assert restored["259"].failure_counts == {}
    assert restored["259"].last_failure_kind is None
    assert restored["259"].last_failure_fingerprint is None
    assert restored["259"].repeated_failure_count == 0


def test_retry_diagnostics_round_trip(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("260", "Retry metadata", "", "github-issue", 0)
    jobs = store.reconcile([task])
    job = jobs["260"]
    job.failure_counts = {"rate-limit": 3, "tool": 1}
    job.last_failure_kind = "rate-limit"
    job.last_failure_fingerprint = "4f8d6e2a1b"
    job.repeated_failure_count = 3
    store.save(jobs)

    restored = store.load()["260"]

    assert restored.failure_counts == {"rate-limit": 3, "tool": 1}
    assert restored.last_failure_kind == "rate-limit"
    assert restored.last_failure_fingerprint == "4f8d6e2a1b"
    assert restored.repeated_failure_count == 3


def test_legacy_job_without_retry_diagnostics_loads_with_safe_defaults(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    atomic_write_json(
        path,
        {
            "jobs": [
                {
                    "task": {
                        "identifier": "261",
                        "title": "Legacy job",
                        "body": "",
                        "source": "github-issue",
                        "priority": 0,
                        "pr_branch": None,
                    },
                    "state": "implementing",
                    "branch": "factory/261-legacy-job",
                    "pull_request": None,
                    "head_sha": None,
                    "attempts": 2,
                    "repair_attempts": 0,
                    "quality_repairs": 0,
                    "last_error": "old failure",
                    "next_attempt_at": None,
                    "factory_generation": "legacy",
                    "updated_at": "2026-08-16T10:00:00+00:00",
                }
            ]
        },
    )

    restored = JobStore(path).load()["261"]

    assert restored.failure_counts == {}
    assert restored.last_failure_kind is None
    assert restored.last_failure_fingerprint is None
    assert restored.repeated_failure_count == 0


def test_parallel_job_updates_do_not_lose_sibling_state(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    tasks = [Task(str(identifier), "Task", "", "github-issue", 0) for identifier in range(6)]
    jobs = store.reconcile(tasks)
    for item in jobs.values():
        item.state = JobState.IMPLEMENTING

    with ThreadPoolExecutor(max_workers=6) as workers:
        list(workers.map(store.save_job, jobs.values()))

    restored = store.load()
    assert set(restored) == {task.identifier for task in tasks}
    assert all(item.state is JobState.IMPLEMENTING for item in restored.values())
