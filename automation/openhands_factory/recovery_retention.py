"""Bounded retention for archived crash-recovery worktrees.

``GitWorkflow.archive_worktree`` copies a full worktree into ``recovery_dir``
on every crash-recovery path (a stale worktree with uncommitted changes,
before it is reset or removed) so nothing is silently lost. Nothing ever
deletes those archives: left alone, they accumulate without bound and
eventually exhaust the same disk-space reserve ``minimum_free_disk_gib``
protects, which permanently pauses Factory scheduling with no further log
output once the check has already failed once (the daemon only logs on
state transitions, not on every recheck of a state that hasn't changed).
"""

from __future__ import annotations

import shutil
from datetime import UTC, datetime, timedelta
from pathlib import Path


def prune_recovery_archives(
    recovery_dir: Path,
    retention: timedelta,
    *,
    now: datetime | None = None,
) -> list[Path]:
    """Delete recovery archives older than ``retention``. Returns what was removed.

    Age is judged by each archive's own mtime, not by parsing its name - the
    naming convention (``architect-<timestamp>``, ``issue-<id>-<timestamp>``)
    has varied across callers and isn't a stable contract to parse against.
    """

    if retention <= timedelta(0):
        raise ValueError("retention must be positive")
    if not recovery_dir.is_dir():
        return []

    cutoff = (now or datetime.now(UTC)).timestamp() - retention.total_seconds()
    removed: list[Path] = []
    for entry in recovery_dir.iterdir():
        try:
            mtime = entry.stat().st_mtime
        except OSError:
            continue
        if mtime >= cutoff:
            continue
        shutil.rmtree(entry, ignore_errors=True) if entry.is_dir() else entry.unlink(
            missing_ok=True
        )
        removed.append(entry)
    return removed
