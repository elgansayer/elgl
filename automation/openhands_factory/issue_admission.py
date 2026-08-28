"""Durable admission control for newly discovered GitHub issues."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any

from openhands_factory.state import atomic_write_json, read_json

_STATE_VERSION = 1


@dataclass(frozen=True)
class IssueAdmission:
    task_id: str
    admitted_at: datetime


class IssueAdmissionGate:
    """Rate-limit only first-time issue admission while preserving pipeline progress.

    The Factory advances one durable state transition per scheduler dispatch. Applying
    an hourly delay to every dispatch would therefore make implementation, review, CI
    repair, and merge polling unnecessarily slow. This gate is consulted only for a
    GitHub issue which is still in ``DISCOVERED``.
    """

    def __init__(
        self,
        path: Path,
        *,
        interval_seconds: int,
        max_admissions: int = 1,
    ) -> None:
        if interval_seconds < 0:
            raise ValueError("issue admission interval cannot be negative")
        if max_admissions <= 0:
            raise ValueError("issue admissions per interval must be positive")
        self.path = path
        self.interval = timedelta(seconds=interval_seconds)
        self.max_admissions = max_admissions

    @property
    def enabled(self) -> bool:
        return self.interval.total_seconds() > 0

    def available_slots(self, now: datetime | None = None) -> int | None:
        """Return available admissions, or ``None`` when admission limiting is disabled."""

        if not self.enabled:
            return None
        active = self._active_admissions(now or datetime.now(UTC))
        return max(0, self.max_admissions - len(active))

    def admit(self, task_id: str, now: datetime | None = None) -> bool:
        """Persist an admission before worker submission.

        Persisting first makes the limit restart-safe. A daemon crash can delay an issue,
        but cannot accidentally admit a second issue inside the configured interval.
        """

        if not self.enabled:
            return True
        current = now or datetime.now(UTC)
        active = self._active_admissions(current)
        if len(active) >= self.max_admissions:
            return False
        active.append(IssueAdmission(task_id=task_id, admitted_at=current))
        self._write(active)
        return True

    def snapshot(self, now: datetime | None = None) -> dict[str, object]:
        current = now or datetime.now(UTC)
        if not self.enabled:
            return {
                "enabled": False,
                "interval_seconds": 0,
                "max_admissions": self.max_admissions,
                "available_slots": None,
                "next_available_at": None,
                "active_admissions": [],
            }
        active = self._active_admissions(current)
        available = max(0, self.max_admissions - len(active))
        next_available_at = None
        if available == 0 and active:
            next_available_at = min(item.admitted_at for item in active) + self.interval
        return {
            "enabled": True,
            "interval_seconds": int(self.interval.total_seconds()),
            "max_admissions": self.max_admissions,
            "available_slots": available,
            "next_available_at": (
                next_available_at.isoformat() if next_available_at is not None else None
            ),
            "active_admissions": [
                {
                    "task_id": item.task_id,
                    "admitted_at": item.admitted_at.isoformat(),
                }
                for item in active
            ],
        }

    def _active_admissions(self, now: datetime) -> list[IssueAdmission]:
        payload = read_json(
            self.path,
            {"version": _STATE_VERSION, "admissions": []},
            validator=self._valid_payload,
        )
        admissions = [
            IssueAdmission(
                task_id=str(item["task_id"]),
                admitted_at=datetime.fromisoformat(str(item["admitted_at"])),
            )
            for item in payload["admissions"]
        ]
        cutoff = now - self.interval
        active = [item for item in admissions if item.admitted_at > cutoff]
        if active != admissions:
            self._write(active)
        return active

    def _write(self, admissions: list[IssueAdmission]) -> None:
        atomic_write_json(
            self.path,
            {
                "version": _STATE_VERSION,
                "admissions": [
                    {
                        "task_id": item.task_id,
                        "admitted_at": item.admitted_at.isoformat(),
                    }
                    for item in admissions
                ],
            },
            validator=self._valid_payload,
        )

    @staticmethod
    def _valid_payload(value: Any) -> bool:
        if not isinstance(value, dict) or value.get("version") != _STATE_VERSION:
            return False
        admissions = value.get("admissions")
        if not isinstance(admissions, list):
            return False
        for item in admissions:
            if not isinstance(item, dict) or not isinstance(item.get("task_id"), str):
                return False
            admitted_at = item.get("admitted_at")
            if not isinstance(admitted_at, str):
                return False
            parsed = datetime.fromisoformat(admitted_at)
            if parsed.tzinfo is None:
                return False
        return True
