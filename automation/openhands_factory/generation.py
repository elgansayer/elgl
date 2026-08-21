"""Factory deployment generation identity and durable-state schema contract."""

from __future__ import annotations

import os
import socket
from dataclasses import asdict, dataclass
from datetime import UTC, datetime
from pathlib import Path
from uuid import uuid4

from openhands_factory.exceptions import FactoryError
from openhands_factory.state import atomic_write_json, read_json

STATE_SCHEMA_VERSION = 1
FACTORY_RUNTIME_VERSION = "openhands-factory-v1"


@dataclass(frozen=True)
class FactoryGeneration:
    identifier: str
    runtime_version: str
    schema_version: int
    hostname: str
    pid: int
    started_at: str

    @classmethod
    def create(cls) -> FactoryGeneration:
        return cls(
            identifier=uuid4().hex,
            runtime_version=FACTORY_RUNTIME_VERSION,
            schema_version=STATE_SCHEMA_VERSION,
            hostname=socket.gethostname(),
            pid=os.getpid(),
            started_at=datetime.now(UTC).isoformat(),
        )


def generation_path(state_dir: Path) -> Path:
    return state_dir / "generation.json"


def schema_path(state_dir: Path) -> Path:
    return state_dir / "state-schema.json"


def validate_or_initialize_schema(state_dir: Path) -> None:
    """Fail closed for unknown durable-state schemas; initialize only missing manifests."""
    path = schema_path(state_dir)
    if not path.exists():
        atomic_write_json(
            path,
            {
                "schema_version": STATE_SCHEMA_VERSION,
                "runtime_version": FACTORY_RUNTIME_VERSION,
                "initialized_at": datetime.now(UTC).isoformat(),
            },
        )
        return
    payload = read_json(path, {})
    version = payload.get("schema_version") if isinstance(payload, dict) else None
    if version != STATE_SCHEMA_VERSION:
        quarantine = state_dir / (
            f"state-schema.incompatible-{datetime.now(UTC).strftime('%Y%m%dT%H%M%SZ')}.json"
        )
        try:
            path.replace(quarantine)
        except OSError as error:
            raise FactoryError(
                f"Unsupported Factory state schema {version!r}; expected {STATE_SCHEMA_VERSION}"
            ) from error
        raise FactoryError(
            f"Unsupported Factory state schema {version!r}; quarantined manifest at {quarantine}"
        )


def activate_generation(state_dir: Path, generation: FactoryGeneration) -> None:
    """Publish ownership only after the daemon has acquired the host-level lock."""
    validate_or_initialize_schema(state_dir)
    atomic_write_json(generation_path(state_dir), asdict(generation))


def assert_generation_current(state_dir: Path, generation: FactoryGeneration) -> None:
    payload = read_json(generation_path(state_dir), {})
    if not isinstance(payload, dict):
        raise FactoryError("Factory generation state is invalid")
    if payload.get("schema_version") != STATE_SCHEMA_VERSION:
        raise FactoryError(
            f"Unsupported Factory generation schema {payload.get('schema_version')!r}; "
            f"expected {STATE_SCHEMA_VERSION}"
        )
    if payload.get("identifier") != generation.identifier:
        raise FactoryError("Factory generation lost ownership to a newer daemon")


def generation_snapshot(state_dir: Path) -> dict[str, object]:
    payload = read_json(generation_path(state_dir), {})
    return payload if isinstance(payload, dict) else {}
