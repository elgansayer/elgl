"""Priority task acquisition, leasing, and cached backlog fallback."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Lock

from openhands_factory.exceptions import FactoryError
from openhands_factory.models import Lease, Task
from openhands_factory.state import atomic_write_json, read_json


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
        self.lease_minutes = lease_minutes
        if factory_generation == "unknown":
            generation = read_json(state_dir / "generation.json", {})
            factory_generation = str(generation.get("identifier", "unknown"))
        self.factory_generation = factory_generation

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

    def leases(self, now: datetime | None = None) -> dict[str, Lease]:
        current = now or datetime.now(UTC)
        payload = read_json(self.lease_path, {"leases": []})
        leases: dict[str, Lease] = {}
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
                leases[item["task_id"]] = Lease(
                    task_id=item["task_id"],
                    owner=item["owner"],
                    acquired_at=datetime.fromisoformat(item["acquired_at"]),
                    expires_at=expires,
                    factory_generation=generation,
                )
        return leases

    def select(self, tasks: list[Task] | None = None) -> Task | None:
        candidates = tasks if tasks is not None else self.cached()
        leased = self.leases()
        available = [task for task in candidates if task.identifier not in leased]
        return min(available, key=lambda task: (task.priority, task.identifier), default=None)

    def acquire(self, task: Task, owner: str, now: datetime | None = None) -> Lease:
        self._assert_generation_current()
        current = now or datetime.now(UTC)
        with self._lease_lock:
            leases = self.leases(current)
            if task.identifier in leases:
                raise ValueError(f"Task {task.identifier} already has an active lease")
            lease = Lease(
                task_id=task.identifier,
                owner=owner,
                acquired_at=current,
                expires_at=current + timedelta(minutes=self.lease_minutes),
                factory_generation=self.factory_generation,
            )
            leases[task.identifier] = lease
            self._write_leases(leases)
            return lease

    def release(self, task_id: str) -> None:
        self._assert_generation_current()
        with self._lease_lock:
            leases = self.leases()
            leases.pop(task_id, None)
            self._write_leases(leases)

    def prune_expired_leases(self, now: datetime | None = None) -> list[str]:
        self._assert_generation_current()
        current = now or datetime.now(UTC)
        with self._lease_lock:
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
                if expires > current and same_generation:
                    active[item["task_id"]] = Lease(
                        task_id=item["task_id"],
                        owner=item["owner"],
                        acquired_at=datetime.fromisoformat(item["acquired_at"]),
                        expires_at=expires,
                        factory_generation=generation,
                    )
                else:
                    expired.append(item["task_id"])
            self._write_leases(active)
            return sorted(expired, key=lambda identifier: (not identifier.isdigit(), identifier))

    def _write_leases(self, leases: dict[str, Lease]) -> None:
        atomic_write_json(
            self.lease_path,
            {
                "leases": [
                    {
                        "task_id": item.task_id,
                        "owner": item.owner,
                        "acquired_at": item.acquired_at.isoformat(),
                        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
                        "factory_generation": item.factory_generation,
                    }
                    for item in leases.values()
                ]
            },
        )
