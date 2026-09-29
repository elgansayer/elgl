from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.controlled_recovery import recover_due_quarantines
from openhands_factory.jobs import JobStore
from openhands_factory.models import JobState, Task


def _quarantined_job(path: Path) -> tuple[JobStore, str]:
    store = JobStore(path, max_repeated_failures=1)
    task_id = "7036"
    job = store.reconcile([Task(task_id, "Bounded recovery", "", "github-issue", 0)])[task_id]
    job.state = JobState.IMPLEMENTING
    job.attempts = 1
    job.last_error = "Repository validation failed with the same deterministic error"
    store.save_job(job)
    assert store.load()[task_id].state is JobState.QUARANTINED
    return store, task_id


def test_quarantine_does_not_recover_before_full_window(tmp_path: Path) -> None:
    store, task_id = _quarantined_job(tmp_path / "jobs.json")
    quarantined = store.load()[task_id]
    assert quarantined.quarantined_at is not None

    recovered = recover_due_quarantines(
        store,
        now=quarantined.quarantined_at + timedelta(hours=23),
    )

    assert recovered == []
    assert store.load()[task_id].state is JobState.QUARANTINED


def test_due_quarantine_recovers_without_resetting_failure_evidence(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    store, task_id = _quarantined_job(path)
    quarantined = store.load()[task_id]
    assert quarantined.quarantined_at is not None
    failure_counts = dict(quarantined.failure_counts)
    fingerprint = quarantined.last_failure_fingerprint
    repeated = quarantined.repeated_failure_count
    attempts = quarantined.attempts
    last_error = quarantined.last_error

    restarted = JobStore(path, max_repeated_failures=1)
    recovered = recover_due_quarantines(
        restarted,
        now=quarantined.quarantined_at + timedelta(hours=24, seconds=1),
    )
    restored = restarted.load()[task_id]

    assert recovered == [task_id]
    assert restored.state is JobState.DISCOVERED
    assert restored.failure_counts == failure_counts
    assert restored.last_failure_fingerprint == fingerprint
    assert restored.repeated_failure_count == repeated
    assert restored.attempts == attempts
    assert restored.last_error == last_error
    assert restored.quarantine_reason is None
    assert restored.quarantined_at is None
    assert not restored.quarantine_notification_pending


def test_same_failure_after_recovery_reopens_bounded_circuit(tmp_path: Path) -> None:
    store, task_id = _quarantined_job(tmp_path / "jobs.json")
    quarantined = store.load()[task_id]
    assert quarantined.quarantined_at is not None
    first_repeated_count = quarantined.repeated_failure_count

    recover_due_quarantines(
        store,
        now=quarantined.quarantined_at + timedelta(hours=24, seconds=1),
    )
    job = store.load()[task_id]
    job.state = JobState.IMPLEMENTING
    job.attempts += 1
    job.last_error = "Repository validation failed with the same deterministic error"
    job.updated_at = datetime.now(UTC)
    store.save_job(job)
    requarantined = store.load()[task_id]

    assert requarantined.state is JobState.QUARANTINED
    assert requarantined.repeated_failure_count == first_repeated_count + 1
    assert requarantined.quarantined_at is not None


def test_legacy_quarantine_without_timestamp_is_immediately_recoverable(tmp_path: Path) -> None:
    store, task_id = _quarantined_job(tmp_path / "jobs.json")
    job = store.load()[task_id]
    job.quarantined_at = None
    store._save_raw({task_id: job})

    recovered = recover_due_quarantines(store)

    assert recovered == [task_id]
    assert store.load()[task_id].state is JobState.DISCOVERED
