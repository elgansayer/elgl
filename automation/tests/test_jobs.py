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
