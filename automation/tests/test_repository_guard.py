import os
import subprocess
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import pytest

from openhands_factory.exceptions import RepositorySafetyError
from openhands_factory.repository_guard import (
    branch_name,
    ensure_push_target,
    find_conflict_markers,
    request_process_shutdown,
    reset_process_shutdown,
    run_process,
)


def _process_alive(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except ProcessLookupError:
        return False
    return True


def _assert_eventually_dead(pid: int, timeout: float = 5.0) -> None:
    # A killed process can briefly still answer os.kill(pid, 0) as a zombie
    # until its new parent (init, after reparenting) reaps it - under load that
    # can take a moment, so poll for "gone" rather than checking once.
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if not _process_alive(pid):
            return
        time.sleep(0.05)
    assert not _process_alive(pid)


def test_run_process_returns_output_and_exit_code(tmp_path: Path) -> None:
    result = run_process(("bash", "-lc", "echo out; echo err >&2; exit 3"), tmp_path)
    assert result.returncode == 3
    assert result.stdout.strip() == "out"
    assert result.stderr.strip() == "err"


def test_run_process_kills_backgrounded_children_the_command_leaves_behind(
    tmp_path: Path,
) -> None:
    """A verification command can background a long-lived child of its own (the
    frontend-e2e step's dev server is exactly this shape). Even when the
    foreground command exits cleanly, run_process must not leave that child
    running - otherwise it's orphaned (reparented to init) and leaks
    indefinitely, exactly as observed live on the host after a timeout.
    """
    pid_file = tmp_path / "child.pid"
    command = f"sleep 300 >/dev/null 2>&1 & echo $! > {pid_file}"
    run_process(("bash", "-lc", command), tmp_path)

    for _ in range(50):
        if pid_file.exists():
            break
        time.sleep(0.1)
    child_pid = int(pid_file.read_text().strip())

    _assert_eventually_dead(child_pid)


def test_run_process_kills_the_process_group_on_timeout(tmp_path: Path) -> None:
    pid_file = tmp_path / "child.pid"
    command = f"sleep 300 & echo $! > {pid_file}; wait"
    with pytest.raises(subprocess.TimeoutExpired):
        run_process(("bash", "-lc", command), tmp_path, timeout=1)

    for _ in range(50):
        if pid_file.exists():
            break
        time.sleep(0.1)
    child_pid = int(pid_file.read_text().strip())

    _assert_eventually_dead(child_pid)


def test_shutdown_stops_active_repository_processes_and_blocks_new_starts(
    tmp_path: Path,
) -> None:
    pid_file = tmp_path / "process.pid"
    reset_process_shutdown()
    try:
        with ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(
                run_process,
                ("bash", "-lc", f"echo $$ > {pid_file}; sleep 300"),
                tmp_path,
            )
            for _ in range(50):
                if pid_file.exists():
                    break
                time.sleep(0.1)
            process_pid = int(pid_file.read_text().strip())

            request_process_shutdown()

            result = future.result(timeout=10)
            assert result.returncode != 0
            _assert_eventually_dead(process_pid)
            with pytest.raises(RuntimeError, match="Factory shutdown"):
                run_process(("true",), tmp_path)
    finally:
        reset_process_shutdown()


def test_safe_branch_name() -> None:
    assert branch_name("issue-42", "Fix Payment Webhook!") == "factory/issue-42-fix-payment-webhook"


@pytest.mark.parametrize("branch", ["main", "master"])
def test_direct_push_is_forbidden(branch: str) -> None:
    with pytest.raises(RepositorySafetyError):
        ensure_push_target(branch, "main")


def test_arbitrary_non_factory_branch_is_forbidden_without_extra_allowed() -> None:
    with pytest.raises(RepositorySafetyError):
        ensure_push_target("bolt/optimize-quests", "main")


def test_extra_allowed_permits_the_assigned_pull_request_branch() -> None:
    ensure_push_target("bolt/optimize-quests", "main", extra_allowed="bolt/optimize-quests")


def test_extra_allowed_does_not_permit_a_different_branch() -> None:
    with pytest.raises(RepositorySafetyError):
        ensure_push_target("some/other-branch", "main", extra_allowed="bolt/optimize-quests")


@pytest.mark.parametrize("branch", ["main", "master"])
def test_protected_branch_is_forbidden_even_with_extra_allowed(branch: str) -> None:
    with pytest.raises(RepositorySafetyError):
        ensure_push_target(branch, "main", extra_allowed=branch)


def test_conflict_marker_detection(tmp_path: Path) -> None:
    clean = tmp_path / "clean.txt"
    clean.write_text("ordinary content\n", encoding="utf-8")
    conflict = tmp_path / "conflict.txt"
    conflict.write_text("<<<<<<< ours\n=======\n>>>>>>> theirs\n", encoding="utf-8")
    assert find_conflict_markers(tmp_path) == [conflict]
