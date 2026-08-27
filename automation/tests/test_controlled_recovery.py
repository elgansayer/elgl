from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.controlled_recovery import (
    quarantine_recovery_delay,
    recover_due_quarantines,
)
from openhands_factory.jobs import MAX_PERSISTED_RETRY_DELAY, JobStore
from openhands_factory.models import JobState, Task

_BASE_RECOVERY_DELAY = timedelta(minutes=30)


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


def test_first_quarantine_uses_configured_base_window(tmp_path: Path) -> None:
    store, task_id = _quarantined_job(tmp_path / "jobs.json")
    quarantined = store.load()[task_id]
    assert quarantined.quarantined_at is not None

    recovered = recover_due_quarantines(
        store,
        now=quarantined.quarantined_at + timedelta(minutes=29),
        recovery_delay=_BASE_RECOVERY_DELAY,
    )

    assert recovered == []
    assert store.load()[task_id].state is JobState.QUARANTINED

    recovered = recover_due_quarantines(
        store,
        now=quarantined.quarantined_at + _BASE_RECOVERY_DELAY + timedelta(seconds=1),
        recovery_delay=_BASE_RECOVERY_DELAY,
    )

    assert recovered == [task_id]


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
        now=quarantined.quarantined_at + _BASE_RECOVERY_DELAY + timedelta(seconds=1),
        recovery_delay=_BASE_RECOVERY_DELAY,
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


def test_same_failure_after_recovery_doubles_next_quiet_window(tmp_path: Path) -> None:
    store, task_id = _quarantined_job(tmp_path / "jobs.json")
    quarantined = store.load()[task_id]
    assert quarantined.quarantined_at is not None
    first_repeated_count = quarantined.repeated_failure_count

    recover_due_quarantines(
        store,
        now=quarantined.quarantined_at + _BASE_RECOVERY_DELAY + timedelta(seconds=1),
        recovery_delay=_BASE_RECOVERY_DELAY,
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

    too_early = recover_due_quarantines(
        store,
        now=requarantined.quarantined_at + timedelta(minutes=59),
        recovery_delay=_BASE_RECOVERY_DELAY,
    )
    assert too_early == []

    due = recover_due_quarantines(
        store,
        now=requarantined.quarantined_at + timedelta(minutes=60, seconds=1),
        recovery_delay=_BASE_RECOVERY_DELAY,
    )
    assert due == [task_id]


def test_adaptive_recovery_delay_caps_at_persisted_retry_maximum() -> None:
    delay = quarantine_recovery_delay(
        _BASE_RECOVERY_DELAY,
        repeated_failure_count=1000,
        repeated_failure_limit=3,
    )

    assert delay == MAX_PERSISTED_RETRY_DELAY


def test_store_without_repeated_failure_limit_keeps_fixed_delay() -> None:
    delay = quarantine_recovery_delay(
        _BASE_RECOVERY_DELAY,
        repeated_failure_count=1000,
        repeated_failure_limit=None,
    )

    assert delay == _BASE_RECOVERY_DELAY


def test_legacy_quarantine_without_timestamp_is_immediately_recoverable(tmp_path: Path) -> None:
    store, task_id = _quarantined_job(tmp_path / "jobs.json")
    job = store.load()[task_id]
    job.quarantined_at = None
    store._save_raw({task_id: job})

    recovered = recover_due_quarantines(store, recovery_delay=_BASE_RECOVERY_DELAY)

    assert recovered == [task_id]
    assert store.load()[task_id].state is JobState.DISCOVERED
