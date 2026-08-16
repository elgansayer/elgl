from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from openhands_factory.jobs import JobStore
from openhands_factory.models import JobState, Task


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
    store.save(jobs)

    restored = store.reconcile([task])

    assert restored["9"].state is JobState.DISCOVERED
    assert restored["9"].last_error is None


def test_reconcile_migrates_quarantined_job_not_in_active_tasks(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    stale = Task("258", "Historical issue", "", "github-issue", 0)
    jobs = store.reconcile([stale])
    jobs["258"].state = JobState.QUARANTINED
    jobs["258"].attempts = 12
    jobs["258"].repair_attempts = 5
    jobs["258"].last_error = "legacy permanent failure"
    store.save(jobs)

    restored = store.reconcile([])

    assert restored["258"].state is JobState.DISCOVERED
    assert restored["258"].attempts == 0
    assert restored["258"].repair_attempts == 0
    assert restored["258"].last_error is None
    assert restored["258"].next_attempt_at is None


def test_load_normalizes_legacy_quarantine_without_reconciliation(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("259", "Legacy quarantined issue", "", "github-issue", 0)
    jobs = store.reconcile([task])
    jobs["259"].state = JobState.QUARANTINED
    jobs["259"].attempts = 8
    jobs["259"].repair_attempts = 3
    jobs["259"].quality_repairs = 2
    jobs["259"].last_error = "legacy terminal state"
    store.save(jobs)

    restored = store.load()

    assert restored["259"].state is JobState.DISCOVERED
    assert restored["259"].attempts == 0
    assert restored["259"].repair_attempts == 0
    assert restored["259"].quality_repairs == 0
    assert restored["259"].last_error is None
    assert restored["259"].next_attempt_at is None


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
