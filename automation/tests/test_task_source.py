import json
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.models import Task, logical_task_key
from openhands_factory.state import atomic_write_json
from openhands_factory.task_source import TaskStore


def test_logical_key_is_independent_of_issue_and_pr_numbers() -> None:
    issue = Task("42", "Fix build", "body", "github-issue", 3)
    pull_request = Task(
        "99",
        "Fixes #42: Fix build (#99)",
        "body",
        "github-pull-request",
        3,
    )

    assert issue.logical_key == pull_request.logical_key
    assert issue.logical_key == logical_task_key("Fix build")


def test_explicit_logical_key_survives_substantial_retitle() -> None:
    first = Task(
        "42",
        "Initial wording",
        "Factory-Task-Key: discovery-overlay\n",
        "github-issue",
        3,
    )
    successor = Task(
        "101",
        "Completely different successor title",
        "Logical Task Key: discovery-overlay\n",
        "github-issue",
        3,
    )

    assert first.logical_key == successor.logical_key == "explicit:discovery-overlay"


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


def test_equivalent_tasks_share_one_logical_lease(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    issue = Task("42", "Fix build", "body", "github-issue", 3)
    successor = Task("84", "Fix build", "body", "github-issue", 3)
    store.cache([issue, successor])

    lease = store.acquire(issue, "daemon-a")

    assert lease.task_id == "42"
    assert lease.task_key == issue.logical_key
    assert store.select([successor]) is None
    with pytest.raises(ValueError, match="active lease for 42"):
        store.acquire(successor, "daemon-b")


def test_reacquiring_same_task_by_same_owner_is_idempotent(tmp_path: Path) -> None:
    store = TaskStore(tmp_path, lease_minutes=30)
    task = Task("issue-2", "Feature", "body", "github", 3)
    now = datetime.now(UTC)

    original = store.acquire(task, "daemon-a", now)
    repeated = store.acquire(task, "daemon-a", now + timedelta(minutes=5))

    assert repeated == original
    assert store.leases(now + timedelta(minutes=5))[task.logical_key] == original


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
    assert store.leases()[task.logical_key].owner == winners[0]


def test_lease_renewal_preserves_owner_and_acquisition_time(tmp_path: Path) -> None:
    store = TaskStore(tmp_path, lease_minutes=30)
    task = Task("issue-2", "Feature", "body", "github", 3)
    store.cache([task])
    now = datetime.now(UTC)
    original = store.acquire(task, "daemon-a", now)

    renewed = store.renew(task.identifier, "daemon-a", now + timedelta(minutes=20))

    assert renewed.owner == original.owner
    assert renewed.acquired_at == original.acquired_at
    assert renewed.expires_at == now + timedelta(minutes=50)
    with pytest.raises(ValueError, match="belongs to daemon-a"):
        store.renew(task.identifier, "daemon-b", now + timedelta(minutes=21))


def test_release_by_identifier_resolves_logical_lease(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    task = Task("42", "Fix build", "body", "github-issue", 3)
    store.cache([task])
    store.acquire(task, "daemon")

    store.release("42")

    assert store.leases() == {}


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


def test_parallel_acquisitions_preserve_every_distinct_logical_lease(tmp_path: Path) -> None:
    store = TaskStore(tmp_path)
    tasks = [
        Task(str(identifier), f"Task {identifier}", "body", "github", 0) for identifier in range(6)
    ]

    with ThreadPoolExecutor(max_workers=6) as workers:
        list(workers.map(lambda task: store.acquire(task, "factory"), tasks))

    assert set(store.leases()) == {task.logical_key for task in tasks}


def test_near_future_lease_survives_tolerated_clock_skew(tmp_path: Path) -> None:
    store = TaskStore(tmp_path, lease_minutes=30)
    now = datetime.now(UTC)
    first = Task("1", "First task", "body", "github", 0)
    second = Task("2", "Second task", "body", "github", 0)

    store.acquire(first, "factory", now + timedelta(seconds=30))
    store.acquire(second, "factory", now)

    assert set(store.leases(now)) == {first.logical_key, second.logical_key}


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


def test_legacy_identifier_lease_migrates_to_logical_key_when_backlog_is_known(
    tmp_path: Path,
) -> None:
    store = TaskStore(tmp_path, lease_minutes=30)
    task = Task("42", "Fix build", "body", "github-issue", 3)
    store.cache([task])
    now = datetime.now(UTC)

    atomic_write_json(
        store.lease_path,
        {
            "leases": [
                {
                    "task_id": "42",
                    "owner": "legacy",
                    "acquired_at": now.isoformat(),
                    "expires_at": (now + timedelta(minutes=30)).isoformat(),
                }
            ]
        },
    )

    leases = store.leases(now)

    assert set(leases) == {task.logical_key}
    assert leases[task.logical_key].task_id == "42"
    assert leases[task.logical_key].task_key == task.logical_key


def test_malformed_task_and_lease_entries_do_not_hide_valid_siblings(
    tmp_path: Path,
    caplog,
) -> None:
    now = datetime.now(UTC)
    store = TaskStore(tmp_path)
    store.backlog_path.write_text(
        json.dumps(
            {
                "tasks": [
                    {
                        "identifier": "3",
                        "title": "Valid",
                        "body": "",
                        "source": "github-issue",
                        "priority": 0,
                    },
                    {"identifier": "broken"},
                ]
            }
        ),
        encoding="utf-8",
    )
    store.lease_path.write_text(
        json.dumps(
            {
                "leases": [
                    {
                        "task_id": "3",
                        "owner": "factory",
                        "acquired_at": now.isoformat(),
                        "expires_at": (now + timedelta(minutes=5)).isoformat(),
                    },
                    {"task_id": "broken", "expires_at": "not-a-date"},
                ]
            }
        ),
        encoding="utf-8",
    )

    assert [task.identifier for task in store.cached()] == ["3"]
    valid = store.cached()[0]
    assert set(store.leases(now)) == {valid.logical_key}
    assert "factory.state.task_skipped" in caplog.text
    assert "factory.state.lease_skipped" in caplog.text


def test_corrupt_far_future_task_lease_does_not_suppress_work(tmp_path: Path) -> None:
    now = datetime.now(UTC)
    task = Task("4", "Recoverable", "body", "github", 0)
    store = TaskStore(tmp_path, lease_minutes=5)
    atomic_write_json(
        store.lease_path,
        {
            "leases": [
                {
                    "task_id": task.identifier,
                    "owner": "corrupt",
                    "acquired_at": now.isoformat(),
                    "expires_at": (now + timedelta(days=365)).isoformat(),
                }
            ]
        },
    )

    assert store.select([task]) == task
    assert store.prune_expired_leases(now) == [task.identifier]
