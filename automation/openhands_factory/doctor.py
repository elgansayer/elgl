"""Read-only production readiness checks."""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.alerts import AlertService
from openhands_factory.config import FactoryConfig
from openhands_factory.jobs import JobStore
from openhands_factory.models import JobState
from openhands_factory.provider_profiles import openai_credentials_available
from openhands_factory.secure_tools import (
    namespace_error,
    podman_configuration_error,
    podman_run_arguments,
    resource_limit_error,
)
from openhands_factory.state import read_json


@dataclass(frozen=True)
class Check:
    name: str
    passed: bool
    detail: str
    warning: bool = False


def _podman_environment(*, include_runtime_dir: bool) -> dict[str, str]:
    environment = {
        "HOME": os.environ.get("HOME", "/var/empty"),
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
    }
    if include_runtime_dir and "XDG_RUNTIME_DIR" in os.environ:
        environment["XDG_RUNTIME_DIR"] = os.environ["XDG_RUNTIME_DIR"]
    return environment


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
            env=_podman_environment(include_runtime_dir=True),
        )
        combined = f"{result.stdout}\n{result.stderr}"
        used_namespace_fallback = result.returncode != 0 and namespace_error(combined)
        used_resource_fallback = result.returncode != 0 and (
            resource_limit_error(combined) or podman_configuration_error(combined)
        )
        if result.returncode != 0 and (used_namespace_fallback or used_resource_fallback):
            fallback_arguments = [
                str(config.podman_path),
                *podman_run_arguments(
                    config.repository,
                    config.repository,
                    config.task_image,
                    "printf 'factory-terminal-ready\\n'",
                    workspace_access="ro",
                    resource_limits=False,
                    userns="host",
                    cgroup_manager="cgroupfs",
                    pid_host=True,
                    cgroups="no-conmon",
                ),
            ]
            # This fallback needs no systemd user session (cgroup_manager=cgroupfs and
            # userns=host both sidestep it), which is also the thing intermittently
            # failing with "Failed to obtain podman configuration" on the primary
            # attempt - so leave XDG_RUNTIME_DIR out here rather than retry the same
            # flaky lookup.
            result = subprocess.run(
                fallback_arguments,
                capture_output=True,
                text=True,
                timeout=60,
                check=False,
                env=_podman_environment(include_runtime_dir=False),
            )
            if used_namespace_fallback:
                if result.returncode == 0 and result.stdout == "factory-terminal-ready\n":
                    return Check(
                        "worker-terminal",
                        True,
                        "rootless terminal ready with host user namespace fallback",
                    )
                return Check(
                    "worker-terminal",
                    False,
                    f"rootless namespace fallback failed: {result.stdout}{result.stderr}"[-1000:],
                )
    except (OSError, subprocess.TimeoutExpired) as error:
        return Check("worker-terminal", False, str(error)[-1000:])
    passed = result.returncode == 0 and result.stdout == "factory-terminal-ready\n"
    detail = "rootless constrained terminal ready"
    if passed and used_resource_fallback:
        detail = "rootless terminal ready without nested cgroup limits"
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
    if age < -maximum_age:
        return Check(
            "daemon-heartbeat",
            False,
            f"future timestamp by {-age:.0f}s active_jobs={active_count}",
        )
    return Check(
        "daemon-heartbeat",
        age <= maximum_age,
        f"age={max(age, 0):.0f}s active_jobs={active_count}",
    )


def job_health_checks(config: FactoryConfig, now: datetime | None = None) -> list[Check]:
    current = now or datetime.now(UTC)
    jobs_path = config.state_dir / "jobs.json"
    if not jobs_path.is_file():
        detail = "durable job state is missing"
        return [Check("jobs-quarantined", False, detail), Check("jobs-stalled", False, detail)]
    try:
        jobs = JobStore(jobs_path).load()
    except (AttributeError, KeyError, TypeError, ValueError, OSError) as error:
        detail = f"unreadable durable job state: {error}"[-1000:]
        return [Check("jobs-quarantined", False, detail), Check("jobs-stalled", False, detail)]
    quarantined = sorted(
        (identifier for identifier, job in jobs.items() if job.state is JobState.QUARANTINED),
        key=int,
    )
    stall_threshold = current - timedelta(minutes=config.max_task_minutes + 15)
    active_states = {
        JobState.LEASED,
        JobState.IMPLEMENTING,
        JobState.VERIFYING,
        JobState.PR_DRAFT,
        JobState.REVIEWING,
        JobState.REPAIRING,
        JobState.CI_PENDING,
        JobState.MERGE_QUEUED,
    }
    stalled = sorted(
        (
            identifier
            for identifier, job in jobs.items()
            if job.state in active_states and job.updated_at < stall_threshold
        ),
        key=int,
    )
    return [
        Check(
            "jobs-quarantined",
            True,
            "none" if not quarantined else f"ALERT: issues={','.join(quarantined)}",
            bool(quarantined),
        ),
        Check(
            "jobs-stalled",
            True,
            "none" if not stalled else f"ALERT: issues={','.join(stalled)}",
            bool(stalled),
        ),
    ]


