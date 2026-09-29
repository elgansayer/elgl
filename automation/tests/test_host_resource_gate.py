from __future__ import annotations

from pathlib import Path
from threading import Event, Thread

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
