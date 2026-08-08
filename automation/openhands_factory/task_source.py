"""Priority task acquisition, leasing, and cached backlog fallback."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.models import Lease, Task
from openhands_factory.state import atomic_write_json, read_json


class TaskStore:
    def __init__(self, state_dir: Path, lease_minutes: int = 180) -> None:
        self.backlog_path = state_dir / "backlog.json"
        self.lease_path = state_dir / "leases.json"
        self.lease_minutes = lease_minutes

    def cache(self, tasks: list[Task]) -> None:
        atomic_write_json(self.backlog_path, {"tasks": [task.__dict__ for task in tasks]})

    def cached(self) -> list[Task]:
        payload = read_json(self.backlog_path, {"tasks": []})
        return [Task(**item) for item in payload.get("tasks", [])]

    def leases(self, now: datetime | None = None) -> dict[str, Lease]:
        current = now or datetime.now(UTC)
        payload = read_json(self.lease_path, {"leases": []})
        leases: dict[str, Lease] = {}
        for item in payload.get("leases", []):
            expires = datetime.fromisoformat(item["expires_at"])
            if expires > current:
                leases[item["task_id"]] = Lease(
                    task_id=item["task_id"],
                    owner=item["owner"],
                    acquired_at=datetime.fromisoformat(item["acquired_at"]),
                    expires_at=expires,
                )
        return leases

    def select(self, tasks: list[Task] | None = None) -> Task | None:
        candidates = tasks if tasks is not None else self.cached()
        leased = self.leases()
        available = [task for task in candidates if task.identifier not in leased]
        return min(available, key=lambda task: (task.priority, task.identifier), default=None)

    def acquire(self, task: Task, owner: str, now: datetime | None = None) -> Lease:
        current = now or datetime.now(UTC)
        leases = self.leases(current)
        if task.identifier in leases:
            raise ValueError(f"Task {task.identifier} already has an active lease")
        lease = Lease(
            task_id=task.identifier,
            owner=owner,
            acquired_at=current,
            expires_at=current + timedelta(minutes=self.lease_minutes),
        )
        leases[task.identifier] = lease
        atomic_write_json(
            self.lease_path,
            {
                "leases": [
                    {
                        "task_id": item.task_id,
                        "owner": item.owner,
                        "acquired_at": item.acquired_at.isoformat(),
                        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
                    }
                    for item in leases.values()
                ]
            },
        )
        return lease

    def release(self, task_id: str) -> None:
        leases = self.leases()
        leases.pop(task_id, None)
        atomic_write_json(
            self.lease_path,
            {
                "leases": [
                    {
                        "task_id": item.task_id,
                        "owner": item.owner,
                        "acquired_at": item.acquired_at.isoformat(),
                        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
                    }
                    for item in leases.values()
                ]
            },
        )
