from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.jobs import JobStore
from openhands_factory.models import FailureKind, Job, JobState, Task


def _store(tmp_path: Path) -> JobStore:
    state_dir = tmp_path / "state"
    state_dir.mkdir()
    return JobStore(state_dir / "jobs.json")


def _job(state: JobState, updated_at: datetime) -> Job:
    job = Job(Task("42", "Recover worker", "", "github-issue", 0), state)
    job.updated_at = updated_at
    return job


def test_abandoned_worker_attempt_enters_durable_timeout_backoff(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 8, 17, 0, 0, tzinfo=UTC)
    job = _job(JobState.IMPLEMENTING, now - timedelta(hours=3))
    store.save({"42": job})

    recovered = store.recover_abandoned_attempts(set(), timedelta(hours=2), now=now)

    assert recovered == ["42"]
    restored = store.load()["42"]
    assert restored.state is JobState.IMPLEMENTING
    assert restored.attempts == 1
    assert restored.last_failure_kind == FailureKind.TASK_TIMEOUT.value
    assert restored.failure_counts == {FailureKind.TASK_TIMEOUT.value: 1}
    assert restored.repeated_failure_count == 1
    assert restored.updated_at == now
    assert restored.next_attempt_at is not None
    assert restored.next_attempt_at > now
    assert restored.next_attempt_at <= now + timedelta(hours=24)


def test_watchdog_never_recovers_a_live_future(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 8, 17, 0, 0, tzinfo=UTC)
    job = _job(JobState.REVIEWING, now - timedelta(hours=4))
    store.save({"42": job})

    recovered = store.recover_abandoned_attempts({"42"}, timedelta(hours=2), now=now)

    assert recovered == []
    restored = store.load()["42"]
    assert restored.attempts == 0
    assert restored.last_error is None
    assert restored.next_attempt_at is None


def test_polling_states_are_not_treated_as_abandoned_workers(tmp_path: Path) -> None:
    store = _store(tmp_path)
    now = datetime(2026, 8, 17, 0, 0, tzinfo=UTC)
    ci_pending = _job(JobState.CI_PENDING, now - timedelta(hours=6))
    merge_queued = Job(Task("43", "Merge worker", "", "github-issue", 0), JobState.MERGE_QUEUED)
    merge_queued.updated_at = now - timedelta(hours=6)
    store.save({"42": ci_pending, "43": merge_queued})

    recovered = store.recover_abandoned_attempts(set(), timedelta(hours=2), now=now)

    assert recovered == []
    restored = store.load()
    assert restored["42"].attempts == 0
    assert restored["43"].attempts == 0
