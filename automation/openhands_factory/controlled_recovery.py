"""Compatibility migration for legacy persisted stopped-task state."""

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
    """Move legacy stopped jobs into the normal autonomous retry queue."""

    del recovery_delay
    current = now or datetime.now(UTC)
    recovered: list[str] = []
    with store._process_lock, store.file_lock:
        store._assert_generation_current()
        jobs = store._load(migrate_legacy_quarantine=False)
        for task_id, job in jobs.items():
            if job.state is not JobState.QUARANTINED:
                continue
            store._resume_legacy_quarantine(job, current)
            recovered.append(task_id)
        if recovered:
            store._save_raw(jobs)
    return sorted(recovered, key=lambda identifier: (not identifier.isdigit(), identifier))
