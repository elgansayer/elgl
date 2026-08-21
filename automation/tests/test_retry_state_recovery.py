import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.jobs import MAX_PERSISTED_RETRY_DELAY, JobStore
from openhands_factory.models import FailureKind, Job, JobState, Task


def _job() -> Job:
    job = Job(Task("7036", "Bound retries", "Body", "github-issue", 0))
    job.state = JobState.IMPLEMENTING
    job.failure_counts = {FailureKind.RATE_LIMIT.value: 3}
    job.last_failure_kind = FailureKind.RATE_LIMIT.value
    job.last_failure_fingerprint = "stable-fingerprint"
    job.repeated_failure_count = 3
    return job


def test_malformed_persisted_cooldown_becomes_immediately_retryable(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    store = JobStore(path)
    job = _job()
    store.save({job.task.identifier: job})

    payload = json.loads(path.read_text())
    payload["jobs"][0]["next_attempt_at"] = "not-a-timestamp"
    path.write_text(json.dumps(payload))

    restored = store.load()[job.task.identifier]

    assert restored.next_attempt_at is None
    assert restored.failure_counts == {FailureKind.RATE_LIMIT.value: 3}
    assert restored.last_failure_fingerprint == "stable-fingerprint"
    assert restored.repeated_failure_count == 3


def test_timezone_naive_persisted_cooldown_becomes_immediately_retryable() -> None:
    now = datetime(2026, 8, 17, 0, 0, tzinfo=UTC)

    restored = JobStore._load_next_attempt_at("2026-08-17T01:00:00", now)

    assert restored is None


def test_implausibly_distant_persisted_cooldown_is_bounded_to_one_day() -> None:
    now = datetime(2026, 8, 17, 0, 0, tzinfo=UTC)
    corrupted = (now + timedelta(days=365)).isoformat()

    restored = JobStore._load_next_attempt_at(corrupted, now)

    assert restored == now + MAX_PERSISTED_RETRY_DELAY


def test_valid_persisted_cooldown_is_preserved_in_utc() -> None:
    now = datetime(2026, 8, 17, 0, 0, tzinfo=UTC)

    restored = JobStore._load_next_attempt_at("2026-08-17T02:00:00+02:00", now)

    assert restored == now
