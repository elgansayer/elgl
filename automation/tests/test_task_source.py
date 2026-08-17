from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.models import Task
from openhands_factory.state import atomic_write_json
from openhands_factory.task_source import TaskStore


def test_priority_and_duplicate_lease_rejection(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    lower = Task("issue-2", "Feature", "body", "github", 3)
    urgent = Task("ci-main", "Broken main", "body", "ci", 1)
    store.cache([lower, urgent])
    assert store.select() == urgent
    store.acquire(urgent, "daemon")
    assert store.select() == lower
    with pytest.raises(ValueError, match="active lease"):
        store.acquire(urgent, "other")


def test_reacquiring_same_task_by_same_owner_is_idempotent(tmp_path: Path) -> None:
    store = TaskStore(tmp_path, lease_minutes=30)
    task = Task("issue-2", "Feature", "body", "github", 3)
    now = datetime.now(UTC)

    original = store.acquire(task, "daemon-a", now)
    repeated = store.acquire(task, "daemon-a", now + timedelta(minutes=5))

    assert repeated == original
    assert store.leases(now + timedelta(minutes=5))[task.identifier] == original


def test_parallel_claims_choose_one_canonical_owner(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    task = Task("issue-2", "Feature", "body", "github", 3)

    def claim(owner: str) -> str:
        try:
            return store.acquire(task, owner).owner
        except ValueError:
            return "lost"

    with ThreadPoolExecutor(max_workers=2) as workers:
        results = list(workers.map(claim, ["daemon-a", "daemon-b"]))

    winners = [owner for owner in results if owner != "lost"]
    assert len(winners) == 1
    assert store.leases()[task.identifier].owner == winners[0]


def test_lease_renewal_preserves_owner_and_acquisition_time(tmp_path: Path) -> None:
    store = TaskStore(tmp_path, lease_minutes=30)
    task = Task("issue-2", "Feature", "body", "github", 3)
    now = datetime.now(UTC)
    original = store.acquire(task, "daemon-a", now)

    renewed = store.renew(task.identifier, "daemon-a", now + timedelta(minutes=20))

    assert renewed.owner == original.owner
    assert renewed.acquired_at == original.acquired_at
    assert renewed.expires_at == now + timedelta(minutes=50)
    with pytest.raises(ValueError, match="belongs to daemon-a"):
        store.renew(task.identifier, "daemon-b", now + timedelta(minutes=21))


def test_triage_tags_round_trip_through_backlog_state(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    task = Task(
        "issue-3",
        "Refactor",
        "body",
        "github",
        2,
        triage_tags=frozenset({"deep-refactor"}),
    )

    store.cache([task])

    assert store.cached() == [task]


def test_stale_lease_is_recovered(tmp_path: Path) -> None:
    store = TaskStore(tmp_path, lease_minutes=1)
    task = Task("issue-1", "Task", "body", "github", 2)
    now = datetime.now(UTC)
    store.acquire(task, "old", now - timedelta(minutes=2))
    assert store.select([task]) == task


def test_parallel_acquisitions_preserve_every_lease(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    tasks = [Task(str(identifier), "Task", "body", "github", 0) for identifier in range(6)]

    with ThreadPoolExecutor(max_workers=6) as workers:
        list(workers.map(lambda task: store.acquire(task, "factory"), tasks))

    assert set(store.leases()) == {task.identifier for task in tasks}


def test_prune_expired_leases_persists_only_active_leases(tmp_path: Path) -> None:
    store = TaskStore(tmp_path, lease_minutes=1)
    now = datetime.now(UTC)
    active = Task("2", "Active", "body", "github", 0)
    store.acquire(active, "current", now)
    atomic_write_json(
        store.lease_path,
        {
            "leases": [
                {
                    "task_id": "1",
                    "owner": "old",
                    "acquired_at": (now - timedelta(minutes=2)).isoformat(),
                    "expires_at": (now - timedelta(minutes=1)).isoformat(),
                },
                {
                    "task_id": "2",
                    "owner": "current",
                    "acquired_at": now.isoformat(),
                    "expires_at": (now + timedelta(minutes=1)).isoformat(),
                },
            ]
        },
    )

    assert store.prune_expired_leases(now) == ["1"]
    assert set(store.leases(now)) == {"2"}
