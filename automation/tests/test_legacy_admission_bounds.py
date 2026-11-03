"""Shared admission must not erase foreign live work outside a reader's bound."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory import provider_capacity
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.state import read_json

PROVIDERS = ("codex", "claude", "gemini")


def occupied(root: Path, provider: str, kind: str) -> tuple[ProviderCapacityStore, dict]:
    writer = ProviderCapacityStore(root, max_lease_seconds=3960)
    if kind == "legacy":
        writer.acquire(provider, limit=1, owner="foreign", wait_seconds=0, lease_seconds=3960)
    else:
        writer.acquire_renewable(provider, limit=1, owner="foreign", lease_seconds=60)
    return writer, read_json(writer.path, {})["providers"][provider][0]


@pytest.mark.parametrize("provider", PROVIDERS)
@pytest.mark.parametrize("kind", ("legacy", "renewable"))
def test_legacy_admission_cannot_erase_a_foreign_live_reservation(tmp_path, provider, kind):
    writer, original = occupied(tmp_path, provider, kind)
    reader = ProviderCapacityStore(tmp_path, max_lease_seconds=3900 if kind == "legacy" else 30)
    assert reader.snapshot()[provider] == 0  # Compatibility is not admission occupancy.
    with pytest.raises(ProviderCapacityUnavailable):
        reader.acquire(provider, limit=1, owner="new", wait_seconds=0, lease_seconds=10)
    assert read_json(writer.path, {})["providers"][provider] == [original]
    assert writer.snapshot()[provider] == 1


@pytest.mark.parametrize("provider", PROVIDERS)
@pytest.mark.parametrize("kind", ("legacy", "renewable"))
def test_one_free_slot_is_available_without_discarding_foreign_work(tmp_path, provider, kind):
    writer, original = occupied(tmp_path, provider, kind)
    reader = ProviderCapacityStore(tmp_path, max_lease_seconds=3900 if kind == "legacy" else 30)
    reader.acquire(provider, limit=2, owner="new", wait_seconds=0, lease_seconds=10)
    assert read_json(writer.path, {})["providers"][provider][0] == original
    assert writer.snapshot()[provider] == 2
    with pytest.raises(ProviderCapacityUnavailable):
        reader.acquire(provider, limit=2, owner="third", wait_seconds=0, lease_seconds=10)
    reader.release(provider, owner="new")
    assert read_json(writer.path, {})["providers"][provider] == [original]


@pytest.mark.parametrize("kind", ("legacy", "renewable"))
def test_foreign_capacity_is_reclaimed_only_after_declared_expiry(tmp_path, monkeypatch, kind):
    current = [datetime.now(UTC)]

    class Clock(datetime):
        @classmethod
        def now(cls, tz=None):
            del tz
            return current[0]

    monkeypatch.setattr(provider_capacity, "datetime", Clock)
    writer, original = occupied(tmp_path, "codex", kind)
    reader = ProviderCapacityStore(tmp_path, max_lease_seconds=3900 if kind == "legacy" else 30)
    with pytest.raises(ProviderCapacityUnavailable):
        reader.acquire("codex", limit=1, owner="new", wait_seconds=0, lease_seconds=10)
    assert read_json(writer.path, {})["providers"]["codex"] == [original]
    current[0] += timedelta(seconds=3961 if kind == "legacy" else 61)
    reader.acquire("codex", limit=1, owner="new", wait_seconds=0, lease_seconds=10)
    assert [entry["owner"] for entry in read_json(reader.path, {})["providers"]["codex"]] == ["new"]
    assert reader.snapshot() == {"codex": 1}


def test_unparseable_expired_and_future_entries_still_do_not_reserve_capacity(tmp_path):
    now = datetime.now(UTC)
    store = ProviderCapacityStore(tmp_path, max_lease_seconds=30)
    store.path.write_text(
        json.dumps(
            {
                "providers": {
                    "codex": [
                        {"owner": "broken", "acquired_at": "bad", "expires_at": "bad"},
                        {
                            "owner": "expired",
                            "acquired_at": (now - timedelta(seconds=61)).isoformat(),
                            "expires_at": (now - timedelta(seconds=1)).isoformat(),
                        },
                        {
                            "owner": "future",
                            "acquired_at": (now + timedelta(seconds=60)).isoformat(),
                            "expires_at": (now + timedelta(seconds=120)).isoformat(),
                        },
                    ]
                }
            }
        )
    )
    store.acquire("codex", limit=1, owner="new", wait_seconds=0, lease_seconds=10)
    assert [entry["owner"] for entry in read_json(store.path, {})["providers"]["codex"]] == ["new"]


@pytest.mark.parametrize("provider", PROVIDERS)
def test_independent_legacy_processes_share_capacity_with_a_long_live_owner(tmp_path, provider):
    writer, original = occupied(tmp_path, provider, "legacy")
    script = """
import json, sys
from pathlib import Path
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.exceptions import ProviderCapacityUnavailable
store=ProviderCapacityStore(Path(sys.argv[1]),max_lease_seconds=3900)
try:
    store.acquire(sys.argv[2],owner=sys.argv[3],limit=2,wait_seconds=0,lease_seconds=30)
except ProviderCapacityUnavailable:
    print(json.dumps({'acquired':False}))
else:
    print(json.dumps({'acquired':True}))
"""

    def participant(index):
        result = subprocess.run(
            [sys.executable, "-c", script, str(tmp_path), provider, f"new:{index}"],
            env={
                "PATH": os.defpath,
                "HOME": str(tmp_path),
                "PYTHONPATH": str(Path(__file__).resolve().parents[1]),
            },
            capture_output=True,
            text=True,
            timeout=10,
            check=True,
        )
        return json.loads(result.stdout)["acquired"]

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(participant, range(3)))
    assert sum(results) == 1
    entries = read_json(writer.path, {})["providers"][provider]
    assert len(entries) == 2 and entries[0] == original
    reader = ProviderCapacityStore(tmp_path, max_lease_seconds=3900)
    compatible, owned, incompatible = reader.audit_renewable_leases([])
    assert compatible == {provider: 1} and owned == [] and incompatible == {provider: 1}
    assert writer.snapshot()[provider] == 2
