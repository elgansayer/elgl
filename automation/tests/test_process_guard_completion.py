"""Owned trusted-channel interleavings, without providers or production state."""

import socket
import subprocess

import pytest

from openhands_factory.agents import process as module
from openhands_factory.exceptions import ProviderCapacityUnavailable


class Clock:
    def __init__(self):
        self.now = 100.0

    def monotonic(self):
        return self.now

    def sleep(self, seconds):
        self.now += seconds


class Guardian:
    def __init__(self):
        self.returncode = None
        self.on_poll = lambda: None
        self.waits = []

    def poll(self):
        self.on_poll()
        return self.returncode

    def wait(self, timeout):
        self.waits.append(timeout)
        if self.returncode is None:
            raise subprocess.TimeoutExpired("owned guardian", timeout)
        return self.returncode


class Observer:
    def emit(self):
        pass


class Control:
    def __init__(self, *, chunked=False):
        self.parent, self.peer = socket.socketpair()
        self.parent.setblocking(False)
        self.peer.setblocking(False)
        self.pulses = 0
        self.chunked = chunked

    def fileno(self):
        return self.parent.fileno()

    def recv(self, count):
        return self.parent.recv(min(count, 1) if self.chunked else count)

    def sendall(self, value):
        self.parent.sendall(value)
        self.pulses += 1
        if self.pulses == 1:
            assert self.peer.recv(4096) == b"H"
            self.peer.sendall(b"A")

    def close(self):
        self.parent.close()
        self.peer.close()


def completion_interleaving(
    monkeypatch,
    *,
    tokens=b"D",
    exit_code=0,
    live=False,
    chunked=False,
    after_exit_poll=False,
    refusal=None,
    expire_during_authorisation=False,
):
    clock, guardian, control = Clock(), Guardian(), Control(chunked=chunked)
    authorisations, injected = [], []
    real_select = module.select.select

    def finish():
        if clock.now >= 101.0 and control.pulses == 1 and not injected:
            control.peer.sendall(tokens)
            control.peer.close()
            guardian.returncode = None if live else exit_code
            injected.append(True)

    def select(read, write, error, timeout):
        ready = real_select(read, write, error, timeout)
        if not after_exit_poll:
            if clock.now >= 101.0 and control.pulses == 1 and not injected:
                assert not ready[0]
            # The trusted peer completes just AFTER this poll returned empty.
            finish()
        return ready

    def authorise():
        authorisations.append(True)
        if len(authorisations) > 1:
            if expire_during_authorisation:
                clock.now = 111.0
            if refusal == "ownership":
                raise ProviderCapacityUnavailable("owned slot revoked", retry_after_seconds=1)
            if refusal == "io":
                raise OSError("owned broker unavailable")

    if after_exit_poll:
        guardian.on_poll = finish
    runner = module.AgentProcessRunner(guard_timeout_seconds=5, heartbeat_check=authorise)
    try:
        with monkeypatch.context() as patches:
            patches.setattr(module.select, "select", select)
            patches.setattr(module.time, "monotonic", clock.monotonic)
            patches.setattr(module.time, "sleep", clock.sleep)
            result = runner._wait_guarded(guardian, control, 110.0, Observer())
        assert injected
        assert authorisations
        return result, len(authorisations), guardian.waits
    finally:
        control.close()


@pytest.mark.parametrize("exit_code", [0, 7, 125])
def test_completion_after_empty_poll_before_heartbeat_write(monkeypatch, exit_code):
    result, authorisations, _ = completion_interleaving(monkeypatch, exit_code=exit_code)
    assert authorisations == 2
    # Actual child exit propagation happens in run(); D is not a claim of exit0.
    assert result == (False, False)


def test_exited_guard_drains_split_acknowledgement_and_completion(monkeypatch):
    result, authorisations, _ = completion_interleaving(
        monkeypatch, tokens=b"AD", chunked=True, after_exit_poll=True
    )
    assert authorisations == 1
    assert result == (False, False)


@pytest.mark.parametrize("refusal", ["ownership", "io"])
def test_revocation_wins_even_when_trusted_completion_is_queued(monkeypatch, refusal):
    result, authorisations, _ = completion_interleaving(monkeypatch, refusal=refusal)
    assert authorisations == 2
    assert result == (False, True)


@pytest.mark.parametrize("tokens", [b"", b"A", b"F", b"DF", b"DX"])
@pytest.mark.parametrize("chunked", [False, True])
def test_closed_channel_without_valid_success_stays_failed(monkeypatch, tokens, chunked):
    result, _, _ = completion_interleaving(monkeypatch, tokens=tokens, chunked=chunked)
    assert result == (False, True)


def test_done_without_terminal_guardian_remains_bounded_failure(monkeypatch):
    result, _, waits = completion_interleaving(monkeypatch, live=True)
    assert result == (False, True)
    assert all(0 < timeout <= 1 for timeout in waits)


def test_deadline_during_authorisation_cannot_be_saved_by_queued_completion(monkeypatch):
    result, _, _ = completion_interleaving(monkeypatch, expire_during_authorisation=True)
    assert any(result)
