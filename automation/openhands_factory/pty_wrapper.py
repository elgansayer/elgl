"""Headless PTY wrapper for interactive CLIs.

Intercepts known confirmation prompts, strips ANSI escape sequences, captures the real
child exit status and guarantees bounded cleanup on timeout.
"""

from __future__ import annotations

import os
import pty
import re
import select
import time
from dataclasses import dataclass
from subprocess import Popen, TimeoutExpired


@dataclass(frozen=True)
class PTYResult:
    output: str
    exit_code: int
    timed_out: bool = False


class PTYWrapper:
    """Wrap an interactive CLI to run headlessly without invoking a shell."""

    def __init__(self, command: list[str]) -> None:
        self.command = command

    def execute_result(
        self,
        *,
        timeout_seconds: float | None = None,
        max_output_bytes: int = 1_000_000,
    ) -> PTYResult:
        if max_output_bytes <= 0:
            raise ValueError("max_output_bytes must be positive")

        master, slave = pty.openpty()
        process = Popen(
            self.command,
            stdin=slave,
            stdout=slave,
            stderr=slave,
            close_fds=True,
            start_new_session=True,
        )
        os.close(slave)

        chunks: list[bytes] = []
        captured = 0
        timed_out = False
        started = time.monotonic()
        ansi_escape = re.compile(rb"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")

        try:
            while process.poll() is None:
                if timeout_seconds is not None and time.monotonic() - started >= timeout_seconds:
                    timed_out = True
                    process.terminate()
                    try:
                        process.wait(timeout=5)
                    except TimeoutExpired:
                        process.kill()
                        process.wait(timeout=5)
                    break

                readable, _, _ = select.select([master], [], [], 0.1)
                if master not in readable:
                    continue
                try:
                    data = os.read(master, 4096)
                except OSError:
                    break
                if not data:
                    break
                clean = ansi_escape.sub(b"", data)
                remaining = max_output_bytes - captured
                if remaining > 0:
                    chunk = clean[:remaining]
                    chunks.append(chunk)
                    captured += len(chunk)

                clean_text = clean.decode("utf-8", errors="replace")
                if "Do you want to run this bash command? [Y/n]" in clean_text:
                    os.write(master, b"Y\n")
                elif "Continue? (y/n)" in clean_text:
                    os.write(master, b"y\n")

            # Drain any final PTY bytes after the child exits.
            while captured < max_output_bytes:
                readable, _, _ = select.select([master], [], [], 0)
                if master not in readable:
                    break
                try:
                    data = os.read(master, min(4096, max_output_bytes - captured))
                except OSError:
                    break
                if not data:
                    break
                clean = ansi_escape.sub(b"", data)
                chunks.append(clean)
                captured += len(clean)
        finally:
            if process.poll() is None:
                process.terminate()
                try:
                    process.wait(timeout=5)
                except TimeoutExpired:
                    process.kill()
                    process.wait(timeout=5)
            os.close(master)

        output = b"".join(chunks).decode("utf-8", errors="replace")
        exit_code = process.returncode if process.returncode is not None else 1
        if timed_out and exit_code == 0:
            exit_code = 124
        return PTYResult(output=output, exit_code=exit_code, timed_out=timed_out)

    def execute(self) -> str:
        """Compatibility wrapper returning only normalized output."""
        return self.execute_result().output
