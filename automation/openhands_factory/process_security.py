"""Linux process hardening for long-lived Factory credentials."""

from __future__ import annotations

import ctypes
import os
import sys

from openhands_factory.exceptions import FactoryError

_PR_SET_DUMPABLE = 4


def protect_process_credentials() -> None:
    """Block same-UID children from reading the Factory process through procfs.

    Removing a variable from ``os.environ`` does not erase the initial environment
    exposed by ``/proc/<pid>/environ``. Direct providers and verification commands
    also run in private PID namespaces, but the daemon itself still fails closed if
    this defence-in-depth control cannot be enabled on the supported Linux hosts.
    """

    if sys.platform != "linux":
        raise FactoryError("Factory credential process protection requires Linux")
    library = ctypes.CDLL(None, use_errno=True)
    if library.prctl(_PR_SET_DUMPABLE, 0, 0, 0, 0) != 0:
        error_number = ctypes.get_errno()
        raise FactoryError(
            f"Could not protect Factory process credentials: {os.strerror(error_number)}"
        )
