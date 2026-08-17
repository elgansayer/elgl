"""Priority task acquisition, leasing, and cached backlog fallback."""

from __future__ import annotations

import fcntl
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Lock

from openhands_factory.exceptions import FactoryError
from openhands_factory.models import Lease, Task
from openhands_factory.state import atomic_write_json, read_json


class LeaseIndex(dict[str, Lease]):
    """Logical-key lease mapping with legacy task-id lookup compatibility.

    Iteration and membership remain canonical logical-key operations, so scheduling
    cannot accidentally treat two equivalent GitHub objects as separate work. Direct
    indexed lookup by the original task identifier remains supported for diagnostics
    and older callers during the rolling state-format migration.
    """

    def __missing__(self, key: str) -> Lease:
        for lease in self.values():
            if lease.task_id == key:
                return lease
        raise KeyError(key)


class TaskStore:
    _lease_lock = Lock()

    def __init__(
        self,
        state_dir: Path,
        lease_minutes: int = 180,
        factory_generation: str = "unknown",
    ) -> None:
        self.state_dir = state_dir
        self.backlog_path = state_dir / "backlog.json"
        self.lease_path = state_dir / "leases.json"
        self.lease_lock_path = state_dir / "leases.lock"
        self.lease_minutes = lease_minutes
        if factory_generation == "unknown":
            generation = read_json(state_dir / "generation.json", {})
            factory_generation = str(generation.get("identifier", "unknown"))
        self.factory_generation = factory_generation

    @contextmanager
    def _exclusive_lease_file_lock(self) -> Iterator[None]:
        """Serialize lease compare-and-swap across daemon processes.

        The in-process lock prevents sibling worker threads from racing, while the
        advisory file lock prevents two Factory processes that share the durable
        state directory from both observing an unclaimed task and writing competing
        owners. The generation fence is rechecked while this lock is held by every
        lease mutation so a superseded daemon cannot win a check/write race.
        """

        self.state_dir.mkdir(parents=True, exist_ok=True)
        with self.lease_lock_path.open("a+", encoding="utf-8") as lock_file:
            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
            try:
                yield
            finally:
                fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)

    def _assert_generation_current(self) -> None:
        if self.factory_generation == "unknown":
            return
        generation = read_json(self.state_dir / "generation.json", {})
        if generation.get("identifier") != self.factory_generation:
            raise FactoryError("Stale Factory generation cannot mutate durable task leases")

    def cache(self, tasks: list[Task]) -> None:
        self._assert_generation_current()
        atomic_write_json(
            self.backlog_path,
            {
                "tasks": [
                    {
                        **task.__dict__,
                        "triage_tags": sorted(task.triage_tags),
                    }
                    for task in tasks
                ]
            },
        )

    def cached(self) -> list[Task]:
        payload = read_json(self.backlog_path, {"tasks": []})
        tasks: list[Task] = []
        for item in payload.get("tasks", []):
            tags = item.get("triage_tags", [])
            if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
                tags = []
            tasks.append(Task(**{**item, "triage_tags": frozenset(tags)}))
        return tasks

    def _task_key(self, task_or_id: Task | str) -> str:
        """Resolve an object identifier to its stable logical lease identity.

        Existing callers release/renew by GitHub identifier, so resolve through the
        cached backlog. If no cached task exists, retain the legacy identifier. That
        fallback lets old lease state be pruned or released during rolling upgrades.
        """

        if isinstance(task_or_id, Task):
            return task_or_id.logical_key
        for task in self.cached():
            if task.identifier == task_or_id:
                return task.logical_key
        return task_or_id

    def leases(self, now: datetime | None = None) -> dict[str, Lease]:
        current = now or datetime.now(UTC)
        payload = read_json(self.lease_path, {"leases": []})
        leases: LeaseIndex = LeaseIndex()
        for item in payload.get("leases", []):
            expires = datetime.fromisoformat(item["expires_at"])
            generation = str(item.get("factory_generation", "unknown"))
            if (
                expires > current
                and (
                    self.factory_generation == "unknown"
                    or generation in {"unknown", self.factory_generation}
                )
            ):
                task_id = str(item["task_id"])
                task_key = str(item.get("task_key") or self._task_key(task_id))
                leases[task_key] = Lease(
                    task_id=task_id,
                    owner=item["owner"],
                    acquired_at=datetime.fromisoformat(item["acquired_at"]),
                    expires_at=expires,
                    factory_generation=generation,
                    task_key=task_key,
                )
        return leases

    def select(self, tasks: list[Task] | None = None) -> Task | None:
        candidates = tasks if tasks is not None else self.cached()
        leased = self.leases()
        available = [task for task in candidates if task.logical_key not in leased]
        return min(available, key=lambda task: (task.priority, task.identifier), default=None)

    def acquire(self, task: Task, owner: str, now: datetime | None = None) -> Lease:
        """Atomically claim a logical task, idempotently for the existing owner."""

        current = now or datetime.now(UTC)
        with self._lease_lock, self._exclusive_lease_file_lock():
            self._assert_generation_current()
            leases = self.leases(current)
            task_key = task.logical_key
            existing = leases.get(task_key)
            if existing is not None:
                if existing.owner == owner:
                    return existing
                raise ValueError(
                    f"Logical task {task_key} already has an active lease for {existing.task_id}"
                )
            lease = Lease(
                task_id=task.identifier,
                owner=owner,
                acquired_at=current,
                expires_at=current + timedelta(minutes=self.lease_minutes),
                factory_generation=self.factory_generation,
                task_key=task_key,
            )
            leases[task_key] = lease
            self._write_leases(leases)
            return lease

    def renew(self, task_id: str, owner: str, now: datetime | None = None) -> Lease:
        """Renew an active lease only when the durable logical owner still matches."""

        current = now or datetime.now(UTC)
        with self._lease_lock, self._exclusive_lease_file_lock():
            self._assert_generation_current()
            leases = self.leases(current)
            task_key = self._task_key(task_id)
            existing = leases.get(task_key)
            if existing is None:
                raise ValueError(f"Task {task_id} does not have an active lease")
            if existing.owner != owner:
                raise ValueError(
                    f"Task {task_id} lease belongs to {existing.owner}, not {owner}",
                )
            renewed = Lease(
                task_id=existing.task_id,
                owner=existing.owner,
                acquired_at=existing.acquired_at,
                expires_at=current + timedelta(minutes=self.lease_minutes),
                factory_generation=self.factory_generation,
                task_key=task_key,
            )
            leases[task_key] = renewed
            self._write_leases(leases)
            return renewed

    def release(self, task_id: str) -> None:
        with self._lease_lock, self._exclusive_lease_file_lock():
            self._assert_generation_current()
            leases = self.leases()
            leases.pop(self._task_key(task_id), None)
            self._write_leases(leases)

    def prune_expired_leases(self, now: datetime | None = None) -> list[str]:
        current = now or datetime.now(UTC)
        with self._lease_lock, self._exclusive_lease_file_lock():
            self._assert_generation_current()
            payload = read_json(self.lease_path, {"leases": []})
            active: dict[str, Lease] = {}
            expired: list[str] = []
            for item in payload.get("leases", []):
                expires = datetime.fromisoformat(item["expires_at"])
                generation = str(item.get("factory_generation", "unknown"))
                same_generation = (
                    self.factory_generation == "unknown"
                    or generation in {"unknown", self.factory_generation}
                )
                task_id = str(item["task_id"])
                task_key = str(item.get("task_key") or self._task_key(task_id))
                if expires > current and same_generation:
                    active[task_key] = Lease(
                        task_id=task_id,
                        owner=item["owner"],
                        acquired_at=datetime.fromisoformat(item["acquired_at"]),
                        expires_at=expires,
                        factory_generation=generation,
                        task_key=task_key,
                    )
                else:
                    expired.append(task_id)
            self._write_leases(active)
            return sorted(expired, key=lambda identifier: (not identifier.isdigit(), identifier))

    def _write_leases(self, leases: dict[str, Lease]) -> None:
        atomic_write_json(
            self.lease_path,
            {
                "leases": [
                    {
                        "task_id": item.task_id,
                        "task_key": item.task_key or self._task_key(item.task_id),
                        "owner": item.owner,
                        "acquired_at": item.acquired_at.isoformat(),
                        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
                        "factory_generation": item.factory_generation,
                    }
                    for item in leases.values()
                ]
            },
        )
