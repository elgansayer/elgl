from datetime import UTC, datetime
from pathlib import Path

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.generation import (
    FactoryGeneration,
    activate_generation,
    assert_generation_current,
    schema_path,
    validate_or_initialize_schema,
)
from openhands_factory.jobs import JobStore
from openhands_factory.models import Job, Task
from openhands_factory.state import atomic_write_json, read_json
from openhands_factory.task_source import TaskStore


def task() -> Task:
    return Task("7050", "generation", "body", "github-issue", 1)


def test_generation_is_current_after_activation(tmp_path: Path) -> None:
    generation = FactoryGeneration.create()
    activate_generation(tmp_path, generation)
    assert_generation_current(tmp_path, generation)
    assert read_json(schema_path(tmp_path), {})["schema_version"] == 1


def test_old_generation_loses_ownership_after_takeover(tmp_path: Path) -> None:
    old = FactoryGeneration.create()
    new = FactoryGeneration.create()
    activate_generation(tmp_path, old)
    activate_generation(tmp_path, new)

    with pytest.raises(FactoryError, match="lost ownership"):
        assert_generation_current(tmp_path, old)
    assert_generation_current(tmp_path, new)


def test_unknown_state_schema_is_quarantined_and_fails_closed(tmp_path: Path) -> None:
    path = schema_path(tmp_path)
    atomic_write_json(path, {"schema_version": 999})

    with pytest.raises(FactoryError, match="quarantined manifest"):
        validate_or_initialize_schema(tmp_path)

    assert not path.exists()
    assert list(tmp_path.glob("state-schema.incompatible-*.json"))


def test_jobs_are_stamped_with_active_generation(tmp_path: Path) -> None:
    generation = FactoryGeneration.create()
    activate_generation(tmp_path, generation)
    store = JobStore(tmp_path / "jobs.json")
    store.save({"7050": Job(task=task())})

    persisted = read_json(tmp_path / "jobs.json", {})["jobs"][0]
    assert persisted["factory_generation"] == generation.identifier


def test_stale_generation_cannot_acquire_or_release_leases(tmp_path: Path) -> None:
    old = FactoryGeneration.create()
    activate_generation(tmp_path, old)
    stale_store = TaskStore(tmp_path)
    stale_store.acquire(task(), "old", datetime.now(UTC))

    new = FactoryGeneration.create()
    activate_generation(tmp_path, new)

    with pytest.raises(FactoryError, match="Stale Factory generation"):
        stale_store.acquire(Task("7051", "next", "body", "github-issue", 1), "old")
    with pytest.raises(FactoryError, match="Stale Factory generation"):
        stale_store.release("7050")

    current_store = TaskStore(tmp_path)
    assert current_store.factory_generation == new.identifier
    assert current_store.leases() == {}
