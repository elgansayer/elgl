"""Private immutable recovery evidence, with no process or broker control API."""

from __future__ import annotations

import json
import os
import stat
from dataclasses import asdict, dataclass
from pathlib import Path
from uuid import UUID

from openhands_factory.provider_capacity import (
    MAX_RENEWABLE_LEASE_SECONDS,
    RenewableCapacityLease,
)

MAX_CHECKPOINT_BYTES = 16384


def _uuid(value: str) -> str:
    if not isinstance(value, str) or str(UUID(value)) != value:
        raise ValueError("A canonical UUID is required")
    return value


def _start_ticks(pid: int) -> int:
    value = Path(f"/proc/{pid}/stat").read_text()
    if not value.startswith(f"{pid} ("):
        raise ValueError("Process stat identity changed")
    fields = value.rsplit(")", 1)[1].split()
    if fields[0] in {"Z", "X", "x"}:
        raise ProcessLookupError("Process is no longer live")
    return int(fields[19])  # Linux stat field 22; comm may contain spaces or ')'.


@dataclass(frozen=True)
class ProcessIdentity:
    pid: int
    uid: int
    start_ticks: int
    boot_id: str

    def __post_init__(self) -> None:
        if (
            type(self.pid) is not int
            or self.pid <= 0
            or type(self.uid) is not int
            or self.uid < 0
            or type(self.start_ticks) is not int
            or self.start_ticks <= 0
        ):
            raise ValueError("Invalid process identity")
        _uuid(self.boot_id)

    @classmethod
    def capture(cls, pid: int) -> ProcessIdentity:
        if type(pid) is not int or pid <= 0:
            raise ValueError("A positive process ID is required")
        before = _start_ticks(pid)
        # procfs file ownership can become root for non-dumpable processes.
        # Read the effective UID instead of mistaking that ownership for root.
        rows = Path(f"/proc/{pid}/status").read_text().splitlines()
        uid = int(next(row for row in rows if row.startswith("Uid:")).split()[2])
        boot = Path("/proc/sys/kernel/random/boot_id").read_text().strip()
        if _start_ticks(pid) != before:
            raise ProcessLookupError("Process changed during identity capture")
        return cls(pid, uid, before, boot)

    def matches_live(self) -> bool:
        """Read-only point-in-time check; never permission to signal or adopt."""
        try:
            return self == self.capture(self.pid)
        except (OSError, ValueError, IndexError, StopIteration):
            return False


@dataclass(frozen=True)
class SessionCheckpoint:
    session_id: str
    guardian: ProcessIdentity
    lease: RenewableCapacityLease
    schema_version: int = 1

    def __post_init__(self) -> None:
        _uuid(self.session_id)
        if type(self.schema_version) is not int or self.schema_version != 1:
            raise ValueError("Unsupported session checkpoint version")
        if not isinstance(self.guardian, ProcessIdentity) or self.guardian.uid != os.geteuid():
            raise ValueError("Session guardian must belong to this operating-system user")
        handle = self.lease
        if (
            not isinstance(handle, RenewableCapacityLease)
            or type(handle.protocol_version) is not int
            or handle.protocol_version != 1
            or type(handle.lease_seconds) is not int
            or not 0 < handle.lease_seconds <= MAX_RENEWABLE_LEASE_SECONDS
            or any(
                not isinstance(value, str) or not value or len(value) > 4096
                for value in (handle.provider, handle.owner, handle.store_path)
            )
            or not Path(handle.store_path).is_absolute()
        ):
            raise ValueError("Invalid checkpoint lease handle")
        _uuid(handle.token)


class SessionIdentityJournal:
    """Create once, fsync before dispatch, refuse ambiguous recovery evidence.

    A partial write remains invalid and cannot be overwritten. The future caller
    must not pulse a guardian before create() succeeds. No backup is substituted
    for a malformed record, and load() never changes lease or process state.
    """

    def __init__(self, directory: Path) -> None:
        self.directory = directory
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        descriptor = self._open_directory()
        os.close(descriptor)

    def _open_directory(self) -> int:
        descriptor = os.open(self.directory, os.O_RDONLY | os.O_DIRECTORY | os.O_NOFOLLOW)
        info = os.fstat(descriptor)
        if info.st_uid != os.geteuid() or stat.S_IMODE(info.st_mode) & 0o077:
            os.close(descriptor)
            raise ValueError("Session journal directory must be private and owned by this user")
        return descriptor

    def create(self, checkpoint: SessionCheckpoint) -> None:
        # Revalidate even a caller-supplied object before touching the filesystem.
        checkpoint.__post_init__()
        if not checkpoint.guardian.matches_live():
            raise ProcessLookupError("Guardian identity is not live")
        payload = (json.dumps(asdict(checkpoint), sort_keys=True) + "\n").encode()
        if len(payload) > MAX_CHECKPOINT_BYTES:
            raise ValueError("Session checkpoint is too large")
        directory = self._open_directory()
        try:
            descriptor = os.open(
                checkpoint.session_id + ".json",
                os.O_CREAT | os.O_EXCL | os.O_WRONLY | os.O_NOFOLLOW,
                0o600,
                dir_fd=directory,
            )
            with os.fdopen(descriptor, "wb") as handle:
                os.fchmod(handle.fileno(), 0o600)
                handle.write(payload)
                handle.flush()
                os.fsync(handle.fileno())
            os.fsync(directory)
        finally:
            os.close(directory)

    def load(self, session_id: str) -> SessionCheckpoint:
        filename = _uuid(session_id) + ".json"
        directory = self._open_directory()
        try:
            descriptor = os.open(
                filename, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK, dir_fd=directory
            )
            with os.fdopen(descriptor, "rb") as handle:
                info = os.fstat(handle.fileno())
                if (
                    not stat.S_ISREG(info.st_mode)
                    or info.st_uid != os.geteuid()
                    or stat.S_IMODE(info.st_mode) & 0o077
                    or info.st_nlink != 1
                    or info.st_size > MAX_CHECKPOINT_BYTES
                ):
                    raise ValueError("Session checkpoint must be a bounded private regular file")
                raw = handle.read(MAX_CHECKPOINT_BYTES + 1)
            if len(raw) > MAX_CHECKPOINT_BYTES:
                raise ValueError("Session checkpoint is too large")
        finally:
            os.close(directory)
        try:
            value = json.loads(raw)
            if not isinstance(value, dict) or set(value) != {
                "session_id",
                "guardian",
                "lease",
                "schema_version",
            }:
                raise ValueError("Invalid session checkpoint schema")
            checkpoint = SessionCheckpoint(
                value["session_id"],
                ProcessIdentity(**value["guardian"]),
                RenewableCapacityLease(**value["lease"]),
                value["schema_version"],
            )
        except (TypeError, KeyError, UnicodeDecodeError) as error:
            raise ValueError("Invalid session checkpoint schema") from error
        if checkpoint.session_id != session_id:
            raise ValueError("Session checkpoint identity does not match its filename")
        return checkpoint
