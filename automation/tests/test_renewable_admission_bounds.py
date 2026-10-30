"""Independent account-slot admission regression from coordinator review."""

from pathlib import Path

import pytest

from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.state import read_json


def test_short_bound_manual_participant_cannot_overbook_long_factory_reservation(
    tmp_path: Path,
) -> None:
    factory = ProviderCapacityStore(tmp_path, max_lease_seconds=3900)
    factory.acquire("claude", limit=1, owner="factory:live", wait_seconds=0, lease_seconds=3900)
    before = read_json(factory.path, {})["providers"]["claude"]
    manual = ProviderCapacityStore(tmp_path, max_lease_seconds=60)

    with pytest.raises(ProviderCapacityUnavailable):
        manual.acquire_renewable("claude", owner="manual:must-wait", limit=1)

    assert read_json(factory.path, {})["providers"]["claude"] == before
    assert factory.snapshot() == {"claude": 1}


def test_short_bound_participant_cannot_duplicate_a_long_live_owner(tmp_path: Path) -> None:
    factory = ProviderCapacityStore(tmp_path, max_lease_seconds=3900)
    factory.acquire("claude", limit=2, owner="same:owner", wait_seconds=0, lease_seconds=3900)
    manual = ProviderCapacityStore(tmp_path, max_lease_seconds=60)

    with pytest.raises(ProviderCapacityUnavailable):
        manual.acquire_renewable("claude", owner="same:owner", limit=2)

    assert factory.snapshot() == {"claude": 1}
