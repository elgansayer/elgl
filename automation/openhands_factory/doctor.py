"""Read-only production readiness checks."""

from __future__ import annotations

import os
import shutil
import subprocess
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.architecture_guard import (
    check_factory_architecture,
    check_retired_swarm,
)
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
                        warning=True,
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
    warning = False
    if passed and used_resource_fallback:
        detail = "rootless terminal ready without nested cgroup limits"
        warning = True
    if not passed:
        detail = f"exit {result.returncode}: {result.stdout}{result.stderr}"[-1000:]
    return Check("worker-terminal", passed, detail, warning)


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
        return [Check("jobs-stalled", False, detail)]
    try:
        jobs = JobStore(jobs_path).load()
    except (AttributeError, KeyError, TypeError, ValueError, OSError) as error:
        detail = f"unreadable durable job state: {error}"[-1000:]
        return [Check("jobs-stalled", False, detail)]
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
            "jobs-stalled",
            True,
            "none" if not stalled else f"retry/recovery pending: issues={','.join(stalled)}",
            bool(stalled),
        ),
    ]


def leaked_port_environment_check() -> Check:
    port = os.environ.get("PORT")
    if port is None:
        return Check("leaked-port-env", True, "PORT is not set")
    return Check(
        "leaked-port-env",
        False,
        f"PORT={port} is set in the daemon's environment and will leak into every subprocess, "
        "including the frontend-e2e dev server - remove it from factory.env",
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
            f"no pull request yet; active_jobs={len(active_jobs)}",
            True,
        )
    latest = max(job.updated_at for job in pull_request_jobs)
    age_hours = max((current - latest).total_seconds(), 0) / 3600
    detail = f"last pull request progress={age_hours:.1f}h ago; active_jobs={len(active_jobs)}"
    warning = age_hours > config.max_no_pr_hours
    return Check("no-pr-progress", True, detail, warning)


def agent_provider_checks(config: FactoryConfig) -> list[Check]:
    """Report configured agent availability without attempting a paid run."""
    from openhands_factory.agents import (
        AgentProvider,
        ClaudeCodeProvider,
        CodexProvider,
        GoogleAgentProvider,
        OpenCodeProvider,
    )
    configured = config.agents.providers

    def command_for(name: str, default: str) -> str:
        provider_config = configured.get(name)
        return provider_config.command if provider_config and provider_config.command else default

    providers: dict[str, AgentProvider] = {
        "claude": ClaudeCodeProvider(command=command_for("claude", "claude")),
        "codex": CodexProvider(command=command_for("codex", "codex")),
        "google": GoogleAgentProvider(command=command_for("google", "gemini")),
        "opencode": OpenCodeProvider(command=command_for("opencode", "opencode")),
    }
    checks: list[Check] = [
        Check(
            "agent-routing",
            config.agents.routing_enabled,
            "enabled" if config.agents.routing_enabled else "OpenHands compatibility mode",
            warning=not config.agents.routing_enabled,
        )
    ]
    for name, provider in providers.items():
        provider_config = configured.get(name)
        if provider_config is None or not provider_config.enabled:
            checks.append(Check(f"agent:{name}", True, "disabled"))
            continue
        health = provider.health()
        checks.append(
            Check(
                f"agent:{name}",
                health.status.value in {"healthy", "degraded"},
                health.detail or health.status.value,
                warning=health.status.value != "healthy",
            )
        )
    openhands = configured.get("openhands")
    checks.append(
        Check(
            "agent:openhands",
            bool(openhands and openhands.enabled),
            "enabled as emergency fallback" if openhands and openhands.enabled else "disabled",
            warning=not bool(openhands and openhands.enabled),
        )
    )
    return checks


def run_doctor(config: FactoryConfig, *, online: bool = False) -> list[Check]:
    """Return diagnostics only. Doctor never pages operators."""
    checks: list[Check] = []
    architecture = check_factory_architecture(config.factory_architecture)
    checks.append(Check("factory-architecture", architecture.passed, architecture.detail))
    single_owner = check_retired_swarm(config.repository)
    checks.append(Check("single-owner", single_owner.passed, single_owner.detail))
    checks.append(Check("provider-chain", True, "Codex OAuth -> OpenCode Go"))
    checks.extend(agent_provider_checks(config))
    checks.append(
        Check("repository", (config.repository / ".git").exists(), str(config.repository))
    )
    checks.append(Check("podman", config.podman_path.is_file(), str(config.podman_path)))
    openai_ready = openai_credentials_available(config)
    checks.append(
        Check(
            "openai-subscription",
            True,
            config.openai_model if openai_ready else "OAuth credentials missing or unavailable",
            warning=not openai_ready,
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
    checks.extend(job_health_checks(config))
    checks.append(no_pr_progress_check(config))
    if online:
        from openhands_factory.provider_profiles import validate_opencode

        try:
            validate_opencode(config)
            checks.append(Check("opencode-go", True, config.opencode_model))
        except (RuntimeError, ValueError) as error:
            checks.append(Check("opencode-go", False, str(error)))
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
