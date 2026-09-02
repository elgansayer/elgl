"""Age-, size-, and pressure-bounded retention for recovery archives.

Recovery archives preserve work that cannot safely remain in a retired Git
worktree. They are deliberately durable, but durability cannot mean unbounded
storage: a burst of failures can create enough archives to fill the Factory
state volume well before the age-based retention window expires.

The daemon calls :func:`prune_recovery_archives` on its normal housekeeping
cadence even while scheduling is storage-blocked. In addition to the configured
age limit, this module therefore enforces a total archive budget and restores
free-space hysteresis by removing the oldest completed archives first.
"""

from __future__ import annotations

import logging
import os
import shutil
import stat
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

LOGGER = logging.getLogger(__name__)
_GIB = 1024**3
_DEFAULT_MAX_TOTAL_GIB = 2.0
_DEFAULT_RESERVE_GIB = 5.0
_DEFAULT_HEADROOM_GIB = 1.0
_DEFAULT_PRESSURE_GRACE = timedelta(minutes=10)


@dataclass(frozen=True)
class _Archive:
    path: Path
    mtime: float
    size: int
    completed: bool


def _positive_environment_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None:
        return default
    try:
        value = float(raw)
    except ValueError:
        LOGGER.warning("Ignoring invalid %s=%r; using %s", name, raw, default)
        return default
    if value <= 0:
        LOGGER.warning("Ignoring non-positive %s=%r; using %s", name, raw, default)
        return default
    return value


def _entry_size(path: Path) -> int:
    """Return logical archive size without following archive symlinks."""

    try:
        metadata = path.lstat()
    except OSError:
        return 0
    if not stat.S_ISDIR(metadata.st_mode):
        return metadata.st_size

    total = metadata.st_size
    try:
        children = tuple(path.iterdir())
    except OSError:
        return total
    for child in children:
        total += _entry_size(child)
    return total


def _remove_archive(archive: _Archive) -> bool:
    try:
        mode = archive.path.lstat().st_mode
        if stat.S_ISDIR(mode):
            shutil.rmtree(archive.path)
        else:
            archive.path.unlink()
    except FileNotFoundError:
        return True
    except OSError:
        LOGGER.exception("Could not remove recovery archive %s", archive.path)
        return False
    return not os.path.lexists(archive.path)


def _archive_inventory(recovery_dir: Path) -> list[_Archive]:
    archives: list[_Archive] = []
    try:
        entries = tuple(recovery_dir.iterdir())
    except OSError:
        LOGGER.exception("Could not enumerate recovery directory %s", recovery_dir)
        return archives
    for entry in entries:
        try:
            metadata = entry.lstat()
        except OSError:
            continue
        is_directory = stat.S_ISDIR(metadata.st_mode)
        completed = not is_directory or (entry / "RECOVERY.txt").is_file()
        archives.append(_Archive(entry, metadata.st_mtime, _entry_size(entry), completed))
    return sorted(archives, key=lambda archive: (archive.mtime, archive.path.name))


