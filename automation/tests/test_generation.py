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
from openhands_factory.state import atomic_write_json, read_json


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
