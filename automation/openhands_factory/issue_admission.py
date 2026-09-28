"""Restart-safe admission control for expensive Factory work."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from math import ceil
from pathlib import Path
from typing import Any

from filelock import FileLock

from openhands_factory.state import atomic_write_json, read_json

_STATE_VERSION = 1
_HEAD_STABILITY_STATE_VERSION = 1
_HEAD_STABILITY_RETENTION = timedelta(days=7)


@dataclass(frozen=True)
class Admission:
    task_id: str
    admitted_at: datetime


@dataclass(frozen=True)
class ReviewHeadObservation:
    task_id: str
    head_sha: str
    observed_at: datetime


# Backwards-compatible name retained for callers/tests which imported the old
# issue-specific record directly.
IssueAdmission = Admission


class DurableAdmissionGate:
    """Persist a sliding-window admission budget before expensive work starts.

    The gate is deliberately generic so issue intake and independent PR reviews
    share exactly the same restart-safe accounting. Persisting an admission before
    worker submission means a daemon crash may conservatively delay work, but can
    never reset the budget and accidentally launch an extra agent invocation.
    """

    def __init__(
        self,
        path: Path,
        *,
        interval_seconds: int,
        max_admissions: int = 1,
    ) -> None:
        if interval_seconds < 0:
            raise ValueError("admission interval cannot be negative")
        if max_admissions <= 0:
            raise ValueError("admissions per interval must be positive")
        self.path = path
        self.lock = FileLock(str(path) + ".lock")
        self.interval = timedelta(seconds=interval_seconds)
        self.max_admissions = max_admissions

    @property
    def enabled(self) -> bool:
        return self.interval.total_seconds() > 0

    def available_slots(self, now: datetime | None = None) -> int | None:
        """Return available admissions, or ``None`` when limiting is disabled."""

        if not self.enabled:
            return None
        with self.lock:
            active = self._active_admissions(now or datetime.now(UTC))
            return max(0, self.max_admissions - len(active))

    def admit(self, task_id: str, now: datetime | None = None) -> bool:
        """Persist an admission before worker submission."""

        if not self.enabled:
            return True
        current = now or datetime.now(UTC)
        with self.lock:
            active = self._active_admissions(current)
            if len(active) >= self.max_admissions:
                return False
            active.append(Admission(task_id=task_id, admitted_at=current))
            self._write(active)
            return True

    def revoke(self, task_id: str, admitted_at: datetime, now: datetime | None = None) -> bool:
        """Remove one exact admission when coupled pre-start admission fails."""

        if not self.enabled:
            return False
        current = now or datetime.now(UTC)
        with self.lock:
            active = self._active_admissions(current)
            for index, admission in enumerate(active):
                if admission.task_id == task_id and admission.admitted_at == admitted_at:
                    del active[index]
                    self._write(active)
                    return True
            return False

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
        with self.lock:
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

    def _active_admissions(self, now: datetime) -> list[Admission]:
        payload = read_json(
            self.path,
            {"version": _STATE_VERSION, "admissions": []},
            validator=self._valid_payload,
        )
        admissions = [
            Admission(
                task_id=str(item["task_id"]),
                admitted_at=datetime.fromisoformat(str(item["admitted_at"])),
            )
            for item in payload["admissions"]
        ]
        cutoff = now - self.interval
        active: list[Admission] = []
        changed = False
        for admission in admissions:
            if admission.admitted_at <= cutoff:
                changed = True
                continue
            if admission.admitted_at > now:
                # Clock correction or damaged durable state must not push an
                # allowance window arbitrarily far into the future. Clamp the
                # admission to the current clock instead of dropping it so the
                # budget remains conservative for exactly one configured interval.
                active.append(Admission(task_id=admission.task_id, admitted_at=now))
                changed = True
                continue
            active.append(admission)
        if changed:
            self._write(active)
        return active

    def _write(self, admissions: list[Admission]) -> None:
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
            try:
                parsed = datetime.fromisoformat(admitted_at)
            except ValueError:
                return False
            if parsed.tzinfo is None:
                return False
        return True


class IssueAdmissionGate(DurableAdmissionGate):
    """Rate-limit first-time GitHub issue admission while existing work progresses."""


class ReviewAdmissionGate(DurableAdmissionGate):
    """Rate-limit independent PR reviews and suppress same-SHA repeat reviews."""

    def admit(self, task_id: str, now: datetime | None = None) -> bool:
        if not self.enabled:
            return True
        current = now or datetime.now(UTC)
        with self.lock:
            active = self._active_admissions(current)
            if any(item.task_id == task_id for item in active):
                return False
            if len(active) >= self.max_admissions:
                return False
            active.append(Admission(task_id=task_id, admitted_at=current))
            self._write(active)
            return True


class ReviewHeadStabilityGate:
    """Debounce provider-managed PR heads before subscription-backed review.

    A review is useful only for a head that survives long enough to be a realistic
    merge candidate. External agents can publish several commits in quick succession;
    reviewing every intermediate SHA spends review allowance and immediately makes the
    result stale. This gate records only content-free PR identity, SHA, and timestamp,
    and requires the same SHA to remain observed for a bounded quiet period.

    Deferral is entirely machine-owned. A changed head resets the timer; an unchanged
    head becomes eligible automatically. No review admission or provider-route budget
    is consumed while the head is moving.
    """

    def __init__(self, path: Path, *, quiet_seconds: int) -> None:
        if quiet_seconds < 0:
            raise ValueError("review head stability period cannot be negative")
        self.path = path
        self.quiet_period = timedelta(seconds=quiet_seconds)
        self.lock = FileLock(str(path) + ".lock")

    @property
    def enabled(self) -> bool:
        return self.quiet_period.total_seconds() > 0

    def defer_seconds(
        self,
        task_id: str,
        head_sha: str,
        now: datetime | None = None,
    ) -> int:
        """Return seconds until this exact head is stable, or zero when eligible."""

        if not self.enabled:
            return 0
        if not task_id or not head_sha:
            raise ValueError("review head stability requires task identity and exact head SHA")

        current = now or datetime.now(UTC)
        with self.lock:
            observations = self._observations(current)
            previous = observations.get(task_id)
            if previous is None or previous.head_sha != head_sha:
                observations[task_id] = ReviewHeadObservation(task_id, head_sha, current)
                self._write_observations(observations.values())
                return max(1, ceil(self.quiet_period.total_seconds()))

            ready_at = previous.observed_at + self.quiet_period
            remaining = (ready_at - current).total_seconds()
            if remaining <= 0:
                return 0
            return max(1, ceil(remaining))

    def _observations(self, now: datetime) -> dict[str, ReviewHeadObservation]:
        payload = read_json(
            self.path,
            {"version": _HEAD_STABILITY_STATE_VERSION, "observations": []},
            validator=self._valid_observation_payload,
        )
        # Keep each observation through its configured quiet period, then retain
        # it for the normal cleanup window. Using only the larger duration would
        # prune observations as soon as a long quiet period elapsed, causing the
        # same unchanged head to be observed again and deferred indefinitely.
        cutoff = now - (self.quiet_period + _HEAD_STABILITY_RETENTION)
        observations: dict[str, ReviewHeadObservation] = {}
        pruned = False
        for item in payload["observations"]:
            observed_at = datetime.fromisoformat(str(item["observed_at"]))
            # Treat future-dated observations as stale state rather than allowing
            # clock skew or damaged state to defer autonomous review indefinitely.
            # The next call records the same exact head at the current trusted clock
            # and starts only the configured bounded quiet period again.
            if observed_at <= cutoff or observed_at > now:
                pruned = True
                continue
            observation = ReviewHeadObservation(
                task_id=str(item["task_id"]),
                head_sha=str(item["head_sha"]),
                observed_at=observed_at,
            )
            existing = observations.get(observation.task_id)
            if existing is None or observation.observed_at > existing.observed_at:
                observations[observation.task_id] = observation
        if pruned:
            self._write_observations(observations.values())
        return observations

    def _write_observations(self, observations: Any) -> None:
        ordered = sorted(observations, key=lambda item: item.task_id)
        atomic_write_json(
            self.path,
            {
                "version": _HEAD_STABILITY_STATE_VERSION,
                "observations": [
                    {
                        "task_id": item.task_id,
                        "head_sha": item.head_sha,
                        "observed_at": item.observed_at.isoformat(),
                    }
                    for item in ordered
                ],
            },
            validator=self._valid_observation_payload,
        )

    @staticmethod
    def _valid_observation_payload(value: Any) -> bool:
        if not isinstance(value, dict) or value.get("version") != _HEAD_STABILITY_STATE_VERSION:
            return False
        observations = value.get("observations")
        if not isinstance(observations, list):
            return False
        for item in observations:
            if not isinstance(item, dict):
                return False
            if not isinstance(item.get("task_id"), str) or not item["task_id"]:
                return False
            if not isinstance(item.get("head_sha"), str) or not item["head_sha"]:
                return False
            observed_at = item.get("observed_at")
            if not isinstance(observed_at, str):
                return False
            try:
                parsed = datetime.fromisoformat(observed_at)
            except ValueError:
                return False
            if parsed.tzinfo is None:
                return False
        return True