def prune_recovery_archives(
    recovery_dir: Path,
    retention: timedelta,
    *,
    now: datetime | None = None,
    max_total_bytes: int | None = None,
    minimum_free_bytes: int | None = None,
    target_free_bytes: int | None = None,
    minimum_archives: int = 1,
    pressure_grace: timedelta = _DEFAULT_PRESSURE_GRACE,
) -> list[Path]:
    """Delete old archives and recover bounded free space.

    Age is judged by each archive's mtime rather than by parsing its name. After
    expired entries are removed, non-expired archives are evicted oldest-first
    when their combined size exceeds ``max_total_bytes`` or the filesystem is
    below ``target_free_bytes``. Archives newer than ``pressure_grace`` are not
    pressure-pruned because another worker may still be creating them.

    The defaults are intentionally production-safe and can be tuned without a
    daemon rollout:

    ``FACTORY_RECOVERY_MAX_TOTAL_GIB``
        Maximum aggregate archive payload (default 2 GiB).
    ``FACTORY_MINIMUM_FREE_DISK_GIB``
        Scheduling reserve (default 5 GiB).
    ``FACTORY_RECOVERY_FREE_HEADROOM_GIB``
        Space restored above the scheduling reserve (default 1 GiB).

    At least ``minimum_archives`` completed archives are retained during normal
    free-space enforcement. The floor is dropped when the archive budget is
    already exceeded or free space is below the scheduling reserve, so one giant
    archive cannot permanently deadlock the Factory. A directory is considered
    complete only after ``RECOVERY.txt`` exists, matching the archive writer's
    final step. Paths are reported only after deletion succeeds.
    """

    if retention <= timedelta(0):
        raise ValueError("retention must be positive")
    if minimum_archives < 0:
        raise ValueError("minimum_archives cannot be negative")
    if pressure_grace < timedelta(0):
        raise ValueError("pressure_grace cannot be negative")
    if not recovery_dir.is_dir():
        return []

    reserve_gib = _positive_environment_float("FACTORY_MINIMUM_FREE_DISK_GIB", _DEFAULT_RESERVE_GIB)
    headroom_gib = _positive_environment_float(
        "FACTORY_RECOVERY_FREE_HEADROOM_GIB", _DEFAULT_HEADROOM_GIB
    )
    budget_gib = _positive_environment_float(
        "FACTORY_RECOVERY_MAX_TOTAL_GIB", _DEFAULT_MAX_TOTAL_GIB
    )
    archive_budget = int(budget_gib * _GIB) if max_total_bytes is None else max_total_bytes
    reserve = int(reserve_gib * _GIB) if minimum_free_bytes is None else minimum_free_bytes
    target = reserve + int(headroom_gib * _GIB) if target_free_bytes is None else target_free_bytes
    if archive_budget <= 0:
        raise ValueError("max_total_bytes must be positive")
    if reserve < 0:
        raise ValueError("minimum_free_bytes cannot be negative")
    if target < reserve:
        raise ValueError("target_free_bytes cannot be below minimum_free_bytes")

    current = now or datetime.now(UTC)
    cutoff = current.timestamp() - retention.total_seconds()
    grace_cutoff = current.timestamp() - pressure_grace.total_seconds()
    inventory = _archive_inventory(recovery_dir)
    removed: list[Path] = []
    reclaimed = 0

    survivors: list[_Archive] = []
    for archive in inventory:
        if archive.mtime >= cutoff:
            survivors.append(archive)
            continue
        if _remove_archive(archive):
            removed.append(archive.path)
            reclaimed += archive.size
        else:
            survivors.append(archive)

    try:
        filesystem = shutil.disk_usage(recovery_dir)
    except OSError:
        LOGGER.exception("Could not inspect recovery filesystem usage for %s", recovery_dir)
        return removed

    # disk_usage() runs after age-based deletions, so its free count already
    # includes those reclaimed bytes. Adding reclaimed again would overestimate
    # headroom and stop pressure pruning too early.
    projected_free = filesystem.free
    retained_size = sum(archive.size for archive in survivors)
    candidates = [
        archive for archive in survivors if archive.completed and archive.mtime <= grace_cutoff
    ]
    while retained_size > archive_budget or projected_free < target:
        critical = projected_free < reserve
        over_budget = retained_size > archive_budget
        keep_floor = 0 if critical or over_budget else minimum_archives
        if len(survivors) <= keep_floor or not candidates:
            break
        archive = candidates.pop(0)
        if archive not in survivors:
            continue
        if not _remove_archive(archive):
            continue
        survivors.remove(archive)
        removed.append(archive.path)
        retained_size = max(retained_size - archive.size, 0)
        reclaimed += archive.size
        try:
            # Logical file sizes can differ from actually released blocks for
            # sparse files, hard links, compression, and filesystem metadata.
            # Re-measure instead of assuming every logical byte became free.
            projected_free = shutil.disk_usage(recovery_dir).free
        except OSError:
            LOGGER.exception(
                "Could not re-measure recovery filesystem usage after removing %s",
                archive.path,
            )
            projected_free += archive.size

    if removed:
        LOGGER.info(
            "factory.storage.recovery_pruned count=%d reclaimed_bytes=%d "
            "retained_bytes=%d projected_free_bytes=%d",
            len(removed),
            reclaimed,
            retained_size,
            projected_free,
        )
    return removed
