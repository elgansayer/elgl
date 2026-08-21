from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.jobs import MAX_PERSISTED_RETRY_DELAY, JobStore
from openhands_factory.models import JobState, Task


def test_bulk_save_routes_new_failure_through_retry_policy(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("7036", "Retry policy authority", "", "github-issue", 0)
    jobs = store.reconcile([task])
    job = jobs[task.identifier]
    job.state = JobState.IMPLEMENTING
    job.attempts = 1
    job.last_error = "429 Too Many Requests from provider"
    job.updated_at = datetime.now(UTC)
    # Simulate the legacy pipeline-level scheduler trying to persist a cooldown
    # outside the canonical retry policy. JobStore must replace it.
    job.next_attempt_at = job.updated_at + timedelta(days=30)

    store.save(jobs)
    restored = store.load()[task.identifier]

    assert restored.last_failure_kind == "rate-limit"
    assert restored.last_failure_fingerprint is not None
    assert restored.failure_counts == {"rate-limit": 1}
    assert restored.repeated_failure_count == 1
    assert restored.next_attempt_at is not None
    assert restored.next_attempt_at <= datetime.now(UTC) + MAX_PERSISTED_RETRY_DELAY


def test_resaving_same_failed_snapshot_does_not_double_count_retry(tmp_path: Path) -> None:
    store = JobStore(tmp_path / "jobs.json")
    task = Task("7036", "Retry policy authority", "", "github-issue", 0)
    jobs = store.reconcile([task])
    job = jobs[task.identifier]
    job.state = JobState.IMPLEMENTING
    job.attempts = 2
    job.last_error = "Conversation exceeded the maximum task duration"
    job.updated_at = datetime.now(UTC)

    store.save(jobs)
    first = store.load()[task.identifier]
    first_next_attempt = first.next_attempt_at
    first_counts = dict(first.failure_counts)
    first_repeated = first.repeated_failure_count

    # Reconciliation and whole-snapshot persistence can write an unchanged failed
    # job repeatedly. That must not be interpreted as another provider attempt.
    store.save(store.load())
    second = store.load()[task.identifier]

    assert second.failure_counts == first_counts
    assert second.repeated_failure_count == first_repeated
    assert second.next_attempt_at == first_next_attempt
