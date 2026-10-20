"""Deterministic snapshot of daemon/host state for stall alerts.

Gathered with plain subprocess calls at the daemon's own privilege level -
no new host access, no dependency on an agent provider being healthy. This
must always succeed (or degrade gracefully) even under the exact resource
pressure it's diagnosing, since it runs *because* something is already wrong.
"""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

DIAGNOSTIC_TIMEOUT_SECONDS = 10


def _run(*args: str, timeout: float = DIAGNOSTIC_TIMEOUT_SECONDS) -> str:
    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        output = (result.stdout or "") + (result.stderr or "")
        return output.strip() or "(no output)"
    except Exception as error:
        return f"(failed to run {' '.join(args)}: {type(error).__name__}: {error})"


def _disk_usage(path: Path) -> str:
    try:
        usage = shutil.disk_usage(path)
        free_gib = usage.free / 1024**3
        total_gib = usage.total / 1024**3
        used_pct = 100 * (1 - usage.free / usage.total) if usage.total else 0
        return f"{path}: {free_gib:.1f} GiB free of {total_gib:.1f} GiB ({used_pct:.0f}% used)"
    except OSError as error:
        return f"{path}: unavailable ({type(error).__name__})"


def gather_diagnostics(state_dir: Path, service_name: str = "hellotalk-factory.service") -> str:
    """Return a compact, human-readable diagnostic snapshot as plain text."""

    sections = [
        "## Disk usage",
        _disk_usage(Path("/")),
        _disk_usage(state_dir),
        "",
        "## Service status",
        _run("systemctl", "status", service_name, "--no-pager", "--lines=0"),
        "",
        "## Recent service log (last 30 lines)",
        _run("journalctl", "-u", service_name, "--no-pager", "-n", "30"),
        "",
        "## Largest directories under the state disk (top 8)",
        _run(
            "bash",
            "-c",
            f"du -sh {state_dir}/*/ 2>/dev/null | sort -rh | head -8",
        ),
    ]
    return "\n".join(sections)
