"""Autonomous, bounded recovery for repeated task-side failure circuits.

Repeated identical task failures enter the existing durable ``QUARANTINED`` diagnostic
state. That state is intentionally quiet for one full retry window, but it must not
require an operator merely to re-enter the queue. This module owns the conservative
release rule without resetting the evidence that caused the circuit to open.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from openhands_factory.jobs import MAX_PERSISTED_RETRY_DELAY, JobStore
from openhands_factory.models import JobState


def recover_due_quarantines(
    store: JobStore,
    *,
    now: datetime | None = None,
    recovery_delay: timedelta = MAX_PERSISTED_RETRY_DELAY,
) -> list[str]:
    """Return due task circuits to discovery while preserving retry evidence.

    The circuit remains durable across daemon restarts because ``quarantined_at`` is
    persisted with the job. Missing legacy timestamps are treated as already due so an
    old permanent quarantine cannot wedge the queue forever. Recovery deliberately keeps
    attempts, failure-class counters, the stable failure fingerprint, provider history,
    and ``last_error``. If the same failure happens again, the task immediately returns
    to a quiet recovery window instead of starting a fresh retry budget.
    """

    if recovery_delay <= timedelta(0):
        raise ValueError("recovery_delay must be positive")

    current = now or datetime.now(UTC)
    recovered: list[str] = []
    with store._process_lock, store.file_lock:
        store._assert_generation_current()
        jobs = store._load()
        for task_id, job in jobs.items():
            if job.state is not JobState.QUARANTINED:
                continue
            quarantined_at = job.quarantined_at
            if quarantined_at is not None and quarantined_at + recovery_delay > current:
                continue

            job.state = JobState.DISCOVERED
            job.next_attempt_at = None
            job.quarantine_reason = None
            job.quarantined_at = None
            job.quarantine_notification_pending = False
            job.updated_at = current
            recovered.append(task_id)

        if recovered:
            store._save_raw(jobs)

    return sorted(recovered, key=lambda identifier: (not identifier.isdigit(), identifier))
