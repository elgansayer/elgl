from pathlib import Path
from types import SimpleNamespace

import pytest

from openhands_factory.worktree_cache import prune_inactive_worktree_caches


def _usage(free: int) -> SimpleNamespace:
    return SimpleNamespace(total=1_000, used=1_000 - free, free=free)


def test_pressure_cleanup_skips_active_worktrees_and_symlinks(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    active_cache = tmp_path / "issue-10/automation/.mypy_cache"
    inactive_cache = tmp_path / "issue-11/automation/.mypy_cache"
    active_cache.mkdir(parents=True)
    inactive_cache.mkdir(parents=True)
    (active_cache / "active.json").write_text("active", encoding="utf-8")
    (inactive_cache / "stale.json").write_text("stale", encoding="utf-8")
    outside = tmp_path / "outside"
    outside.mkdir()
    symlink = tmp_path / "issue-12/automation/.mypy_cache"
    symlink.parent.mkdir(parents=True)
    symlink.symlink_to(outside, target_is_directory=True)
    symlinked_parent = tmp_path / "issue-13/automation"
    symlinked_parent.parent.mkdir(parents=True)
    (outside / ".mypy_cache").mkdir()
    symlinked_parent.symlink_to(outside, target_is_directory=True)

    free = iter((_usage(10), _usage(30)))
    monkeypatch.setattr(
        "openhands_factory.worktree_cache.shutil.disk_usage", lambda path: next(free)
    )

    removed = prune_inactive_worktree_caches(
        tmp_path,
        {"10"},
        minimum_free_bytes=20,
        target_free_bytes=30,
    )

    assert removed == [inactive_cache]
    assert active_cache.is_dir()
    assert not inactive_cache.exists()
    assert symlink.is_symlink()
    assert symlinked_parent.is_symlink()
    assert (outside / ".mypy_cache").is_dir()
    assert outside.is_dir()


def test_cleanup_does_nothing_when_target_headroom_exists(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    cache = tmp_path / "issue-11/.pytest_cache"
    cache.mkdir(parents=True)
    monkeypatch.setattr(
        "openhands_factory.worktree_cache.shutil.disk_usage",
        lambda path: _usage(40),
    )

    assert (
        prune_inactive_worktree_caches(
            tmp_path,
            set(),
            minimum_free_bytes=20,
            target_free_bytes=30,
        )
        == []
    )
    assert cache.is_dir()


def test_cleanup_rejects_target_below_reserve(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="below minimum"):
        prune_inactive_worktree_caches(
            tmp_path,
            set(),
            minimum_free_bytes=30,
            target_free_bytes=20,
        )
