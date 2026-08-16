from pathlib import Path

import pytest

from openhands_factory.exceptions import FactoryError
from openhands_factory.generation import (
    FactoryGeneration,
    activate_generation,
    assert_generation_current,
)


def test_generation_is_current_after_activation(tmp_path: Path) -> None:
    generation = FactoryGeneration.create()
    activate_generation(tmp_path, generation)
    assert_generation_current(tmp_path, generation)


def test_old_generation_loses_ownership(tmp_path: Path) -> None:
    old = FactoryGeneration.create()
    new = FactoryGeneration.create()
    activate_generation(tmp_path, old)
    activate_generation(tmp_path, new)
    with pytest.raises(FactoryError, match="lost ownership"):
        assert_generation_current(tmp_path, old)
    assert_generation_current(tmp_path, new)
