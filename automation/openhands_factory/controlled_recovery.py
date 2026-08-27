"""Autonomous, bounded recovery for repeated task-side failure circuits.

Repeated identical task failures enter the existing durable ``QUARANTINED`` diagnostic
state. That state is intentionally quiet for a bounded retry window, but it must not
require an operator merely to re-enter the queue. This module owns the conservative
release rule without resetting the evidence that caused the circuit to open.
"""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from openhands_factory.jobs import MAX_PERSISTED_RETRY_DELAY, JobStore
from openhands_factory.models import JobState


def quarantine_recovery_delay(
    recovery_delay: timedelta,
    *,
    repeated_failure_count: int,
    repeated_failure_limit: int | None,
) -> timedelta:
    """Return the bounded delay for one quarantined task circuit.

    The configured recovery delay remains the first autonomous retry window. Once the
    same failure has already crossed the repeated-failure limit, each subsequent
    re-quarantine doubles the quiet window. This keeps eventual autonomous recovery
    while preventing a chronically unchanged task from consuming another subscription
    route every few minutes forever. The durable retry-policy maximum remains the cap.

    Stores without a repeated-failure limit retain the historical fixed-delay behavior.
    """

    if recovery_delay <= timedelta(0):
        raise ValueError("recovery_delay must be positive")
    if repeated_failure_limit is None:
        return min(recovery_delay, MAX_PERSISTED_RETRY_DELAY)
    if repeated_failure_limit <= 0:
        raise ValueError("repeated_failure_limit must be positive")

    extra_failures = max(0, repeated_failure_count - repeated_failure_limit)
    # The 24-hour cap is reached long before this bound for production's 30-minute
    # base delay. Capping the exponent also makes corrupt legacy counters harmless.
    multiplier = 1 << min(extra_failures, 20)
    return min(recovery_delay * multiplier, MAX_PERSISTED_RETRY_DELAY)


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
    to quarantine and its next recovery window grows exponentially up to the durable
    24-hour retry-policy maximum.
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
            effective_delay = quarantine_recovery_delay(
                recovery_delay,
                repeated_failure_count=job.repeated_failure_count,
                repeated_failure_limit=store.max_repeated_failures,
            )
            if quarantined_at is not None and quarantined_at + effective_delay > current:
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
