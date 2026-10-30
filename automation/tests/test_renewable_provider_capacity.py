"""Real broker persistence and fencing, without any model or production store."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory import provider_capacity
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.provider_capacity import ProviderCapacityStore, RenewableCapacityLease
from openhands_factory.state import read_json


@pytest.fixture
def clock(monkeypatch: pytest.MonkeyPatch) -> list[datetime]:
    current = [datetime.now(UTC)]

    class Clock(datetime):
        @classmethod
        def now(cls, tz: object = None) -> datetime:
            del tz
            return current[0]

    monkeypatch.setattr(provider_capacity, "datetime", Clock)
    return current


def test_long_session_remains_visible_to_legacy_bounded_readers(
    tmp_path: Path, clock: list[datetime]
) -> None:
    writer = ProviderCapacityStore(tmp_path)
    # Same reader ceiling as the observed installed operator configuration.
    reader = ProviderCapacityStore(tmp_path, max_lease_seconds=3900)
    lease = writer.acquire_renewable("claude", owner="manual:1", limit=2)
    reader.acquire("claude", owner="factory:1", limit=2, wait_seconds=0, lease_seconds=3900)

    for _ in range(140):
        clock[0] += timedelta(seconds=30)
        writer.renew(lease)
        assert reader.snapshot()["claude"] >= 1
    # More than 3900 seconds have passed; only the unrenewed factory slot expired.
    assert reader.snapshot()["claude"] == 1
    reader.acquire("claude", owner="factory:2", limit=2, wait_seconds=0, lease_seconds=3900)
    with pytest.raises(ProviderCapacityUnavailable):
        reader.acquire("claude", owner="factory:3", limit=2, wait_seconds=0, lease_seconds=60)


def test_expired_owner_cannot_renew_or_release_replacement(
    tmp_path: Path, clock: list[datetime]
) -> None:
    store = ProviderCapacityStore(tmp_path, max_lease_seconds=3900)
    stale = store.acquire_renewable("codex", owner="manual:session", limit=1)
    clock[0] += timedelta(seconds=60)
    replacement = store.acquire_renewable("codex", owner="manual:session", limit=1)

    with pytest.raises(ProviderCapacityUnavailable, match="ownership lost"):
        store.renew(stale)
    assert not store.release_renewable(stale)
    assert store.snapshot() == {"codex": 1}
    store.renew(replacement)
    assert store.release_renewable(replacement)
    assert not store.release_renewable(replacement)


def test_expired_lease_does_not_reacquire_capacity(tmp_path: Path, clock: list[datetime]) -> None:
    store = ProviderCapacityStore(tmp_path)
    lease = store.acquire_renewable("gemini", owner="manual:agy", limit=1)
    clock[0] += timedelta(seconds=61)
    with pytest.raises(ProviderCapacityUnavailable):
        store.renew(lease)
    assert store.snapshot() == {"gemini": 0}


def test_duplicate_live_owner_cannot_consume_another_slot(tmp_path: Path) -> None:
    store = ProviderCapacityStore(tmp_path)
    lease = store.acquire_renewable("claude", owner="manual:1", limit=2)
    with pytest.raises(ProviderCapacityUnavailable):
        store.acquire_renewable("claude", owner="manual:1", limit=2)
    assert store.snapshot()["claude"] == 1
    assert store.release_renewable(lease)


@pytest.mark.parametrize("seconds", [0, -1, 61, 3960, True, 0.5])
def test_renewable_duration_never_exceeds_protocol_bound(tmp_path: Path, seconds: int) -> None:
    store = ProviderCapacityStore(tmp_path)
    with pytest.raises(ValueError, match="handle"):
        store.acquire_renewable("codex", owner="manual:1", limit=1, lease_seconds=seconds)
    assert not store.path.exists()


def test_reader_bound_is_checked_before_writing_or_refreshing(tmp_path: Path) -> None:
    writer = ProviderCapacityStore(tmp_path)
    reader = ProviderCapacityStore(tmp_path, max_lease_seconds=30)
    with pytest.raises(ValueError):
        reader.acquire_renewable("claude", owner="manual:1", limit=1)
    lease = writer.acquire_renewable("claude", owner="manual:1", limit=1)
    before = writer.path.read_bytes()
    with pytest.raises(ValueError):
        reader.renew(lease)
    assert writer.path.read_bytes() == before


def test_shared_renewable_leases_reject_generation_filtered_store(tmp_path: Path) -> None:
    store = ProviderCapacityStore(tmp_path, factory_generation="one-daemon")
    with pytest.raises(ValueError):
        store.acquire_renewable("claude", owner="manual:1", limit=1)
    assert not store.path.exists()


@pytest.mark.parametrize("field", ["token", "owner", "provider"])
def test_forged_ownership_cannot_renew_or_release_another_lease(tmp_path: Path, field: str) -> None:
    store = ProviderCapacityStore(tmp_path)
    lease = store.acquire_renewable("claude", owner="manual:1", limit=1)
    wrong = replace(lease, **{field: "somebody-else"})
    before = store.path.read_bytes()
    with pytest.raises(ProviderCapacityUnavailable):
        store.renew(wrong)
    assert not store.release_renewable(wrong)
    assert store.path.read_bytes() == before


def test_protocol_scope_and_unrelated_live_leases_are_preserved(tmp_path: Path) -> None:
    store = ProviderCapacityStore(tmp_path)
    store.acquire("codex", limit=1, owner="other:codex", wait_seconds=0, lease_seconds=3900)
    store.acquire("claude", limit=2, owner="other:claude", wait_seconds=0, lease_seconds=3900)
    lease = store.acquire_renewable("claude", owner="manual:1", limit=2)
    before = read_json(store.path, {})["providers"]

    for wrong in (replace(lease, protocol_version=2), replace(lease, store_path="/other/store")):
        with pytest.raises(ValueError):
            store.renew(wrong)
        with pytest.raises(ValueError):
            store.release_renewable(wrong)
    store.renew(lease)
    assert store.release_renewable(lease)
    after = read_json(store.path, {})["providers"]
    assert after["codex"] == before["codex"]
    assert after["claude"] == before["claude"][:1]


def test_short_reader_bound_preserves_unrelated_long_lease(tmp_path: Path) -> None:
    factory = ProviderCapacityStore(tmp_path, max_lease_seconds=3900)
    factory.acquire("claude", limit=2, owner="factory:1", wait_seconds=0, lease_seconds=3900)
    before = read_json(factory.path, {})["providers"]["claude"]
    manual = ProviderCapacityStore(tmp_path, max_lease_seconds=60)

    lease = manual.acquire_renewable("claude", owner="manual:1", limit=2)
    manual.renew(lease)

    after = read_json(factory.path, {})["providers"]["claude"]
    assert after[0] == before[0]
    assert after[1]["lease_token"] == lease.token


def test_renewable_admission_discards_malformed_legacy_entries(tmp_path: Path) -> None:
    store = ProviderCapacityStore(tmp_path, max_lease_seconds=60)
    store.path.write_text(
        json.dumps(
            {
                "providers": {
                    "claude": [
                        {
                            "owner": "broken",
                            "acquired_at": "not-a-timestamp",
                            "expires_at": "also-not-a-timestamp",
                        }
                    ]
                }
            }
        ),
        encoding="utf-8",
    )

    lease = store.acquire_renewable("claude", owner="manual:1", limit=1)

    entries = read_json(store.path, {})["providers"]["claude"]
    assert [entry["owner"] for entry in entries] == ["manual:1"]
    assert entries[0]["lease_token"] == lease.token


def test_fresh_process_recovers_persisted_handle_and_blocks_new_participant(tmp_path: Path) -> None:
    store = ProviderCapacityStore(tmp_path, max_lease_seconds=3900)
    lease = store.acquire_renewable("claude", owner="manual:restart", limit=1)
    checkpoint = tmp_path / "session.json"
    checkpoint.write_text(json.dumps(asdict(lease)), encoding="utf-8")
    checkpoint.chmod(0o600)
    script = """
