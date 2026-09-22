from __future__ import annotations

import time
from threading import Event, Thread

from openhands_factory.host_resource_gate import HostResourceGate


def test_exclusive_gate_waits_for_shared_work_and_blocks_new_shared_work() -> None:
    gate = HostResourceGate(2)
    exclusive_entered = Event()
    exclusive_release = Event()
    assert gate.acquire_shared(blocking=False)

    def run_exclusive() -> None:
        with gate.exclusive():
            exclusive_entered.set()
            exclusive_release.wait(timeout=2)

    worker = Thread(target=run_exclusive)
    worker.start()
    assert exclusive_entered.wait(timeout=0.05) is False
    deadline = time.monotonic() + 1
    while gate.acquire_shared(blocking=False):
        gate.release_shared()
        assert time.monotonic() < deadline, "exclusive waiter never received writer priority"
        time.sleep(0.001)

    gate.release_shared()
    assert exclusive_entered.wait(timeout=1)
    assert gate.acquire_shared(blocking=False) is False

    exclusive_release.set()
    worker.join(timeout=1)
    assert worker.is_alive() is False
    assert gate.acquire_shared(blocking=False)
    gate.release_shared()
