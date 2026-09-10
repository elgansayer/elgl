from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.controlled_recovery import recover_due_quarantines
from openhands_factory.jobs import JobStore
from openhands_factory.models import JobState
from openhands_factory.state import atomic_write_json


def _write_legacy_quarantine(path: Path, *, quarantined_at: datetime) -> None:
    atomic_write_json(
        path,
        {
            "jobs": [
                {
                    "task": {
                        "identifier": "7036",
                        "title": "Legacy bounded recovery",
                        "body": "",
                        "source": "github-issue",
                        "priority": 0,
                    },
                    "state": "quarantined",
                    "attempts": 4,
                    "repair_attempts": 2,
                    "last_error": "Repository validation failed with the same deterministic error",
                    "failure_counts": {"validation": 4},
                    "last_failure_kind": "validation",
                    "last_failure_fingerprint": "legacy-fingerprint",
                    "repeated_failure_count": 4,
                    "quarantine_reason": "legacy circuit",
                    "quarantined_at": quarantined_at.isoformat(),
                    "quarantine_notification_pending": True,
                    "updated_at": quarantined_at.isoformat(),
                }
            ]
        },
    )


def test_legacy_quarantine_migrates_immediately_to_autonomous_backoff(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    now = datetime.now(UTC)
    _write_legacy_quarantine(path, quarantined_at=now)
    store = JobStore(path, max_repeated_failures=3)

    recovered = recover_due_quarantines(store, now=now)
    restored = store.load()["7036"]

    assert recovered == ["7036"]
    assert restored.state is JobState.DISCOVERED
    assert restored.next_attempt_at is not None
    assert restored.next_attempt_at >= now + timedelta(hours=1)
    assert restored.attempts == 4
    assert restored.repair_attempts == 2
    assert restored.failure_counts == {"validation": 4}
    assert restored.last_failure_fingerprint == "legacy-fingerprint"
    assert restored.repeated_failure_count == 4
    assert restored.last_error is not None
    assert restored.quarantine_reason is None
    assert restored.quarantined_at is None
    assert not restored.quarantine_notification_pending


def test_legacy_quarantine_migration_is_idempotent(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    now = datetime.now(UTC)
    _write_legacy_quarantine(path, quarantined_at=now)
    store = JobStore(path, max_repeated_failures=3)

    assert recover_due_quarantines(store, now=now) == ["7036"]
    first = store.load()["7036"]
    assert recover_due_quarantines(store, now=now + timedelta(minutes=1)) == []
    second = store.load()["7036"]

    assert second.state is JobState.DISCOVERED
    assert second.next_attempt_at == first.next_attempt_at
    assert second.failure_counts == first.failure_counts
    assert second.last_failure_fingerprint == first.last_failure_fingerprint


def test_expired_legacy_quarantine_becomes_runnable_without_manual_release(tmp_path: Path) -> None:
    path = tmp_path / "jobs.json"
    now = datetime.now(UTC)
    _write_legacy_quarantine(path, quarantined_at=now - timedelta(days=2))
    store = JobStore(path, max_repeated_failures=3)

    recovered = recover_due_quarantines(store, now=now)
    restored = store.load()["7036"]

    assert recovered == ["7036"]
    assert restored.state is JobState.DISCOVERED
    assert restored.next_attempt_at is None
