"""Trusted Linux process guardian. This file also runs with Python isolated mode."""

from __future__ import annotations

import argparse
import ctypes
import os
import select
import signal
import socket
import subprocess
import sys
import time
from contextlib import suppress
from pathlib import Path

FAILURE_EXIT = 125

# Kept as a coordinator-owned argument: the provider sandbox masks the host
# checkout before executing this trusted namespace init. The model runs as its
# child, never as namespace PID1, and cannot inherit the lifetime/control FDs.
NAMESPACE_INIT = r"""
import ctypes, os, select, signal, subprocess, sys, time
library = ctypes.CDLL(None, use_errno=True)
if library.prctl(4, 0, 0, 0, 0) != 0:
    raise OSError(ctypes.get_errno(), 'cannot protect namespace init')
life = int(sys.argv[1])
os.set_blocking(life, False)
if select.select([life], [], [], 0)[0] and os.read(life, 1) == b'':
    sys.exit(125)
stopping = False
def stop(signum, frame):
    global stopping
    stopping = True
signal.signal(signal.SIGTERM, stop)
signal.signal(signal.SIGINT, stop)
worker = subprocess.Popen(sys.argv[2:], close_fds=True, start_new_session=True)
try:
    while worker.poll() is None and not stopping:
        if select.select([life], [], [], 0.1)[0] and os.read(life, 1) == b'':
            stopping = True
    if stopping:
        try: os.killpg(worker.pid, signal.SIGTERM)
        except ProcessLookupError: pass
        try: worker.wait(timeout=2)
        except subprocess.TimeoutExpired: pass
        # Exiting PID1 makes the kernel kill all namespace descendants,
        # including ones that escaped a process group or cleared PDEATHSIG.
        sys.exit(125)
    code = worker.returncode
    sys.exit(code if code >= 0 else 128 - code)
finally:
    os.close(life)
"""


def _protect_parent(expected_parent: int) -> None:
    library = ctypes.CDLL(None, use_errno=True)
    if library.prctl(1, signal.SIGKILL, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), "cannot arm parent-death containment")
    if os.getppid() != expected_parent:
        raise RuntimeError("parent changed before containment was armed")
    if library.prctl(4, 0, 0, 0, 0) != 0:
        raise OSError(ctypes.get_errno(), "cannot protect guardian memory")


def _stop_worker(worker: subprocess.Popen[bytes] | None) -> None:
    if worker is None or worker.poll() is not None:
        return
    with suppress(ProcessLookupError):
        os.killpg(worker.pid, signal.SIGTERM)
    try:
        worker.wait(timeout=3)
    except subprocess.TimeoutExpired:
        with suppress(ProcessLookupError):
            os.killpg(worker.pid, signal.SIGKILL)
        with suppress(subprocess.TimeoutExpired):
            worker.wait(timeout=1)


def supervise(
    control_fd: int,
    life_read: int,
    life_write: int,
    expected_parent: int,
    timeout: float,
    command: list[str],
    *,
    pass_lifetime: bool,
) -> int:
    """Run only after an authorised pulse; failure never becomes exit zero."""
    channel = socket.socket(fileno=control_fd)
    channel.setblocking(False)
    _protect_parent(expected_parent)
    stopping = False

    def stop(signum: int, frame: object) -> None:
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    worker: subprocess.Popen[bytes] | None = None
    deadline = time.monotonic() + timeout
    try:
        while not stopping and time.monotonic() < deadline:
            if select.select([channel], [], [], 0.05)[0]:
                data = channel.recv(4096)
                if not data:
                    break
                if any(value != ord("H") for value in data):
                    break
                deadline = time.monotonic() + timeout
                channel.sendall(b"A")
                if worker is None:
                    wrapper = [
                        str(Path(sys.executable).resolve()),
                        "-I",
                        str(Path(__file__).resolve()),
                        "--child-parent",
                        str(os.getpid()),
                    ]
                    worker = subprocess.Popen(
                        [*wrapper, "--", *command],
                        pass_fds=(life_read,) if pass_lifetime else (),
                        start_new_session=True,
                    )
            if worker is not None and worker.poll() is not None:
                code = worker.wait()
                channel.sendall(b"F" if code == FAILURE_EXIT else b"D")
                return code if code >= 0 else 128 - code
        # A stopped guardian's writer also closes on SIGKILL. The trusted init
        # then drains/exits independently, without cooperation from model code.
        os.close(life_write)
        life_write = -1
        _stop_worker(worker)
        with suppress(OSError):
            channel.sendall(b"F")
        return FAILURE_EXIT
    finally:
        if life_write >= 0:
            os.close(life_write)
        os.close(life_read)
        _stop_worker(worker)
        channel.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--child-parent", type=int)
    parser.add_argument("--parent", type=int)
    parser.add_argument("--control-fd", type=int)
    parser.add_argument("--life-read", type=int)
    parser.add_argument("--life-write", type=int)
    parser.add_argument("--timeout", type=float)
    parser.add_argument("--pass-lifetime", action="store_true")
    parser.add_argument("command", nargs=argparse.REMAINDER)
    args = parser.parse_args()
    command = args.command[1:] if args.command[:1] == ["--"] else args.command
    if not command:
        parser.error("a command is required")
    if args.child_parent is not None:
        _protect_parent(args.child_parent)
        try:
            os.execvpe(command[0], command, os.environ)
        except FileNotFoundError:
            return 127
        except PermissionError:
            return 126
    if (
        any(
            value is None
            for value in (
                args.parent,
                args.control_fd,
                args.life_read,
                args.life_write,
                args.timeout,
            )
        )
        or args.timeout <= 0
    ):
        parser.error("guardian identity, descriptors and positive timeout are required")
    return supervise(
        args.control_fd,
        args.life_read,
        args.life_write,
        args.parent,
        args.timeout,
        command,
        pass_lifetime=args.pass_lifetime,
    )


if __name__ == "__main__":
    raise SystemExit(main())
