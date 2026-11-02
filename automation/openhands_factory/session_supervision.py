"""Request-local integration of shared capacity, guardians and private identities."""

from __future__ import annotations

import math
import threading
import time
from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from uuid import uuid4

from openhands_factory.agents.process import (
    AgentProcessRunner,
    ProcessResult,
    ProviderHomeMount,
)
from openhands_factory.provider_capacity import ProviderCapacityStore, RenewableCapacityLease
from openhands_factory.session_identity import (
    ProcessIdentity,
    SessionCheckpoint,
    SessionIdentityJournal,
)

# Includes the guardian and namespace init's existing bounded drain periods.
SHUTDOWN_MARGIN_SECONDS = 10


@dataclass
class _OwnedSession:
    lease: RenewableCapacityLease
    running: bool = False
    closing: bool = False
    guardians: list[ProcessIdentity] = field(default_factory=list)


class SessionSupervisor:
    """One renewable slot per router reservation, never a second capacity pool.

    Only trusted coordinator code supplies the shared store and private journal.
    Process identities survive crashes; recovery does not renew, adopt, signal or
    release a reservation merely because its recorded guardian is now dead.
    A crashed owner loses its guardian and the short lease expires naturally.
    """

    def __init__(
        self,
        store: ProviderCapacityStore,
        journal: SessionIdentityJournal,
        *,
        lease_seconds: int = 30,
        guard_timeout_seconds: float = 5,
    ) -> None:
        if (
            store.factory_generation is not None
            or type(lease_seconds) is not int
            or not 0 < lease_seconds <= min(60, store.max_lease_seconds)
            or not math.isfinite(guard_timeout_seconds)
            or not 0 < guard_timeout_seconds <= 30
            or guard_timeout_seconds + SHUTDOWN_MARGIN_SECONDS >= lease_seconds
        ):
            raise ValueError("Incompatible shared lease or guardian/shutdown margin")
        self.store = store
        self.journal = journal
        self.lease_seconds = lease_seconds
        self.guard_timeout_seconds = guard_timeout_seconds
        self._lock = threading.Lock()
        self._sessions: dict[tuple[str, str], _OwnedSession] = {}
        self._pending: set[tuple[str, str]] = set()

    def acquire(self, provider: str, owner: str, *, limit: int, wait_seconds: int) -> float:
        key = (provider, owner)
        with self._lock:
            if key in self._sessions or key in self._pending:
                raise ValueError("This routed reservation already has a session")
            self._pending.add(key)
        started = time.monotonic()
        try:
            lease = self.store.acquire_renewable(
                provider,
                owner=owner,
                limit=limit,
                wait_seconds=wait_seconds,
                lease_seconds=self.lease_seconds,
            )
            with self._lock:
                self._sessions[key] = _OwnedSession(lease)
            return time.monotonic() - started
        finally:
            with self._lock:
                self._pending.discard(key)

    def runner(self, provider: str, owner: str) -> AgentProcessRunner:
        with self._lock:
            session = self._sessions[(provider, owner)]
            if session.closing:
                raise ValueError("Session is already draining")
        return _SessionRunner(self, session)

    def _begin(self, session: _OwnedSession) -> None:
        with self._lock:
            key = (session.lease.provider, session.lease.owner)
            if self._sessions.get(key) is not session or session.closing or session.running:
                raise ValueError("Session ownership is absent, draining or already running")
            session.running = True

    def _finish(self, session: _OwnedSession) -> None:
        with self._lock:
            session.running = False

    def _started(self, session: _OwnedSession, pid: int) -> None:
        identity = ProcessIdentity.capture(pid)
        # AgentProcessRunner does not pulse/dispatch until this has been fsynced.
        self.journal.create(SessionCheckpoint(str(uuid4()), identity, session.lease))
        with self._lock:
            session.guardians.append(identity)

    def release(self, provider: str, owner: str) -> None:
        key = (provider, owner)
        with self._lock:
            session = self._sessions.get(key)
            if session is None:
                return
            if session.running:
                raise ValueError("Cannot release capacity before the process runner drains")
            session.closing = True
        if any(identity.matches_live() for identity in session.guardians):
            raise ValueError("Cannot release capacity while an owned guardian is live")
        # A stale cleanup token cannot remove a later reservation with this owner.
        self.store.release_renewable(session.lease)
        with self._lock:
            if self._sessions.get(key) is session:
                del self._sessions[key]


class _SessionRunner(AgentProcessRunner):
    def __init__(self, supervisor: SessionSupervisor, session: _OwnedSession) -> None:
        self.supervisor = supervisor
        self.session = session
        super().__init__(
            guard_timeout_seconds=supervisor.guard_timeout_seconds,
            heartbeat_check=lambda: supervisor.store.renew(session.lease),
            on_start=lambda pid: supervisor._started(session, pid),
        )

    def run(
        self,
        command: Sequence[str],
        *,
        cwd: Path,
        env: Mapping[str, str],
        stdin_text: str | None,
        timeout_seconds: int,
        max_output_bytes: int,
        home_mounts: Sequence[ProviderHomeMount] = (),
    ) -> ProcessResult:
        self.supervisor._begin(self.session)
        guardians_before = len(self.session.guardians)
        uncertain_drain = True
        try:
            result = super().run(
                command,
                cwd=cwd,
                env=env,
                stdin_text=stdin_text,
                timeout_seconds=timeout_seconds,
                max_output_bytes=max_output_bytes,
                home_mounts=home_mounts,
            )
            uncertain_drain = result.cancelled or result.timed_out
            return result
        finally:
            if uncertain_drain and len(self.session.guardians) > guardians_before:
                # A dead guardian alone is not proof that namespace descendants
                # finished draining. Retain the slot and prevent attempt reuse
                # for the existing containment bound, including abnormal death.
                time.sleep(SHUTDOWN_MARGIN_SECONDS)
            self.supervisor._finish(self.session)