import json, sys
from dataclasses import asdict
from pathlib import Path
from openhands_factory.provider_capacity import ProviderCapacityStore, RenewableCapacityLease
from openhands_factory.exceptions import ProviderCapacityUnavailable
lease = RenewableCapacityLease(**json.loads(Path(sys.argv[1]).read_text()))
store = ProviderCapacityStore(Path(sys.argv[1]).parent, max_lease_seconds=3900)
store.renew(lease)
assert store.snapshot() == {'claude': 1}
try:
    store.acquire('claude', owner='factory:blocked', limit=1, wait_seconds=0, lease_seconds=60)
except ProviderCapacityUnavailable:
    print(json.dumps({'blocked': True, 'handle': asdict(lease)}))
else:
    raise AssertionError('manual capacity was ignored')
"""
    result = subprocess.run(
        [sys.executable, "-c", script, str(checkpoint)],
        env={**os.environ, "PYTHONPATH": str(Path(__file__).parents[1])},
        text=True,
        capture_output=True,
        timeout=10,
        check=True,
    )
    assert json.loads(result.stdout) == {"blocked": True, "handle": asdict(lease)}
    assert store.release_renewable(lease)
    assert store.snapshot() == {"claude": 0}


def test_three_real_processes_compete_for_two_slots_without_lost_updates(tmp_path: Path) -> None:
    script = """
import json, sys
from dataclasses import asdict
from pathlib import Path
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.exceptions import ProviderCapacityUnavailable
store = ProviderCapacityStore(Path(sys.argv[1]), max_lease_seconds=3900)
try:
    lease = store.acquire_renewable('claude', owner=sys.argv[2], limit=2)
except ProviderCapacityUnavailable:
    print(json.dumps({'blocked': True}))
else:
    print(json.dumps({'handle': asdict(lease)}))
"""

    def participant(index: int) -> dict[str, object]:
        result = subprocess.run(
            [sys.executable, "-c", script, str(tmp_path), f"participant:{index}"],
            env={**os.environ, "PYTHONPATH": str(Path(__file__).parents[1])},
            capture_output=True,
            text=True,
            timeout=10,
            check=True,
        )
        return json.loads(result.stdout)

    with ThreadPoolExecutor(max_workers=3) as executor:
        results = list(executor.map(participant, range(3)))
    assert sum(result.get("blocked") is True for result in results) == 1
    store = ProviderCapacityStore(tmp_path, max_lease_seconds=3900)
    assert store.snapshot() == {"claude": 2}
    for result in results:
        if "handle" in result:
            assert store.release_renewable(RenewableCapacityLease(**result["handle"]))
    assert store.snapshot() == {"claude": 0}
