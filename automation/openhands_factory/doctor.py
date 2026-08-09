"""Read-only production readiness checks."""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.config import FactoryConfig
from openhands_factory.jobs import JobStore
from openhands_factory.models import JobState
from openhands_factory.secure_tools import podman_run_arguments
from openhands_factory.state import read_json


@dataclass(frozen=True)
class Check:
    name: str
    passed: bool
    detail: str


def worker_terminal_check(config: FactoryConfig) -> Check:
    arguments = [
        str(config.podman_path),
        *podman_run_arguments(
            config.repository,
            config.repository,
            config.task_image,
            "printf 'factory-terminal-ready\\n'",
            workspace_access="ro",
            pids_limit=32,
            memory_limit="256m",
            cpu_limit="0.25",
        ),
    ]
    try:
        result = subprocess.run(
            arguments,
            capture_output=True,
            text=True,
            timeout=60,
            check=False,
            env={
                "HOME": os.environ.get("HOME", "/var/empty"),
                "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            },
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return Check("worker-terminal", False, str(error)[-1000:])
    passed = result.returncode == 0 and result.stdout == "factory-terminal-ready\n"
    detail = "rootless constrained terminal ready"
    if not passed:
        detail = f"exit {result.returncode}: {result.stdout}{result.stderr}"[-1000:]
    return Check("worker-terminal", passed, detail)


def daemon_health_check(config: FactoryConfig, now: datetime | None = None) -> Check:
    current = now or datetime.now(UTC)
    try:
        payload = read_json(config.state_dir / "daemon.json", {})
    except (OSError, ValueError) as error:
        return Check("daemon-heartbeat", False, f"unreadable heartbeat: {error}"[-1000:])
    if not isinstance(payload, dict):
        return Check("daemon-heartbeat", False, "invalid heartbeat payload")
    status = payload.get("status")
    updated_at = payload.get("updated_at")
    if status != "running" or not isinstance(updated_at, str):
        return Check("daemon-heartbeat", False, f"status={status or 'unknown'}")
    try:
        heartbeat = datetime.fromisoformat(updated_at)
    except ValueError:
        return Check("daemon-heartbeat", False, "invalid heartbeat timestamp")
    if heartbeat.tzinfo is None:
        return Check("daemon-heartbeat", False, "heartbeat timestamp has no timezone")
    maximum_age = max(config.cooldown_seconds * 3, 60)
    age = (current - heartbeat).total_seconds()
    active_jobs = payload.get("active_jobs", [])
    active_count = len(active_jobs) if isinstance(active_jobs, list) else 0
    return Check(
        "daemon-heartbeat",
        age <= maximum_age,
        f"age={max(age, 0):.0f}s active_jobs={active_count}",
    )


def job_health_checks(config: FactoryConfig, now: datetime | None = None) -> list[Check]:
    current = now or datetime.now(UTC)
    try:
        jobs = JobStore(config.state_dir / "jobs.json").load()
    except (AttributeError, KeyError, TypeError, ValueError, OSError) as error:
        detail = f"unreadable durable job state: {error}"[-1000:]
        return [Check("jobs-quarantined", False, detail), Check("jobs-stalled", False, detail)]
    quarantined = sorted(
        (identifier for identifier, job in jobs.items() if job.state is JobState.QUARANTINED),
        key=int,
    )
    stall_threshold = current - timedelta(minutes=config.max_task_minutes + 15)
    terminal_states = {JobState.DONE, JobState.QUARANTINED}
    stalled = sorted(
        (
            identifier
            for identifier, job in jobs.items()
            if job.state not in terminal_states and job.updated_at < stall_threshold
        ),
        key=int,
    )
    return [
        Check(
            "jobs-quarantined",
            not quarantined,
            "none" if not quarantined else f"issues={','.join(quarantined)}",
        ),
        Check(
            "jobs-stalled",
            not stalled,
            "none" if not stalled else f"issues={','.join(stalled)}",
        ),
    ]


def run_doctor(config: FactoryConfig, *, online: bool = False) -> list[Check]:
    checks: list[Check] = []
    checks.append(
        Check("repository", (config.repository / ".git").exists(), str(config.repository))
    )
    checks.append(Check("podman", config.podman_path.is_file(), str(config.podman_path)))
    checks.append(worker_terminal_check(config))
    for executable in ("git", "node", "npm", "python"):
        path = shutil.which(executable)
        checks.append(Check(executable, path is not None, path or "not found"))
    for directory in (config.state_dir, config.log_dir, config.profile_store, config.worktree_dir):
        exists_and_writable = directory.exists() and os.access(directory, os.W_OK)
        checks.append(
            Check(
                f"writable:{directory}",
                exists_and_writable,
                "ready" if exists_and_writable else "missing or not writable",
            )
        )
    usage = shutil.disk_usage(config.state_dir if config.state_dir.exists() else Path("/"))
    free_gib = usage.free / 1024**3
    checks.append(
        Check(
            "disk-free",
            free_gib >= config.minimum_free_disk_gib,
            f"{free_gib:.1f} GiB available, {config.minimum_free_disk_gib:.1f} GiB required",
        )
    )
    for script in (
        config.repository / "scripts/verify-constitution.mjs",
        config.repository / "scripts/check-conflict-markers.mjs",
    ):
        checks.append(Check(f"script:{script.name}", script.is_file(), str(script)))
    checks.append(daemon_health_check(config))
    checks.extend(job_health_checks(config))
    if online:
        from openhands_factory.provider_profiles import validate_gemini, validate_opencode

        try:
            validate_opencode(config)
            checks.append(Check("opencode-go", True, config.opencode_model))
        except (RuntimeError, ValueError) as error:
            checks.append(Check("opencode-go", False, str(error)))
        try:
            profile = validate_gemini(config)
            checks.append(Check("gemini", profile is not None, config.gemini_model))
        except (RuntimeError, ValueError) as error:
            checks.append(Check("gemini", False, str(error)))
    systemd = subprocess.run(
        (
            "systemd-analyze",
            "verify",
            str(config.repository / "config/systemd/hellotalk-factory.service"),
        ),
        capture_output=True,
        text=True,
        check=False,
    )
    checks.append(Check("systemd-unit", systemd.returncode == 0, systemd.stderr.strip() or "valid"))
    return checks
