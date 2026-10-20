import os
from collections import namedtuple
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import TypedDict

import pytest

from openhands_factory.recovery_retention import prune_recovery_archives

DiskUsage = namedtuple("DiskUsage", "total used free")


class PruneOptions(TypedDict):
    max_total_bytes: int
    minimum_free_bytes: int
    target_free_bytes: int
    pressure_grace: timedelta


def _touch_archive(
    path: Path,
    age: timedelta,
    now: datetime,
    *,
    payload: bytes = b"archived worktree content",
) -> None:
    path.mkdir(parents=True)
    (path / "file.bin").write_bytes(payload)
    (path / "RECOVERY.txt").write_text("complete", encoding="utf-8")
    mtime = (now - age).timestamp()
    os.utime(path / "file.bin", (mtime, mtime))
    os.utime(path, (mtime, mtime))


def _unpressured_kwargs() -> PruneOptions:
    return {
        "max_total_bytes": 10_000_000,
        "minimum_free_bytes": 0,
        "target_free_bytes": 0,
        "pressure_grace": timedelta(0),
    }


def _archive_size(path: Path) -> int:
    return path.lstat().st_size + sum(item.lstat().st_size for item in path.rglob("*"))


def test_archives_older_than_retention_are_removed(tmp_path: Path) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    stale = recovery_dir / "issue-1-20260819T000000Z"
    fresh = recovery_dir / "issue-2-20260822T000000Z"
    _touch_archive(stale, timedelta(hours=100), now)
    _touch_archive(fresh, timedelta(hours=2), now)

    removed = prune_recovery_archives(
        recovery_dir, timedelta(hours=72), now=now, **_unpressured_kwargs()
    )

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

    removed = prune_recovery_archives(
        recovery_dir, timedelta(hours=72), now=now, **_unpressured_kwargs()
    )

    assert removed == [stray_file]
    assert not stray_file.exists()


def test_size_budget_prunes_oldest_before_retention_expires(tmp_path: Path) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    oldest = recovery_dir / "oldest"
    middle = recovery_dir / "middle"
    newest = recovery_dir / "newest"
    for path, age in ((oldest, 3), (middle, 2), (newest, 1)):
        _touch_archive(path, timedelta(hours=age), now, payload=b"x" * 64)

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=_archive_size(newest),
        minimum_free_bytes=0,
        target_free_bytes=0,
        pressure_grace=timedelta(0),
    )

    assert removed == [oldest, middle]
    assert not oldest.exists()
    assert not middle.exists()
    assert newest.exists()


def test_low_disk_pressure_restores_headroom_before_ttl(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    oldest = recovery_dir / "oldest"
    newest = recovery_dir / "newest"
    _touch_archive(oldest, timedelta(hours=3), now, payload=b"x" * 128)
    _touch_archive(newest, timedelta(hours=2), now, payload=b"x" * 128)
    usage = iter(
        (
            DiskUsage(total=10_000, used=9_950, free=50),
            DiskUsage(total=10_000, used=9_800, free=200),
        )
    )
    monkeypatch.setattr(
        "openhands_factory.recovery_retention.shutil.disk_usage",
        lambda path: next(usage),
    )

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=10_000,
        minimum_free_bytes=40,
        target_free_bytes=150,
        pressure_grace=timedelta(0),
    )

    assert removed == [oldest]
    assert not oldest.exists()
    assert newest.exists()


def test_age_reclamation_is_not_double_counted_as_free_space(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    stale = recovery_dir / "stale"
    fresh = recovery_dir / "fresh"
    _touch_archive(stale, timedelta(hours=100), now, payload=b"x" * 128)
    _touch_archive(fresh, timedelta(hours=2), now, payload=b"x" * 128)
    usage = iter(
        (
            # This first value is measured after stale was deleted and therefore
            # already includes its reclaimed blocks.
            DiskUsage(total=10_000, used=9_950, free=50),
            DiskUsage(total=10_000, used=9_800, free=200),
        )
    )
    monkeypatch.setattr(
        "openhands_factory.recovery_retention.shutil.disk_usage",
        lambda path: next(usage),
    )

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=10_000,
        minimum_free_bytes=40,
        target_free_bytes=150,
        minimum_archives=0,
        pressure_grace=timedelta(0),
    )

    assert removed == [stale, fresh]
    assert not stale.exists()
    assert not fresh.exists()


def test_critical_pressure_can_remove_the_last_archive(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    archive = recovery_dir / "only"
    _touch_archive(archive, timedelta(hours=2), now, payload=b"x" * 128)
    usage = iter(
        (
            DiskUsage(total=10_000, used=9_990, free=10),
            DiskUsage(total=10_000, used=9_800, free=200),
        )
    )
    monkeypatch.setattr(
        "openhands_factory.recovery_retention.shutil.disk_usage",
        lambda path: next(usage),
    )

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=10_000,
        minimum_free_bytes=100,
        target_free_bytes=150,
        minimum_archives=1,
        pressure_grace=timedelta(0),
    )

    assert removed == [archive]
    assert not archive.exists()


