"""Owned real processes and private checkpoints, without vendor or broker writes on recovery."""

import json
import os
import stat
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor
from dataclasses import asdict, replace
from pathlib import Path
from uuid import uuid4

import pytest

from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.session_identity import (
    ProcessIdentity,
    SessionCheckpoint,
    SessionIdentityJournal,
)


@pytest.fixture
def owned_process():
    child = subprocess.Popen([sys.executable, "-c", "import time;time.sleep(30)"])
    try:
        yield child
    finally:
        if child.poll() is None:
            child.kill()
        child.wait(timeout=5)


@pytest.fixture
def checkpoint(tmp_path, owned_process):
    store = ProviderCapacityStore(tmp_path / "broker", max_lease_seconds=3900)
    handle = store.acquire_renewable("codex", owner="manual:owned-fixture", limit=1)
    return SessionCheckpoint(str(uuid4()), ProcessIdentity.capture(owned_process.pid), handle)


def test_real_process_identity_is_live_then_dead(owned_process):
    identity = ProcessIdentity.capture(owned_process.pid)
    assert identity.pid == owned_process.pid and identity.uid == os.geteuid()
    assert identity.matches_live()
    owned_process.kill()
    # A zombie is dead too, before its owner has called wait().
    os.waitid(os.P_PID, owned_process.pid, os.WEXITED | os.WNOWAIT)
    assert not identity.matches_live()
    owned_process.wait(timeout=5)
    assert not identity.matches_live()


@pytest.mark.parametrize("field", ["start_ticks", "boot_id", "uid"])
def test_stale_identity_never_matches_a_live_owned_process(owned_process, field):
    identity = ProcessIdentity.capture(owned_process.pid)
    value = str(uuid4()) if field == "boot_id" else getattr(identity, field) + 1
    assert not replace(identity, **{field: value}).matches_live()
    assert owned_process.poll() is None


def test_nondumpable_guardian_uid_is_not_confused_with_procfs_ownership():
    child = subprocess.Popen(
        [
            sys.executable,
            "-c",
            "import ctypes,time;lib=ctypes.CDLL(None);assert lib.prctl(4,0,0,0,0)==0;"
            "assert lib.prctl(15,b'np539 ) test',0,0,0)==0;"
            "print('ready',flush=True);time.sleep(20)",
        ],
        stdout=subprocess.PIPE,
        text=True,
    )
    try:
        assert child.stdout.readline().strip() == "ready"
        identity = ProcessIdentity.capture(child.pid)
        assert identity.uid == os.geteuid() and identity.matches_live()
    finally:
        child.kill()
        child.communicate(timeout=5)


def test_private_round_trip_never_changes_broker_or_process_state(tmp_path, checkpoint):
    journal = SessionIdentityJournal(tmp_path / "sessions")
    before = Path(checkpoint.lease.store_path).read_bytes()
    journal.create(checkpoint)
    assert journal.load(checkpoint.session_id) == checkpoint
    assert Path(checkpoint.lease.store_path).read_bytes() == before
    assert checkpoint.guardian.matches_live()
    assert stat.S_IMODE(journal.directory.stat().st_mode) == 0o700
    path = journal.directory / (checkpoint.session_id + ".json")
    assert stat.S_IMODE(path.stat().st_mode) == 0o600
    assert set(json.loads(path.read_text())) == {
        "session_id",
        "guardian",
        "lease",
        "schema_version",
    }


def test_checkpoint_survives_fresh_interpreter_without_renewal(tmp_path, checkpoint):
    journal = SessionIdentityJournal(tmp_path / "sessions")
    journal.create(checkpoint)
    before = Path(checkpoint.lease.store_path).read_bytes()
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "import sys;from pathlib import Path;"
            "from openhands_factory.session_identity import SessionIdentityJournal;"
            "r=SessionIdentityJournal(Path(sys.argv[1])).load(sys.argv[2]);"
            "assert r.guardian.matches_live();print(r.session_id)",
            str(journal.directory),
            checkpoint.session_id,
        ],
        cwd=Path(__file__).parents[1],
        env={**os.environ, "PYTHONPATH": str(Path(__file__).parents[1])},
        capture_output=True,
        text=True,
        timeout=8,
        check=False,
    )
    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == checkpoint.session_id
    assert Path(checkpoint.lease.store_path).read_bytes() == before


