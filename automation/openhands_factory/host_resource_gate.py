"""Fair shared/exclusive admission for memory-heavy host work."""

from __future__ import annotations

from collections.abc import Iterator
from contextlib import contextmanager
from threading import Condition


class HostResourceGate:
    """Allow bounded agents or one exclusive verification, with writer priority."""

    def __init__(self, shared_limit: int) -> None:
        if shared_limit <= 0:
            raise ValueError("shared_limit must be positive")
        self._shared_limit = shared_limit
        self._shared_active = 0
        self._exclusive_active = False
        self._exclusive_waiters = 0
        self._condition = Condition()

    def acquire_shared(self, *, blocking: bool = True) -> bool:
        """Acquire one lightweight slot without overtaking a waiting verifier."""

        with self._condition:

            def available() -> bool:
                return (
                    not self._exclusive_active
                    and self._exclusive_waiters == 0
                    and self._shared_active < self._shared_limit
                )

            if not blocking and not available():
                return False
            while not available():
                self._condition.wait()
            self._shared_active += 1
            return True

    def release_shared(self) -> None:
        with self._condition:
            if self._shared_active <= 0:
                raise RuntimeError("shared host resource slot released without acquisition")
            self._shared_active -= 1
            self._condition.notify_all()

    @contextmanager
    def exclusive(self) -> Iterator[None]:
        """Wait atomically for every shared slot, then exclude new agents."""

        with self._condition:
            self._exclusive_waiters += 1
            try:
                while self._exclusive_active or self._shared_active:
                    self._condition.wait()
                self._exclusive_active = True
            finally:
                self._exclusive_waiters -= 1
        try:
            yield
        finally:
            with self._condition:
                self._exclusive_active = False
                self._condition.notify_all()
