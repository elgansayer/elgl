"""Atomic, recoverable, and permission-safe state persistence."""

from __future__ import annotations

import json
import os
import tempfile
from pathlib import Path
from typing import Any


def _backup_path(path: Path) -> Path:
    return path.with_name(f"{path.name}.bak")


def _fsync_directory(path: Path) -> None:
    """Persist directory-entry changes after atomic renames on Linux."""
    descriptor = os.open(path, os.O_RDONLY | getattr(os, "O_DIRECTORY", 0))
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def _is_valid_json(path: Path) -> bool:
    try:
        with path.open(encoding="utf-8") as handle:
            json.load(handle)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError):
        return False
    return True


def atomic_write_json(path: Path, value: object) -> None:
    """Write JSON durably while retaining the previous valid generation.

    The primary file is replaced atomically. Before replacement, a valid previous
    primary is moved to ``.bak``. That means a crash between the two renames still
    leaves at least one complete generation available to ``read_json``. Corrupt
    primaries are never promoted over a known-good backup.
    """
    path.parent.mkdir(mode=0o700, parents=True, exist_ok=True)
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    backup = _backup_path(path)
    try:
        os.fchmod(descriptor, 0o600)
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(value, handle, indent=2, sort_keys=True, default=str)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())

        if path.exists() and _is_valid_json(path):
            os.replace(path, backup)
        os.replace(temporary_name, path)
        _fsync_directory(path.parent)
    finally:
        if os.path.exists(temporary_name):
            os.unlink(temporary_name)


def _load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def read_json(path: Path, default: Any) -> Any:
    """Read the primary generation, falling back to the last known-good backup.

    Missing state with no backup still returns the caller-provided default. A
    malformed primary no longer creates an infinite daemon restart loop: the
    previous valid generation is returned instead, and the next successful state
    write replaces the corrupt primary while preserving that backup.
    """
    backup = _backup_path(path)
    if path.exists():
        try:
            return _load_json(path)
        except (UnicodeDecodeError, json.JSONDecodeError):
            if backup.exists():
                return _load_json(backup)
            raise
    if backup.exists():
        return _load_json(backup)
    return default