def test_record_remains_readable_after_exit_without_claiming_liveness(
    tmp_path, checkpoint, owned_process
):
    journal = SessionIdentityJournal(tmp_path / "sessions")
    journal.create(checkpoint)
    owned_process.kill()
    owned_process.wait(timeout=5)
    assert journal.load(checkpoint.session_id) == checkpoint
    assert not journal.load(checkpoint.session_id).guardian.matches_live()
    with pytest.raises(ProcessLookupError):
        journal.create(replace(checkpoint, session_id=str(uuid4())))


def test_concurrent_creators_cannot_overwrite_checkpoint(tmp_path, checkpoint):
    journal = SessionIdentityJournal(tmp_path / "sessions")

    def create():
        try:
            journal.create(checkpoint)
        except FileExistsError:
            return False
        return True

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: create(), range(12)))
    assert sum(results) == 1
    assert journal.load(checkpoint.session_id) == checkpoint


@pytest.mark.parametrize("name", ["../escape", "", "unknown", str(uuid4()).upper()])
def test_untrusted_record_names_are_refused_before_file_access(tmp_path, name):
    journal = SessionIdentityJournal(tmp_path / "sessions")
    with pytest.raises(ValueError):
        journal.load(name)
    assert list(journal.directory.iterdir()) == []


@pytest.mark.parametrize("kind", ["symlink", "hardlink", "fifo", "directory", "public"])
def test_unsafe_checkpoint_files_are_refused(tmp_path, checkpoint, kind):
    journal = SessionIdentityJournal(tmp_path / "sessions")
    path = journal.directory / (checkpoint.session_id + ".json")
    target = tmp_path / "target"
    target.write_text(json.dumps(asdict(checkpoint)))
    target.chmod(0o600)
    before = target.read_bytes()
    if kind == "symlink":
        path.symlink_to(target)
    elif kind == "hardlink":
        path.hardlink_to(target)
    elif kind == "fifo":
        os.mkfifo(path, 0o600)
    elif kind == "directory":
        path.mkdir(mode=0o700)
    else:
        path.write_bytes(before)
        path.chmod(0o644)
    with pytest.raises((OSError, ValueError)):
        journal.load(checkpoint.session_id)
    assert target.read_bytes() == before
    with pytest.raises(FileExistsError):
        journal.create(checkpoint)


def test_unsafe_journal_directory_is_not_silently_repaired(tmp_path):
    public = tmp_path / "public"
    public.mkdir(mode=0o755)
    with pytest.raises(ValueError):
        SessionIdentityJournal(public)
    assert stat.S_IMODE(public.stat().st_mode) == 0o755
    private = tmp_path / "private"
    private.mkdir(mode=0o700)
    link = tmp_path / "link"
    link.symlink_to(private, target_is_directory=True)
    with pytest.raises(OSError):
        SessionIdentityJournal(link)


@pytest.mark.parametrize(
    "change",
    [
        lambda v: v.update(schema_version=2),
        lambda v: v.update(schema_version=True),
        lambda v: v.update(command="must never be retained"),
        lambda v: v.update(session_id=str(uuid4())),
        lambda v: v["guardian"].update(pid=True),
        lambda v: v["guardian"].update(uid=os.geteuid() + 1),
        lambda v: v["guardian"].update(start_ticks=0),
        lambda v: v["guardian"].update(boot_id="invalid"),
        lambda v: v["lease"].update(lease_seconds=3960),
        lambda v: v["lease"].update(protocol_version=2),
        lambda v: v["lease"].pop("protocol_version"),
        lambda v: v["lease"].update(token="invalid"),
        lambda v: v["lease"].update(store_path="relative"),
    ],
)
def test_malformed_or_wrong_identity_records_fail_closed(tmp_path, checkpoint, change):
    journal = SessionIdentityJournal(tmp_path / "sessions")
    journal.create(checkpoint)
    path = journal.directory / (checkpoint.session_id + ".json")
    value = json.loads(path.read_text())
    change(value)
    path.write_text(json.dumps(value))
    with pytest.raises(ValueError):
        journal.load(checkpoint.session_id)


@pytest.mark.parametrize("raw", [b"{partial", b"\xff", b"[]", b"x" * 16385])
def test_corruption_is_not_replaced_by_a_stale_backup(tmp_path, checkpoint, raw):
    journal = SessionIdentityJournal(tmp_path / "sessions")
    journal.create(checkpoint)
    path = journal.directory / (checkpoint.session_id + ".json")
    backup = path.with_suffix(".json.bak")
    backup.write_bytes(path.read_bytes())
    path.write_bytes(raw)
    with pytest.raises(ValueError):
        journal.load(checkpoint.session_id)
    assert path.read_bytes() == raw