def leaked_port_environment_check() -> Check:
    """Warn if PORT is set in the daemon's own environment.

    Not read by the factory itself, but every subprocess it spawns inherits it -
    including `npm start` during frontend-e2e verification, whose Vite-based dev
    server treats PORT as an override and silently stops binding 127.0.0.1:4200 (the
    fixed port every e2e spec and the exclusive-verification-slot logic assume). This
    previously reached production as a stray, untracked line in
    /etc/hellotalk-factory/factory.env with no code path enforcing it never comes
    back; this check is that enforcement.
    """
    port = os.environ.get("PORT")
    if port is None:
        return Check("leaked-port-env", True, "PORT is not set")
    return Check(
        "leaked-port-env",
        False,
        f"PORT={port} is set in the daemon's environment and will leak into every "
        "subprocess, including the frontend-e2e dev server - remove it from "
        "factory.env",
    )


def no_pr_progress_check(config: FactoryConfig, now: datetime | None = None) -> Check:
    current = now or datetime.now(UTC)
    daemon = read_json(config.state_dir / "daemon.json", {})
    active_jobs = daemon.get("active_jobs", []) if isinstance(daemon, dict) else []
    if not isinstance(active_jobs, list) or not active_jobs:
        return Check("no-pr-progress", True, "no active jobs to monitor")
    try:
        jobs = JobStore(config.state_dir / "jobs.json").load()
    except (AttributeError, KeyError, TypeError, ValueError, OSError) as error:
        return Check("no-pr-progress", False, f"unreadable durable job state: {error}"[-1000:])
    pull_request_jobs = [
        job for job in jobs.values() if job.pull_request is not None and job.updated_at <= current
    ]
    if not pull_request_jobs:
        return Check(
            "no-pr-progress",
            True,
            f"ALERT: no pull request yet; active_jobs={len(active_jobs)}",
            True,
        )
    latest = max(job.updated_at for job in pull_request_jobs)
    age_hours = max((current - latest).total_seconds(), 0) / 3600
    detail = f"last pull request progress={age_hours:.1f}h ago; active_jobs={len(active_jobs)}"
    warning = age_hours > config.max_no_pr_hours
    if warning:
        detail = f"ALERT: {detail}"
    return Check("no-pr-progress", True, detail, warning)


def run_doctor(config: FactoryConfig, *, online: bool = False) -> list[Check]:
    checks: list[Check] = []
    checks.append(
        Check("repository", (config.repository / ".git").exists(), str(config.repository))
    )
    checks.append(Check("podman", config.podman_path.is_file(), str(config.podman_path)))
    openai_ready = openai_credentials_available(config)
    checks.append(
        Check(
            "openai-subscription",
            openai_ready,
            config.openai_model if openai_ready else "OAuth credentials missing or unavailable",
        )
    )
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
    checks.append(leaked_port_environment_check())
    checks.append(daemon_health_check(config))
    job_checks = job_health_checks(config)
    checks.extend(job_checks)
    for check in job_checks:
        if check.detail.startswith("ALERT:"):
            AlertService(config).send(f"OpenHands factory alert: {check.name}: {check.detail}")
    progress = no_pr_progress_check(config)
    checks.append(progress)
    if progress.name == "no-pr-progress" and progress.detail.startswith("ALERT:"):
        AlertService(config).send(
            f"OpenHands factory alert: {progress.detail}. "
            f"No pull request progress for {config.max_no_pr_hours:g} hours."
        )
    if online:
        from openhands_factory.provider_profiles import validate_gemini, validate_opencode

        try:
            validate_opencode(config)
            checks.append(Check("opencode-go", True, config.opencode_model))
        except (RuntimeError, ValueError) as error:
            checks.append(Check("opencode-go", False, str(error)))
        if not config.gemini_enabled:
            checks.append(Check("gemini", True, "disabled by configuration"))
        else:
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
