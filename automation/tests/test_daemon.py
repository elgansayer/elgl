from dataclasses import replace
from datetime import UTC, datetime, timedelta

from openhands_factory.daemon import queue_snapshot, select_batch
from openhands_factory.models import Job, JobState, Task


def job(identifier: str, priority: int, state: JobState = JobState.DISCOVERED) -> Job:
    return Job(Task(identifier, f"Task {identifier}", "Body", "github-issue", priority), state)


def test_select_batch_fills_parallel_capacity_by_priority() -> None:
    jobs = {
        "12": job("12", 10),
        "10": job("10", 0),
        "11": job("11", 0),
        "9": job("9", 0, JobState.DONE),
        "8": job("8", 0, JobState.QUARANTINED),
    }

    selected = select_batch(jobs, 3)

    assert [item.task.identifier for item in selected] == ["10", "11", "12"]


def test_select_batch_refills_free_capacity_without_rescheduling_active_jobs() -> None:
    jobs = {
        "10": job("10", 0, JobState.IMPLEMENTING),
        "11": job("11", 0),
        "12": job("12", 1),
        "13": job("13", 2),
    }

    selected = select_batch(jobs, 2, {"10"})

    assert [item.task.identifier for item in selected] == ["11", "12"]


def test_select_batch_skips_jobs_still_backing_off() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    jobs = {
        "10": replace(
            job("10", 0, JobState.IMPLEMENTING), next_attempt_at=now + timedelta(minutes=5)
        ),
        "11": replace(
            job("11", 0, JobState.IMPLEMENTING), next_attempt_at=now - timedelta(minutes=5)
        ),
    }

    selected = select_batch(jobs, 5, now=now)

    assert [item.task.identifier for item in selected] == ["11"]


def test_queue_snapshot_separates_runnable_backoff_active_and_terminal_jobs() -> None:
    now = datetime(2026, 1, 1, tzinfo=UTC)
    jobs = {
        "10": job("10", 0, JobState.IMPLEMENTING),
        "11": job("11", 0, JobState.DISCOVERED),
        "12": replace(
            job("12", 0, JobState.IMPLEMENTING), next_attempt_at=now + timedelta(minutes=5)
        ),
        "13": job("13", 0, JobState.DONE),
        "14": job("14", 0, JobState.QUARANTINED),
    }

    snapshot = queue_snapshot(jobs, {"10"}, now=now)

    assert snapshot == {
        "total_jobs": 5,
        "active_count": 1,
        "runnable_count": 1,
        "backing_off_count": 1,
        "by_state": {
            "discovered": 1,
            "done": 1,
            "implementing": 2,
            "quarantined": 1,
        },
    }