def test_pressure_does_not_race_a_recent_archive_being_written(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    recent = recovery_dir / "recent"
    _touch_archive(recent, timedelta(minutes=1), now, payload=b"x" * 128)
    monkeypatch.setattr(
        "openhands_factory.recovery_retention.shutil.disk_usage",
        lambda path: DiskUsage(total=10_000, used=9_990, free=10),
    )

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=1,
        minimum_free_bytes=100,
        target_free_bytes=150,
        pressure_grace=timedelta(minutes=10),
    )

    assert removed == []
    assert recent.exists()


def test_one_completed_archive_larger_than_budget_is_pruned(tmp_path: Path) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    archive = recovery_dir / "oversized"
    _touch_archive(archive, timedelta(hours=2), now, payload=b"x" * 256)

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=_archive_size(archive) - 1,
        minimum_free_bytes=0,
        target_free_bytes=0,
        minimum_archives=1,
        pressure_grace=timedelta(0),
    )

    assert removed == [archive]
    assert not archive.exists()


def test_pressure_does_not_delete_an_incomplete_archive(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    archive = recovery_dir / "still-copying"
    _touch_archive(archive, timedelta(hours=2), now, payload=b"x" * 128)
    (archive / "RECOVERY.txt").unlink()
    monkeypatch.setattr(
        "openhands_factory.recovery_retention.shutil.disk_usage",
        lambda path: DiskUsage(total=10_000, used=9_990, free=10),
    )

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=1,
        minimum_free_bytes=100,
        target_free_bytes=150,
        pressure_grace=timedelta(0),
    )

    assert removed == []
    assert archive.exists()


def test_symlink_completion_marker_does_not_make_archive_prunable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    archive = recovery_dir / "symlink-marker"
    _touch_archive(archive, timedelta(hours=2), now, payload=b"x" * 128)
    (archive / "RECOVERY.txt").unlink()
    (archive / "RECOVERY.txt").symlink_to("file.bin")
    monkeypatch.setattr(
        "openhands_factory.recovery_retention.shutil.disk_usage",
        lambda path: DiskUsage(total=10_000, used=9_990, free=10),
    )

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=1,
        minimum_free_bytes=100,
        target_free_bytes=150,
        pressure_grace=timedelta(0),
    )

    assert removed == []
    assert archive.exists()


def test_minimum_floor_counts_only_completed_archives(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    completed = recovery_dir / "completed"
    incomplete = recovery_dir / "incomplete"
    _touch_archive(completed, timedelta(hours=3), now, payload=b"x" * 128)
    _touch_archive(incomplete, timedelta(hours=2), now, payload=b"x" * 128)
    (incomplete / "RECOVERY.txt").unlink()
    monkeypatch.setattr(
        "openhands_factory.recovery_retention.shutil.disk_usage",
        lambda path: DiskUsage(total=10_000, used=9_950, free=50),
    )

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=10_000,
        minimum_free_bytes=40,
        target_free_bytes=150,
        minimum_archives=1,
        pressure_grace=timedelta(0),
    )

    assert removed == []
    assert completed.exists()
    assert incomplete.exists()


def test_failed_disk_remeasurement_does_not_invent_free_space(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    oldest = recovery_dir / "oldest"
    newest = recovery_dir / "newest"
    _touch_archive(oldest, timedelta(hours=3), now, payload=b"x" * 128)
    _touch_archive(newest, timedelta(hours=2), now, payload=b"x" * 128)
    calls = 0

    def disk_usage(path: Path) -> DiskUsage:
        nonlocal calls
        calls += 1
        if calls == 1:
            return DiskUsage(total=10_000, used=9_950, free=50)
        raise OSError("measurement unavailable")

    monkeypatch.setattr("openhands_factory.recovery_retention.shutil.disk_usage", disk_usage)

    removed = prune_recovery_archives(
        recovery_dir,
        timedelta(hours=72),
        now=now,
        max_total_bytes=10_000,
        minimum_free_bytes=40,
        target_free_bytes=150,
        minimum_archives=0,
        pressure_grace=timedelta(0),
    )

    assert removed == [oldest, newest]
    assert not oldest.exists()
    assert not newest.exists()


def test_failed_deletion_is_not_reported(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    recovery_dir = tmp_path / "recovery"
    now = datetime(2026, 8, 23, 0, 0, tzinfo=UTC)
    stale = recovery_dir / "stale"
    _touch_archive(stale, timedelta(hours=100), now)

    def fail(path: Path) -> None:
        raise PermissionError(path)

    monkeypatch.setattr("openhands_factory.recovery_retention.shutil.rmtree", fail)

    removed = prune_recovery_archives(
        recovery_dir, timedelta(hours=72), now=now, **_unpressured_kwargs()
    )

    assert removed == []
    assert stale.exists()
