"""Read-only real local observations; no provider/auth requests or shared state."""

import json
import os
import subprocess
import sys
from dataclasses import asdict, replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

import pytest

from openhands_factory import cli
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.session_audit import audit_sessions
from openhands_factory.session_identity import (
    ProcessIdentity,
    SessionCheckpoint,
    SessionIdentityJournal,
)


@pytest.fixture
def fixture(tmp_path):
    broker = tmp_path / "broker"
    broker.mkdir(mode=0o700)
    store = ProviderCapacityStore(broker, max_lease_seconds=3900)
    journal = SessionIdentityJournal(tmp_path / "identities")
    process = subprocess.Popen([sys.executable, "-c", "import time; time.sleep(30)"])
    try:
        lease = store.acquire_renewable("codex", owner="fixture", limit=1, lease_seconds=30)
        record = SessionCheckpoint(str(uuid4()), ProcessIdentity.capture(process.pid), lease)
        journal.create(record)
        yield store, journal, process, record
    finally:
        process.terminate()
        process.wait(timeout=5)


def durable_bytes(store, journal):
    return {
        str(path): path.read_bytes()
        for parent in (store.path.parent, journal.directory)
        for path in parent.iterdir()
        if path.suffix != ".lock"
    }


def test_real_live_lease_audit_and_fresh_observer_do_not_mutate(fixture):
    store, journal, process, record = fixture
    before = durable_bytes(store, journal)
    report = audit_sessions(store, journal.directory)
    assert report["observations_consistent"]
    assert report["reader_compatible_slot_counts"] == {"codex": 1}
    assert report["status_counts"] == {"live_recorded_guardian_and_lease": 1}
    assert not report["account_wide_coverage_proven"] and not report["continuity_authorised"]
    assert report["records"][0]["guardian_pid"] == process.pid
    output = subprocess.check_output(
        [
            sys.executable,
            "-c",
            "import json,sys;from pathlib import Path;"
            "from openhands_factory.provider_capacity import ProviderCapacityStore;"
            "from openhands_factory.session_audit import audit_sessions;"
            "print(json.dumps(audit_sessions(ProviderCapacityStore(Path(sys.argv[1]),"
            "max_lease_seconds=3900),Path(sys.argv[2]))))",
            str(store.path.parent),
            str(journal.directory),
        ],
        text=True,
        cwd=Path(__file__).resolve().parents[1],
        timeout=10,
    )
    assert json.loads(output) == report
    assert record.lease.token not in output and record.lease.owner not in output
    assert durable_bytes(store, journal) == before


def test_live_process_without_token_is_not_counted_by_successor(fixture):
    store, journal, _, record = fixture
    store.release_renewable(record.lease)
    successor = store.acquire_renewable("codex", owner=record.lease.owner, limit=1)
    report = audit_sessions(store, journal.directory)
    assert not report["observations_consistent"]
    assert report["status_counts"] == {"live_guardian_without_current_lease": 1}
    assert report["reader_compatible_slot_counts"] == {"codex": 1}
    store.renew(successor)


def test_dead_guardian_retained_and_released_states(fixture):
    store, journal, process, record = fixture
    process.terminate()
    process.wait(timeout=5)
    report = audit_sessions(store, journal.directory)
    assert not report["observations_consistent"]
    assert report["status_counts"] == {"dead_guardian_with_retained_lease": 1}
    store.release_renewable(record.lease)
    report = audit_sessions(store, journal.directory)
    assert report["observations_consistent"]
    assert report["status_counts"] == {"historical_dead_guardian": 1}


def test_expired_token_and_reader_bound_are_not_live(fixture):
    store, journal, _, record = fixture
    payload = json.loads(store.path.read_text())
    entry = payload["providers"]["codex"][0]
    now = datetime.now(UTC)
    entry.update(acquired_at=(now - timedelta(seconds=31)).isoformat(), expires_at=now.isoformat())
    store.path.write_text(json.dumps(payload))
    assert audit_sessions(store, journal.directory)["status_counts"] == {
        "live_guardian_without_current_lease": 1
    }
    incompatible = ProviderCapacityStore(store.path.parent, max_lease_seconds=29)
    report = audit_sessions(incompatible, journal.directory)
    assert report["errors"] == ["invalid_or_incompatible_checkpoint"]
    # Even with the same token, a 3960s envelope is ignored by a 3900s reader.
    entry.update(
        acquired_at=now.isoformat(), expires_at=(now + timedelta(seconds=3960)).isoformat()
    )
    store.path.write_text(json.dumps(payload))
    assert store.audit_renewable_leases([record.lease]) == ({"codex": 0}, [False], {"codex": 1})
    assert audit_sessions(store, journal.directory)["errors"] == [
        "unexpired_leases_outside_reader_bound"
    ]


@pytest.mark.parametrize("damage", ["corrupt", "missing", "symlink", "public", "fifo", "large"])
def test_invalid_primary_never_resurrects_backup(fixture, damage):
    store, journal, _, record = fixture
    # The ordinary state reader can fall back to this valid stale token; audit cannot.
    backup = store.path.with_name(store.path.name + ".bak")
    backup.write_bytes(store.path.read_bytes())
    backup.chmod(0o600)
    if damage == "corrupt":
        store.path.write_text("{")
    elif damage == "missing":
        store.path.unlink()
    elif damage == "symlink":
        store.path.unlink()
        store.path.symlink_to(backup)
    elif damage == "public":
        store.path.chmod(0o644)
    elif damage == "fifo":
        store.path.unlink()
        os.mkfifo(store.path)
    else:
        store.path.write_bytes(b" " * (1024 * 1024 + 1))
    report = audit_sessions(store, journal.directory)
    if damage == "symlink":
        # Canonical store binding also rejects the redirected handle before I/O.
        assert report["errors"] == [
            "invalid_or_incompatible_checkpoint",
            "current_capacity_primary_unavailable_or_invalid",
        ]
        assert report["records"] == []
    else:
        assert report["errors"] == ["current_capacity_primary_unavailable_or_invalid"]
        assert report["status_counts"] == {"lease_unknown": 1}
    assert not report["observations_consistent"]
    assert record.lease.token not in json.dumps(report)


