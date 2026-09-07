"""Priority task acquisition, leasing, and cached backlog fallback."""

from __future__ import annotations

import fcntl
import logging
from collections.abc import Callable, Iterator
from contextlib import contextmanager
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import Lock

from openhands_factory.exceptions import FactoryError
from openhands_factory.models import Lease, Task, supersession_references
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


class TaskClaimConflict(ValueError):
    """A logical task is already owned by another canonical task or worker."""

    def __init__(self, claim: Lease) -> None:
        self.claim = claim
        if claim.owner is not None:
            detail = f"an active lease for {claim.task_id} owned by {claim.owner}"
        else:
            detail = f"a canonical claim for {claim.task_id}"
        super().__init__(f"Logical task {claim.task_key or claim.task_id} already has {detail}")


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

    def claims(self, now: datetime | None = None) -> LeaseIndex:
        """Restore persistent canonical claims, including released or expired leases."""

        current = now or datetime.now(UTC)
        payload = read_json(
            self.lease_path,
            {"leases": []},
            validator=_is_lease_payload,
        )
        claims: LeaseIndex = LeaseIndex()
        for index, item in enumerate(payload.get("leases", [])):
            try:
                claim = self._restore_lease(item)
            except (KeyError, TypeError, ValueError) as error:
                LOGGER.error(
                    "factory.state.lease_skipped index=%s error=%s",
                    index,
                    type(error).__name__,
                )
                continue
            task_key = claim.task_key or self._task_key(claim.task_id)
            claim.task_key = task_key
            existing = claims.get(task_key)
            if existing is None or self._claim_rank(claim, current) < self._claim_rank(
                existing, current
            ):
                if existing is not None:
                    LOGGER.error(
                        "factory.state.duplicate_claim_recovered task_key=%s canonical_task=%s",
                        task_key,
                        claim.task_id,
                    )
                claims[task_key] = claim
        return claims

    def leases(self, now: datetime | None = None) -> LeaseIndex:
        current = now or datetime.now(UTC)
        leases: LeaseIndex = LeaseIndex()
        for task_key, claim in self.claims(current).items():
            if self._lease_is_active_for_generation(claim, current):
                leases[task_key] = claim
        return leases

    def select(self, tasks: list[Task] | None = None) -> Task | None:
        candidates = tasks if tasks is not None else self.cached()
        current = datetime.now(UTC)
        claims = self.claims(current)
        available = []
        for task in candidates:
            claim = claims.get(task.logical_key)
            if claim is None:
                available.append(task)
                continue
            if claim.task_id == task.identifier:
                if claim.completed_at is None and not self._lease_is_active_for_generation(
                    claim, current
                ):
                    available.append(task)
                continue
            if self._can_take_over(claim, task, current):
                available.append(task)
        return min(available, key=lambda task: (task.priority, task.identifier), default=None)

    def acquire(
        self,
        task: Task,
        owner: str,
        now: datetime | None = None,
        *,
        producer_identity: str | None = None,
    ) -> Lease:
        """Atomically claim a logical task and one bounded worker lease."""

        with self._lease_lock, self._exclusive_lease_file_lock():
            current = now or datetime.now(UTC)
            self._assert_generation_current()
            claims = self.claims(current)
            task_key = task.logical_key
            existing = claims.get(task_key)
            if existing is not None:
                if existing.task_id != task.identifier:
                    if not self._can_take_over(existing, task, current):
                        raise TaskClaimConflict(existing)
                    existing = Lease(
                        task_id=task.identifier,
                        task_key=task_key,
                        owner=None,
                        acquired_at=current,
                        expires_at=current,
                        factory_generation=self.factory_generation,
                        claimed_at=current,
                        producer_identity=producer_identity or owner,
                        predecessor_pull_request=(
                            existing.canonical_pull_request
                            or existing.successor_pull_request
                            or existing.predecessor_pull_request
                        ),
                        predecessor_task_id=existing.task_id,
                        failure_fingerprint=existing.failure_fingerprint,
                    )
                elif existing.completed_at is not None:
                    raise TaskClaimConflict(existing)
                elif self._lease_is_active_for_generation(existing, current):
                    if existing.owner == owner:
                        return existing
                    raise TaskClaimConflict(existing)
                claim = replace(
                    existing,
                    owner=owner,
                    acquired_at=current,
                    expires_at=current + timedelta(minutes=self.lease_minutes),
                    factory_generation=self.factory_generation,
                    producer_identity=existing.producer_identity or producer_identity or owner,
                )
            else:
                claim = Lease(
                    task_id=task.identifier,
                    owner=owner,
                    acquired_at=current,
                    expires_at=current + timedelta(minutes=self.lease_minutes),
                    factory_generation=self.factory_generation,
                    task_key=task_key,
                    claimed_at=current,
                    producer_identity=producer_identity or owner,
                )
            claims[task_key] = claim
            self._write_leases(claims)
            return claim

    def renew(self, task_id: str, owner: str, now: datetime | None = None) -> Lease:
        """Renew an active lease only when the durable logical owner still matches."""

        with self._lease_lock, self._exclusive_lease_file_lock():
            current = now or datetime.now(UTC)
            self._assert_generation_current()
            claims = self.claims(current)
            task_key, existing = self._claim_entry(claims, task_id)
            if existing is None or not self._lease_is_active_for_generation(existing, current):
                raise ValueError(f"Task {task_id} does not have an active lease")
            if existing.task_id != task_id or existing.owner != owner:
                raise ValueError(
                    f"Task {task_id} lease belongs to {existing.owner}, not {owner}",
                )
            renewed = replace(
                existing,
                expires_at=current + timedelta(minutes=self.lease_minutes),
                factory_generation=self.factory_generation,
            )
            claims[task_key] = renewed
            self._write_leases(claims)
            return renewed

    def release(
        self,
        task_id: str,
        *,
        owner: str | None = None,
        now: datetime | None = None,
    ) -> None:
        with self._lease_lock, self._exclusive_lease_file_lock():
            current = now or datetime.now(UTC)
            self._assert_generation_current()
            claims = self.claims(current)
            task_key, existing = self._claim_entry(claims, task_id)
            if existing is None:
                return
            if owner is None and existing.task_id != task_id:
                return
            if owner is not None and (existing.task_id != task_id or existing.owner != owner):
                raise TaskClaimConflict(existing)
            claims[task_key] = replace(
                existing,
                owner=None,
                expires_at=current,
                factory_generation=self.factory_generation,
            )
            self._write_leases(claims)

    def prune_expired_leases(self, now: datetime | None = None) -> list[str]:
        with self._lease_lock, self._exclusive_lease_file_lock():
            current = now or datetime.now(UTC)
            self._assert_generation_current()
            claims = self.claims(current)
            expired: list[str] = []
            for task_key, claim in list(claims.items()):
                if claim.owner is None or self._lease_is_active_for_generation(claim, current):
                    continue
                expired.append(claim.task_id)
                claims[task_key] = replace(
                    claim,
                    owner=None,
                    expires_at=current,
                    factory_generation=self.factory_generation,
                )
            self._write_leases(claims)
            return sorted(expired, key=lambda identifier: (not identifier.isdigit(), identifier))

    def bind_branch(
        self,
        task_id: str,
        owner: str,
        branch: str,
        initial_base_sha: str,
        *,
        predecessor_pull_request: int | None = None,
    ) -> Lease:
        def bind(claim: Lease) -> Lease:
            if claim.canonical_branch not in {None, branch}:
                raise TaskClaimConflict(claim)
            if claim.initial_base_sha not in {None, initial_base_sha}:
                raise TaskClaimConflict(claim)
            return replace(
                claim,
                canonical_branch=branch,
                initial_base_sha=claim.initial_base_sha or initial_base_sha,
                predecessor_pull_request=(
                    predecessor_pull_request
                    if predecessor_pull_request is not None
                    else claim.predecessor_pull_request
                ),
            )

        return self._update_owned_claim(
            task_id,
            owner,
            bind,
        )

    def bind_pull_request(
        self,
        task_id: str,
        owner: str,
        pull_request: int,
        branch: str,
        *,
        predecessor_pull_request: int | None = None,
    ) -> Lease:
        with self._lease_lock, self._exclusive_lease_file_lock():
            current = datetime.now(UTC)
            self._assert_generation_current()
            claims = self.claims(current)
            task_key, existing = self._require_owned_claim(claims, task_id, owner, current)
            if existing.canonical_pull_request not in {None, pull_request}:
                raise TaskClaimConflict(existing)
            predecessor = predecessor_pull_request or existing.predecessor_pull_request
            updated = replace(
                existing,
                canonical_branch=branch,
                canonical_pull_request=pull_request,
                predecessor_pull_request=predecessor,
                successor_pull_request=(pull_request if predecessor is not None else None),
            )
            claims[task_key] = updated
            self._write_leases(claims)
            return updated

    def record_verification(
        self,
        task_id: str,
        owner: str,
        head_sha: str,
        path_fingerprint: str | None,
    ) -> Lease:
        return self._update_owned_claim(
            task_id,
            owner,
            lambda claim: replace(
                claim,
                latest_verified_sha=head_sha,
                changed_path_fingerprint=path_fingerprint,
            ),
        )

    def record_failure(
        self,
        task_id: str,
        owner: str,
        failure_fingerprint: str | None,
    ) -> Lease:
        return self._update_owned_claim(
            task_id,
            owner,
            lambda claim: replace(claim, failure_fingerprint=failure_fingerprint),
        )

    def complete(self, task_id: str, owner: str, now: datetime | None = None) -> Lease:
        return self._update_owned_claim(
            task_id,
            owner,
            lambda claim: replace(claim, completed_at=now or datetime.now(UTC)),
        )

    def _update_owned_claim(
        self,
        task_id: str,
        owner: str,
        update: Callable[[Lease], Lease],
    ) -> Lease:
        with self._lease_lock, self._exclusive_lease_file_lock():
            current = datetime.now(UTC)
            self._assert_generation_current()
            claims = self.claims(current)
            task_key, existing = self._require_owned_claim(claims, task_id, owner, current)
            updated = update(existing)
            claims[task_key] = updated
            self._write_leases(claims)
            return updated

    def _claim_entry(
        self,
        claims: LeaseIndex,
        task_id: str,
    ) -> tuple[str, Lease | None]:
        task_key = self._task_key(task_id)
        existing = claims.get(task_key)
        if existing is not None:
            return task_key, existing
        for candidate_key, candidate in claims.items():
            if candidate.task_id == task_id:
                return candidate_key, candidate
        return task_key, None

    def _require_owned_claim(
        self,
        claims: LeaseIndex,
        task_id: str,
        owner: str,
        current: datetime,
    ) -> tuple[str, Lease]:
        task_key, existing = self._claim_entry(claims, task_id)
        if existing is None or not self._lease_is_active_for_generation(existing, current):
            raise ValueError(f"Task {task_id} does not have an active lease")
        if existing.task_id != task_id or existing.owner != owner:
            raise TaskClaimConflict(existing)
        return task_key, existing

    def _can_take_over(self, claim: Lease, task: Task, current: datetime) -> bool:
        return (
            claim.task_id != task.identifier
            and not self._lease_is_active_for_generation(claim, current)
            and claim.task_id in supersession_references(task.body)
            and (claim.completed_at is not None or claim.failure_fingerprint is not None)
        )

    def _restore_lease(self, item: object) -> Lease:
        if not isinstance(item, dict):
            raise TypeError("lease entry is not a mapping")

        def timestamp(name: str, *, required: bool = True) -> datetime | None:
            value = item.get(name)
            if value is None and not required:
                return None
            if not isinstance(value, str):
                raise TypeError(f"lease {name} is not a timestamp")
            restored = datetime.fromisoformat(value)
            return restored if restored.tzinfo is not None else restored.replace(tzinfo=UTC)

        def optional_string(name: str) -> str | None:
            value = item.get(name)
            if value is None:
                return None
            if not isinstance(value, str):
                raise TypeError(f"lease {name} is not a string")
            return value or None

        def optional_integer(name: str) -> int | None:
            value = item.get(name)
            if value is None:
                return None
            if not isinstance(value, int) or isinstance(value, bool):
                raise TypeError(f"lease {name} is not an integer")
            return value

        task_id = item["task_id"]
        owner = item.get("owner")
        if not isinstance(task_id, str) or not isinstance(owner, str | None):
            raise TypeError("lease identity must contain strings")
        task_key = str(item.get("task_key") or self._task_key(task_id))
        acquired_at = timestamp("acquired_at")
        if acquired_at is None:
            raise TypeError("lease acquired_at is required")
        return Lease(
            task_id=task_id,
            owner=owner or None,
            acquired_at=acquired_at,
            expires_at=timestamp("expires_at", required=False),
            factory_generation=str(item.get("factory_generation", "unknown")),
            task_key=task_key,
            claimed_at=timestamp("claimed_at", required=False) or acquired_at,
            producer_identity=optional_string("producer_identity") or owner or None,
            canonical_branch=optional_string("canonical_branch"),
            canonical_pull_request=optional_integer("canonical_pull_request"),
            initial_base_sha=optional_string("initial_base_sha"),
            latest_verified_sha=optional_string("latest_verified_sha"),
            predecessor_pull_request=optional_integer("predecessor_pull_request"),
            successor_pull_request=optional_integer("successor_pull_request"),
            failure_fingerprint=optional_string("failure_fingerprint"),
            changed_path_fingerprint=optional_string("changed_path_fingerprint"),
            completed_at=timestamp("completed_at", required=False),
            predecessor_task_id=optional_string("predecessor_task_id"),
        )

    def _lease_is_active(self, lease: Lease, current: datetime) -> bool:
        if lease.owner is None or lease.expires_at is None:
            return False
        maximum_clock_skew = current + timedelta(minutes=1)
        maximum_expiry = maximum_clock_skew + timedelta(minutes=self.lease_minutes)
        return (
            lease.acquired_at <= maximum_clock_skew and current < lease.expires_at <= maximum_expiry
        )

    def _lease_is_active_for_generation(self, lease: Lease, current: datetime) -> bool:
        same_generation = self.factory_generation == "unknown" or lease.factory_generation in {
            "unknown",
            self.factory_generation,
        }
        return same_generation and self._lease_is_active(lease, current)

    def _claim_rank(self, claim: Lease, current: datetime) -> tuple[bool, datetime, str]:
        claimed_at = claim.claimed_at or claim.acquired_at
        return (not self._lease_is_active_for_generation(claim, current), claimed_at, claim.task_id)

    def _write_leases(self, leases: dict[str, Lease]) -> None:
        atomic_write_json(
            self.lease_path,
            {
                "leases": [
                    {
                        "task_id": item.task_id,
                        "task_key": item.task_key or self._task_key(item.task_id),
                        "owner": item.owner or "",
                        "acquired_at": item.acquired_at.isoformat(),
                        "expires_at": item.expires_at.isoformat() if item.expires_at else None,
                        "factory_generation": item.factory_generation,
                        "claimed_at": (item.claimed_at.isoformat() if item.claimed_at else None),
                        "producer_identity": item.producer_identity,
                        "canonical_branch": item.canonical_branch,
                        "canonical_pull_request": item.canonical_pull_request,
                        "initial_base_sha": item.initial_base_sha,
                        "latest_verified_sha": item.latest_verified_sha,
                        "predecessor_pull_request": item.predecessor_pull_request,
                        "successor_pull_request": item.successor_pull_request,
                        "failure_fingerprint": item.failure_fingerprint,
                        "changed_path_fingerprint": item.changed_path_fingerprint,
                        "completed_at": (
                            item.completed_at.isoformat() if item.completed_at else None
                        ),
                        "predecessor_task_id": item.predecessor_task_id,
                    }
                    for item in leases.values()
                ]
            },
            validator=_is_lease_payload,
        )
