import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.recovery_retention import prune_recovery_archives


def _touch_archive(path: Path, age: timedelta, now: datetime) -> None:
    path.mkdir(parents=True)
    (path / "file.txt").write_text("archived worktree content", encoding="utf-8")
    mtime = (now - age).timestamp()
    os.utime(path, (mtime, mtime))


def test_archives_older_than_retention_are_removed(tmp_path: Path) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    stale = recovery_dir / "issue-1-20260819T000000Z"
    fresh = recovery_dir / "issue-2-20260822T000000Z"
    _touch_archive(stale, timedelta(hours=100), now)
    _touch_archive(fresh, timedelta(hours=2), now)

    removed = prune_recovery_archives(recovery_dir, timedelta(hours=72), now=now)

    assert removed == [stale]
    assert not stale.exists()
    assert fresh.exists()


def test_missing_recovery_dir_is_a_noop(tmp_path: Path) -> None:
    removed = prune_recovery_archives(tmp_path / "does-not-exist", timedelta(hours=72))

    assert removed == []


def test_non_positive_retention_is_rejected(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="retention must be positive"):
        prune_recovery_archives(tmp_path, timedelta(0))


def test_a_stray_file_directly_in_recovery_dir_is_also_prunable(tmp_path: Path) -> None:
    recovery_dir = tmp_path / "recovery"
    recovery_dir.mkdir()
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    stray_file = recovery_dir / "orphaned.log"
    stray_file.write_text("leftover", encoding="utf-8")
    old_mtime = (now - timedelta(hours=200)).timestamp()
    os.utime(stray_file, (old_mtime, old_mtime))

    removed = prune_recovery_archives(recovery_dir, timedelta(hours=72), now=now)

    assert removed == [stray_file]
    assert not stray_file.exists()
