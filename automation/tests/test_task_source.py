from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.models import Task
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
