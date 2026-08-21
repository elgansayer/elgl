"""Priority task acquisition, leasing, and cached backlog fallback."""

from __future__ import annotations

import fcntl
import logging
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Lock

from openhands_factory.exceptions import FactoryError
from openhands_factory.models import Lease, Task
from openhands_factory.state import atomic_write_json, read_json

LOGGER = logging.getLogger(__name__)


def _is_backlog_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("tasks"), list)


def _is_lease_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("leases"), list)


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
            validator=_is_backlog_payload,
        )

    def cached(self) -> list[Task]:
        payload = read_json(
            self.backlog_path,
            {"tasks": []},
            validator=_is_backlog_payload,
        )
        tasks: list[Task] = []
        for index, item in enumerate(payload.get("tasks", [])):
            try:
                if not isinstance(item, dict):
                    raise TypeError("task entry is not a mapping")
                tags = item.get("triage_tags", [])
                if not isinstance(tags, list) or not all(isinstance(tag, str) for tag in tags):
                    tags = []
                tasks.append(Task(**{**item, "triage_tags": frozenset(tags)}))
            except (TypeError, ValueError) as error:
                LOGGER.error(
                    "factory.state.task_skipped index=%s error=%s",
                    index,
                    type(error).__name__,
                )
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
        payload = read_json(
            self.lease_path,
            {"leases": []},
            validator=_is_lease_payload,
        )
        leases: LeaseIndex = LeaseIndex()
        for index, item in enumerate(payload.get("leases", [])):
            try:
                lease = self._restore_lease(item)
            except (KeyError, TypeError, ValueError) as error:
                LOGGER.error(
                    "factory.state.lease_skipped index=%s error=%s",
                    index,
                    type(error).__name__,
                )
                continue
            if self._lease_is_active(lease, current) and (
                self.factory_generation == "unknown"
                or lease.factory_generation in {"unknown", self.factory_generation}
            ):
                task_key = lease.task_key or self._task_key(lease.task_id)
                lease.task_key = task_key
                leases[task_key] = lease
        return leases

    def select(self, tasks: list[Task] | None = None) -> Task | None:
        candidates = tasks if tasks is not None else self.cached()
        leased = self.leases()
        available = [task for task in candidates if task.logical_key not in leased]
        return min(available, key=lambda task: (task.priority, task.identifier), default=None)

    def acquire(self, task: Task, owner: str, now: datetime | None = None) -> Lease:
        """Atomically claim a logical task, idempotently for the existing owner."""

        with self._lease_lock, self._exclusive_lease_file_lock():
            current = now or datetime.now(UTC)
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

        with self._lease_lock, self._exclusive_lease_file_lock():
            current = now or datetime.now(UTC)
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
        with self._lease_lock, self._exclusive_lease_file_lock():
            current = now or datetime.now(UTC)
            self._assert_generation_current()
            payload = read_json(
                self.lease_path,
                {"leases": []},
                validator=_is_lease_payload,
            )
            active: dict[str, Lease] = {}
            expired: list[str] = []
            for index, item in enumerate(payload.get("leases", [])):
                try:
                    lease = self._restore_lease(item)
                except (KeyError, TypeError, ValueError) as error:
                    LOGGER.error(
                        "factory.state.lease_skipped index=%s error=%s",
                        index,
                        type(error).__name__,
                    )
                    continue
                same_generation = (
                    self.factory_generation == "unknown"
                    or lease.factory_generation in {"unknown", self.factory_generation}
                )
                if self._lease_is_active(lease, current) and same_generation:
                    task_key = lease.task_key or self._task_key(lease.task_id)
                    lease.task_key = task_key
                    active[task_key] = lease
                else:
                    expired.append(lease.task_id)
            self._write_leases(active)
            return sorted(expired, key=lambda identifier: (not identifier.isdigit(), identifier))

    def _restore_lease(self, item: object) -> Lease:
        if not isinstance(item, dict):
            raise TypeError("lease entry is not a mapping")

        def timestamp(name: str) -> datetime:
            value = item[name]
            if not isinstance(value, str):
                raise TypeError(f"lease {name} is not a timestamp")
            restored = datetime.fromisoformat(value)
            return restored if restored.tzinfo is not None else restored.replace(tzinfo=UTC)

        task_id = item["task_id"]
        owner = item["owner"]
        if not isinstance(task_id, str) or not isinstance(owner, str):
            raise TypeError("lease identity must contain strings")
        task_key = str(item.get("task_key") or self._task_key(task_id))
        return Lease(
            task_id=task_id,
            owner=owner,
            acquired_at=timestamp("acquired_at"),
            expires_at=timestamp("expires_at"),
            factory_generation=str(item.get("factory_generation", "unknown")),
            task_key=task_key,
        )

    def _lease_is_active(self, lease: Lease, current: datetime) -> bool:
        if lease.expires_at is None:
            return False
        maximum_clock_skew = current + timedelta(minutes=1)
        maximum_expiry = maximum_clock_skew + timedelta(minutes=self.lease_minutes)
        return (
            lease.acquired_at <= maximum_clock_skew and current < lease.expires_at <= maximum_expiry
        )

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
            validator=_is_lease_payload,
        )
