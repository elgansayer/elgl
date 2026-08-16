"""Headless PTY wrapper for interactive CLIs.

Intercepts interactive prompts, strips ANSI color codes, and standardizes
CLI output so the State Machine and Sandbox can digest it cleanly.
"""

import os
import pty
import re
import select
from subprocess import Popen


class PTYWrapper:
    """Wrap an interactive CLI to run headlessly."""

    def __init__(self, command: list[str]) -> None:
        self.command = command

    def execute(self) -> str:
        """Execute the command in a pseudo-terminal and normalize its output."""
        master, slave = pty.openpty()

        process = Popen(
            self.command,
            stdin=slave,
            stdout=slave,
            stderr=slave,
            close_fds=True,
        )
        os.close(slave)

        output: list[str] = []
        ansi_escape = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")

        try:
            while process.poll() is None:
                readable, _, _ = select.select([master], [], [], 0.1)
                if master in readable:
                    try:
                        data = os.read(master, 1024).decode("utf-8", errors="replace")
                        clean_data = ansi_escape.sub("", data)
                        output.append(clean_data)

                        if "Do you want to run this bash command? [Y/n]" in clean_data:
                            os.write(master, b"Y\n")
                        elif "Continue? (y/n)" in clean_data:
                            os.write(master, b"y\n")
                    except OSError:
                        break
        finally:
            os.close(master)

        return "".join(output)
