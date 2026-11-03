from __future__ import annotations

import json
from pathlib import Path
from threading import Event, Thread

import pytest

import openhands_factory.host_resource_gate as module
from openhands_factory.host_resource_gate import HostResourceGate


def test_exclusive_gate_waits_for_shared_work_and_blocks_new_shared_work(
    tmp_path: Path,
) -> None:
    state_path = tmp_path / "host-resources.json"
    gate = HostResourceGate(state_path, 2)
    other_daemon_gate = HostResourceGate(state_path, 2)
    exclusive_entered = Event()
    exclusive_release = Event()
    assert gate.available_shared_slots() == 2
    assert gate.acquire_shared("test:first")
    assert other_daemon_gate.available_shared_slots() == 1

    def run_exclusive() -> None:
        with other_daemon_gate.exclusive():
            exclusive_entered.set()
            exclusive_release.wait(timeout=2)

    worker = Thread(target=run_exclusive)
    worker.start()
    assert exclusive_entered.wait(timeout=0.05) is False
    assert gate.available_shared_slots() == 0
    assert gate.acquire_shared("test:blocked") is False

    gate.release_shared("test:first")
    assert exclusive_entered.wait(timeout=1)
    assert gate.acquire_shared("test:still-blocked") is False

    exclusive_release.set()
    worker.join(timeout=1)
    assert worker.is_alive() is False
    assert other_daemon_gate.available_shared_slots() == 2
    assert gate.acquire_shared("test:after")
    gate.release_shared("test:after")


@pytest.mark.parametrize("error", [TimeoutError, KeyboardInterrupt, SystemExit])
def test_interrupted_admission_clears_only_writer_and_preserves_live_reader(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, error: type[BaseException]
) -> None:
    path = tmp_path / "gate.json"
    reader = HostResourceGate(path, 2)
    writer = HostResourceGate(path, 2)
    assert reader.acquire_shared("retained-reader")

    def interrupt(_seconds: float) -> None:
        payload = json.loads(path.read_text())
        assert payload["exclusive"] is not None
        assert len(payload["shared"]) == 1
        raise error("controlled admission interruption")

    monkeypatch.setattr(module.time, "sleep", interrupt)
    with pytest.raises(error, match="controlled admission"), writer.exclusive():
        pytest.fail("A live reader must prevent admission")
    payload = json.loads(path.read_text())
    assert payload["exclusive"] is None
    assert [entry["owner"] for entry in payload["shared"]] == ["retained-reader"]
    assert reader.available_shared_slots() == 1
    reader.release_shared("retained-reader")
    assert reader.available_shared_slots() == 2
    assert reader.acquire_shared("after-cancelled-writer")


def test_exception_after_saved_admission_claim_does_not_leave_priority(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    gate = HostResourceGate(tmp_path / "gate.json", 2)
    assert gate.acquire_shared("reader")
    original_save = gate._save
    calls = 0

    def save_then_interrupt(payload: dict[str, object]) -> None:
        nonlocal calls
        original_save(payload)
        calls += 1
        if calls == 1:
            raise TimeoutError("cancelled immediately after persisted admission")

    monkeypatch.setattr(gate, "_save", save_then_interrupt)
    with pytest.raises(TimeoutError, match="persisted admission"), gate.exclusive():
        pytest.fail("Reader is still live")
    assert gate.available_shared_slots() == 1
    assert json.loads(gate.path.read_text())["exclusive"] is None


def test_interrupted_wait_behind_other_writer_never_clears_its_owner(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = tmp_path / "gate.json"
    holder, contender = HostResourceGate(path, 2), HostResourceGate(path, 2)

    def interrupt(_seconds: float) -> None:
        raise TimeoutError("contender cancelled")

    with holder.exclusive():
        original = json.loads(path.read_text())["exclusive"]
        monkeypatch.setattr(module.time, "sleep", interrupt)
        with pytest.raises(TimeoutError, match="contender cancelled"), contender.exclusive():
            pytest.fail("Other writer still holds the gate")
        assert json.loads(path.read_text())["exclusive"] == original
        assert holder.available_shared_slots() == 0
    assert holder.available_shared_slots() == 2


def test_exception_in_held_body_releases_writer(tmp_path: Path) -> None:
    gate = HostResourceGate(tmp_path / "gate.json", 2)
    with pytest.raises(TimeoutError, match="held operation"), gate.exclusive():
        raise TimeoutError("held operation cancelled")
    assert gate.available_shared_slots() == 2
