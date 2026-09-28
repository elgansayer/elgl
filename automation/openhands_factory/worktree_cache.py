"""Pressure-only cleanup for disposable caches in inactive worktrees."""

from __future__ import annotations

import logging
import os
import shutil
import stat
from pathlib import Path

LOGGER = logging.getLogger(__name__)

_CACHE_PATHS = (
    Path(".mypy_cache"),
    Path(".pytest_cache"),
    Path(".ruff_cache"),
    Path("automation/.mypy_cache"),
    Path("automation/.pytest_cache"),
    Path("automation/.ruff_cache"),
)


def _safe_cache_directory(worktree: Path, relative: Path) -> tuple[float, Path] | None:
    """Resolve a known cache without crossing a symlinked path component."""

    current = worktree
    for part in relative.parts[:-1]:
        current /= part
        try:
            metadata = current.lstat()
        except OSError:
            return None
        if not stat.S_ISDIR(metadata.st_mode):
            return None
    cache = current / relative.name
    try:
        metadata = cache.lstat()
    except OSError:
        return None
    if not stat.S_ISDIR(metadata.st_mode):
        return None
    return metadata.st_mtime, cache


def _cache_candidates(worktree_dir: Path, protected_task_ids: set[str]) -> list[Path]:
    protected_names = {f"issue-{task_id}" for task_id in protected_task_ids}
    candidates: list[tuple[float, Path]] = []
    try:
        worktrees = tuple(worktree_dir.iterdir())
    except OSError:
        LOGGER.exception("Could not enumerate Factory worktrees in %s", worktree_dir)
        return []

    for worktree in worktrees:
        if worktree.name in protected_names:
            continue
        try:
            worktree_mode = worktree.lstat().st_mode
        except OSError:
            continue
        if not stat.S_ISDIR(worktree_mode):
            continue
        for relative in _CACHE_PATHS:
            candidate = _safe_cache_directory(worktree, relative)
            if candidate is not None:
                candidates.append(candidate)
    return [path for _, path in sorted(candidates, key=lambda item: (item[0], str(item[1])))]


def prune_inactive_worktree_caches(
    worktree_dir: Path,
    protected_task_ids: set[str],
    *,
    minimum_free_bytes: int,
    target_free_bytes: int,
) -> list[Path]:
    """Restore disk headroom by deleting only known caches outside live worktrees."""

    if minimum_free_bytes < 0:
        raise ValueError("minimum_free_bytes cannot be negative")
    if target_free_bytes < minimum_free_bytes:
        raise ValueError("target_free_bytes cannot be below minimum_free_bytes")
    if not worktree_dir.is_dir():
        return []

    try:
        free_bytes = shutil.disk_usage(worktree_dir).free
    except OSError:
        LOGGER.exception("Could not inspect worktree filesystem usage for %s", worktree_dir)
        return []
    if free_bytes >= target_free_bytes:
        return []

    removed: list[Path] = []
    for cache in _cache_candidates(worktree_dir, protected_task_ids):
        try:
            shutil.rmtree(cache)
        except FileNotFoundError:
            continue
        except OSError:
            LOGGER.exception("Could not remove disposable worktree cache %s", cache)
            continue
        if os.path.lexists(cache):
            continue
        removed.append(cache)
        try:
            free_bytes = shutil.disk_usage(worktree_dir).free
        except OSError:
            LOGGER.exception("Could not re-measure worktree filesystem usage after %s", cache)
            break
        if free_bytes >= target_free_bytes:
            break

    if removed:
        LOGGER.info(
            "factory.storage.worktree_caches_pruned count=%d free_bytes=%d target_bytes=%d",
            len(removed),
            free_bytes,
            target_free_bytes,
        )
    return removed
