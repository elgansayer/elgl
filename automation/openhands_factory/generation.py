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
    def create(cls) -> "FactoryGeneration":
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


def activate_generation(state_dir: Path, generation: FactoryGeneration) -> None:
    """Publish the generation only after the daemon has acquired the host lock."""
    atomic_write_json(generation_path(state_dir), asdict(generation))


def assert_generation_current(state_dir: Path, generation: FactoryGeneration) -> None:
    payload = read_json(generation_path(state_dir), {})
    if not isinstance(payload, dict):
        raise FactoryError("Factory generation state is invalid")
    if payload.get("schema_version") != STATE_SCHEMA_VERSION:
        raise FactoryError(
            f"Unsupported Factory state schema {payload.get('schema_version')!r}; "
            f"expected {STATE_SCHEMA_VERSION}"
        )
    if payload.get("identifier") != generation.identifier:
        raise FactoryError("Factory generation lost ownership to a newer daemon")