def test_corrupt_checkpoint_and_duplicate_broker_fields_fail_closed(fixture):
    store, journal, _, record = fixture
    path = journal.directory / (record.session_id + ".json")
    path.write_text("{")
    report = audit_sessions(store, journal.directory)
    assert report["errors"] == ["invalid_or_incompatible_checkpoint"]
    path.write_text(json.dumps(asdict(record)))
    store.path.write_text('{"providers":{},"providers":{}}')
    assert not audit_sessions(store, journal.directory)["observations_consistent"]


@pytest.mark.parametrize("value", [None, "invalid", 2, "2026-11-02T13:00:00"])
def test_invalid_time_envelope_is_unknown_not_zero_capacity(fixture, value):
    store, journal, _, _ = fixture
    payload = json.loads(store.path.read_text())
    payload["providers"]["codex"][0]["expires_at"] = value
    store.path.write_text(json.dumps(payload))
    report = audit_sessions(store, journal.directory)
    assert not report["observations_consistent"]
    assert "reader_compatible_slot_counts" not in report
    assert report["status_counts"] == {"lease_unknown": 1}


def test_empty_journal_never_proves_account_wide_coverage(fixture):
    store, journal, _, record = fixture
    (journal.directory / (record.session_id + ".json")).unlink()
    report = audit_sessions(store, journal.directory)
    assert report["observations_consistent"] and report["records"] == []
    assert report["reader_compatible_slot_counts"] == {"codex": 1}
    assert not report["account_wide_coverage_proven"]


def test_missing_unsafe_and_excess_journal_do_not_create_or_repair(fixture, monkeypatch):
    import openhands_factory.session_audit as module

    store, journal, _, record = fixture
    missing = journal.directory / "absent"
    assert not audit_sessions(store, missing)["observations_consistent"]
    assert not missing.exists()
    journal.directory.chmod(0o755)
    assert not audit_sessions(store, journal.directory)["observations_consistent"]
    assert journal.directory.stat().st_mode & 0o777 == 0o755
    journal.directory.chmod(0o700)
    monkeypatch.setattr(module, "MAX_AUDIT_RECORDS", 1)
    journal.create(replace(record, session_id=str(uuid4())))
    report = audit_sessions(store, journal.directory)
    assert report["errors"] == ["journal_unavailable_unsafe_or_over_limit"]
    assert report["records"] == []


def test_cli_uses_configured_shared_reader_and_no_online_checks(fixture, monkeypatch, capsys):
    store, journal, _, _ = fixture
    monkeypatch.setattr(cli, "protect_process_credentials", lambda: None)
    monkeypatch.setattr(
        cli,
        "_config",
        lambda: SimpleNamespace(
            provider_capacity_dir=store.path.parent, state_dir=journal.directory.parent
        ),
    )
    monkeypatch.setattr(
        "openhands_factory.provider_capacity.maximum_agent_lease_seconds", lambda _: 3900
    )
    # Match the existing supervised canary's state-directory convention.
    journal.directory.rename(journal.directory.parent / "manual-session-identities")
    monkeypatch.setattr(cli, "_provider_startup_checks", lambda _: pytest.fail("Online probe"))
    assert cli.main(["sessions", "audit"]) == 0
    assert json.loads(capsys.readouterr().out)["reader_compatible_slot_counts"] == {"codex": 1}


@pytest.mark.parametrize("loaded", [None, 0, 1])
def test_optional_metadata_does_not_enrol_threads_or_mutate_accounting(
    fixture, monkeypatch, loaded
):
    store, journal, _, _ = fixture
    before = durable_bytes(store, journal)
    observed = {"inventory_complete": loaded is not None, "loaded_threads": loaded}
    path = journal.directory.parent / "control.sock"

    def observe(actual):
        assert actual == path
        return observed

    monkeypatch.setattr("openhands_factory.codex_observer.observe_codex", observe)
    report = audit_sessions(store, journal.directory, codex_socket=path)
    assert report["codex_manual_observer"] == observed
    assert report["observations_consistent"] == (loaded == 0)
    assert report["errors"] == (
        ["codex_manual_inventory_unavailable"]
        if loaded is None
        else ["codex_threads_not_correlated_with_broker_leases"]
        if loaded
        else []
    )
    assert not report["account_wide_coverage_proven"] and not report["continuity_authorised"]
    assert durable_bytes(store, journal) == before


def test_cli_passes_explicit_socket_and_reports_failed_inventory(fixture, monkeypatch, capsys):
    store, journal, _, _ = fixture
    monkeypatch.setattr(cli, "protect_process_credentials", lambda: None)
    monkeypatch.setattr(
        cli,
        "_config",
        lambda: SimpleNamespace(
            provider_capacity_dir=store.path.parent, state_dir=journal.directory.parent
        ),
    )
    monkeypatch.setattr(
        "openhands_factory.provider_capacity.maximum_agent_lease_seconds", lambda _: 3900
    )
    path = journal.directory.parent / "absent.sock"

    def observe(actual):
        assert actual == path
        return {"inventory_complete": False}

    monkeypatch.setattr("openhands_factory.codex_observer.observe_codex", observe)
    assert cli.main(["sessions", "audit", "--codex-socket", str(path)]) == 1
    assert "codex_manual_inventory_unavailable" in json.loads(capsys.readouterr().out)["errors"]
