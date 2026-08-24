"""Read-only production readiness checks."""

from __future__ import annotations

import json
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
from openhands_factory.generation import generation_snapshot
from openhands_factory.github import REQUIRED_FACTORY_MERGE_CHECKS
from openhands_factory.jobs import JobStore
from openhands_factory.legacy_runtime import detect_legacy_runtime
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


def git_credential_helper_check(config: FactoryConfig) -> Check:
    """Confirm task-branch pushes can consume the scoped GitHub token."""

    try:
        result = subprocess.run(
            (
                "git",
                "-C",
                str(config.repository),
                "config",
                "--get-all",
                "credential.helper",
            ),
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
            env={
                "HOME": os.environ.get("HOME", "/var/empty"),
                "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
                "LANG": os.environ.get("LANG", "C.UTF-8"),
            },
        )
    except OSError as error:
        return Check("git-credential-helper", False, f"could not inspect Git config: {error}")
    helpers = result.stdout.splitlines()
    ready = (
        result.returncode == 0
        and len(helpers) >= 2
        and helpers[0] == ""
        and helpers[-1] == "!gh auth git-credential"
        and not any(value in {"store", "cache"} for value in helpers)
    )
    return Check(
        "git-credential-helper",
        ready,
        (
            "persistent helpers reset; scoped gh credential helper configured"
            if ready
            else "expected an empty helper reset followed by gh auth git-credential"
        ),
    )


def persistent_github_credentials_check(home: Path | None = None) -> Check:
    """Reject GitHub credentials readable by subscription-agent processes."""

    service_home = home or Path(os.environ.get("HOME", "/var/empty"))
    config_roots = [service_home / ".config" / "gh"]
    if configured := os.environ.get("GH_CONFIG_DIR"):
        config_roots.append(Path(configured))
    if configured := os.environ.get("XDG_CONFIG_HOME"):
        config_roots.append(Path(configured) / "gh")

    for hosts_path in dict.fromkeys(root / "hosts.yml" for root in config_roots):
        try:
            lines = hosts_path.read_text(encoding="utf-8").splitlines()
        except FileNotFoundError:
            continue
        except OSError:
            return Check(
                "persistent-github-credentials",
                False,
                "GitHub CLI credential state exists but could not be inspected safely",
            )
        for line in lines:
            key, separator, value = line.strip().partition(":")
            if separator and key == "oauth_token" and value.strip().strip("'\""):
                return Check(
                    "persistent-github-credentials",
                    False,
                    "remove GitHub CLI OAuth credentials from the agent-accessible service home",
                )

    credential_files = (
        service_home / ".git-credentials",
        service_home / ".config" / "git" / "credentials",
    )
    for credential_path in credential_files:
        try:
            populated = any(
                line.strip() and not line.lstrip().startswith("#")
                for line in credential_path.read_text(encoding="utf-8").splitlines()
            )
        except FileNotFoundError:
            continue
        except OSError:
            populated = True
        if populated:
            return Check(
                "persistent-github-credentials",
                False,
                "remove persistent Git credentials from the agent-accessible service home",
            )

    return Check(
        "persistent-github-credentials",
        True,
        "none found; GitHub access is scoped from root-only factory configuration",
    )


def verification_isolation_check() -> Check:
    """Prove repository-controlled checks can enter the hardened sandbox."""

    script = r"""
set -eu
/usr/bin/mount --make-rprivate /
/usr/bin/mount -t tmpfs -o mode=1777,nosuid,nodev tmpfs /tmp
/usr/sbin/ip link set lo up
exec /usr/bin/setpriv \
  --bounding-set=-all \
  --inh-caps=-all \
  --ambient-caps=-all \
  --no-new-privs \
  -- /bin/sh -c '
    set -- /proc/[0-9]*
    [ "$#" -eq 1 ]
    ! /usr/bin/umount /tmp 2>/dev/null
    ! /usr/bin/curl -fsS --max-time 1 https://example.com >/dev/null 2>&1
  '
"""
    try:
        result = subprocess.run(
            (
                "unshare",
                "--user",
                "--map-root-user",
                "--mount",
                "--pid",
                "--fork",
                "--mount-proc",
                "--net",
                "--kill-child",
                "/bin/sh",
                "-c",
                script,
            ),
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
            env={
                "HOME": "/var/empty",
                "LANG": os.environ.get("LANG", "C.UTF-8"),
                "PATH": "/usr/local/bin:/usr/local/sbin:/usr/bin:/usr/sbin:/bin:/sbin",
            },
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        return Check(
            "verification-isolation",
            False,
            f"verification sandbox could not start: {type(error).__name__}",
        )
    if result.returncode != 0:
        detail = f"{result.stdout}\n{result.stderr}".strip()[-1000:]
        return Check(
            "verification-isolation",
            False,
            detail or f"verification sandbox exited {result.returncode}",
        )
    return Check(
        "verification-isolation",
        True,
        "private process, mount, proc and network namespaces are available",
    )


def github_repository_access_check(config: FactoryConfig) -> Check:
    """Perform a bounded, read-only authenticated repository probe."""

    environment = {
        "GH_TOKEN": config.github_token.get_secret_value(),
        "HOME": os.environ.get("HOME", "/var/empty"),
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
    }
    try:
        result = subprocess.run(
            (
                "gh",
                "api",
                f"repos/{config.github_repository}",
                "--jq",
                ".default_branch",
            ),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
            env=environment,
        )
    except OSError as error:
        return Check("github-repository-access", False, f"could not run gh: {error}")
    if result.returncode != 0:
        return Check(
            "github-repository-access",
            False,
            f"authenticated repository probe failed with status {result.returncode}",
        )
    branch = result.stdout.strip()
    expected = config.base_branch
    return Check(
        "github-repository-access",
        branch == expected,
        (
            f"authenticated; default branch={branch}"
            if branch
            else "repository probe returned no default branch"
        ),
    )


def _ruleset_contexts(rules: list[dict[object, object]]) -> set[str]:
    contexts: set[str] = set()
    for rule in rules:
        if rule.get("type") != "required_status_checks":
            continue
        parameters = rule.get("parameters")
        if not isinstance(parameters, dict):
            continue
        checks = parameters.get("required_status_checks")
        if not isinstance(checks, list):
            continue
        contexts.update(
            context
            for check in checks
            if isinstance(check, dict)
            and isinstance((context := check.get("context")), str)
            and context
        )
    return contexts


def _ruleset_details(
    config: FactoryConfig,
    environment: dict[str, str],
    ruleset_id: int,
) -> dict[object, object] | None:
    try:
        result = subprocess.run(
            (
                "gh",
                "api",
                f"repos/{config.github_repository}/rulesets/{ruleset_id}",
            ),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
            env=environment,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None
    try:
        details = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    return details if isinstance(details, dict) else None


def _repository_owner_user(
    config: FactoryConfig,
    environment: dict[str, str],
) -> tuple[int, str] | None:
    owner, separator, _repository = config.github_repository.partition("/")
    if not separator or owner.casefold() not in config.control_github_actors:
        return None
    try:
        result = subprocess.run(
            ("gh", "api", f"users/{owner}"),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
            env=environment,
        )
    except OSError:
        return None
    if result.returncode != 0:
        return None
    try:
        account = json.loads(result.stdout)
    except json.JSONDecodeError:
        return None
    if not isinstance(account, dict):
        return None
    actor_id = account.get("id")
    login = account.get("login")
    if (
        not isinstance(actor_id, int)
        or isinstance(actor_id, bool)
        or not isinstance(login, str)
        or login.casefold() != owner.casefold()
        or account.get("type") != "User"
    ):
        return None
    return actor_id, login


def _is_exact_owner_pull_request_bypass(
    bypass_actors: object,
    owner: tuple[int, str] | None,
) -> bool:
    if owner is None or not isinstance(bypass_actors, list) or len(bypass_actors) != 1:
        return False
    actor = bypass_actors[0]
    if not isinstance(actor, dict):
        return False
    owner_id, _login = owner
    return (
        actor.get("actor_id") == owner_id
        and actor.get("actor_type") == "User"
        and actor.get("bypass_mode") == "pull_request"
    )


def github_merge_policy_check(config: FactoryConfig) -> Check:
    """Prove GitHub requires pull requests and canonical CI for Factory merges.

    Independent review is intentionally represented by a SHA-bound pull-request
    comment and the ``factory-reviewed`` label. The scheduled merge workflow
    validates that comment against the current head, so a legacy required status
    named ``factory/independent-review`` would deadlock new reviews and is rejected.
    """

    environment = {
        "GH_TOKEN": config.github_token.get_secret_value(),
        "HOME": os.environ.get("HOME", "/var/empty"),
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
    }
    try:
        result = subprocess.run(
            (
                "gh",
                "api",
                f"repos/{config.github_repository}/rules/branches/{config.base_branch}",
            ),
            capture_output=True,
            text=True,
            timeout=30,
            check=False,
            env=environment,
        )
    except OSError as error:
        return Check("github-merge-policy", False, f"could not run gh: {error}")
    if result.returncode != 0:
        return Check(
            "github-merge-policy",
            False,
            f"branch rules probe failed with status {result.returncode}",
        )
    try:
        rules = json.loads(result.stdout)
    except json.JSONDecodeError:
        return Check(
            "github-merge-policy",
            False,
            "branch rules response was not valid JSON",
        )
    if not isinstance(rules, list):
        return Check("github-merge-policy", False, "branch rules response was not a list")

    rules_by_id: dict[int, list[dict[object, object]]] = {}
    pull_request_required = False
    required_contexts: set[str] = set()
    for rule in rules:
        if not isinstance(rule, dict):
            continue
        ruleset_id = rule.get("ruleset_id")
        if isinstance(ruleset_id, int) and not isinstance(ruleset_id, bool):
            rules_by_id.setdefault(ruleset_id, []).append(rule)
        rule_type = rule.get("type")
        if rule_type == "pull_request":
            pull_request_required = True
        if rule_type != "required_status_checks":
            continue
        parameters = rule.get("parameters")
        if not isinstance(parameters, dict):
            continue
        checks = parameters.get("required_status_checks")
        if not isinstance(checks, list):
            continue
        for check in checks:
            if not isinstance(check, dict):
                continue
            context = check.get("context")
            if isinstance(context, str) and context:
                required_contexts.add(context)

    missing = sorted(REQUIRED_FACTORY_MERGE_CHECKS - required_contexts)
    details_by_id = {
        ruleset_id: details
        for ruleset_id in rules_by_id
        if (details := _ruleset_details(config, environment, ruleset_id)) is not None
    }
    baseline_rulesets: list[int] = []
    legacy_review_rulesets: list[int] = []
    manual_ci_rulesets: list[int] = []
    manual_bypass_actor: str | None = None
    owner_lookup_complete = False
    owner: tuple[int, str] | None = None

    for ruleset_id, ruleset_rules in rules_by_id.items():
        details = details_by_id.get(ruleset_id)
        if details is None or details.get("enforcement") != "active":
            continue
        contexts = _ruleset_contexts(ruleset_rules)
        if "factory/independent-review" in contexts:
            legacy_review_rulesets.append(ruleset_id)
        bypass_actors = details.get("bypass_actors")
        has_pull_request = any(
            rule.get("type") == "pull_request" for rule in ruleset_rules
        )
        exact_owner_bypass = False
        if bypass_actors != []:
            if not owner_lookup_complete:
                owner = _repository_owner_user(config, environment)
                owner_lookup_complete = True
            exact_owner_bypass = _is_exact_owner_pull_request_bypass(
                bypass_actors, owner
            )
            if exact_owner_bypass and owner is not None:
                manual_bypass_actor = owner[1]
        allowed_bypass = bypass_actors == [] or exact_owner_bypass
        is_baseline = (
            has_pull_request
            and "CI / required" in contexts
            and allowed_bypass
        )
        if is_baseline:
            baseline_rulesets.append(ruleset_id)
            if exact_owner_bypass:
                manual_ci_rulesets.append(ruleset_id)

    passed = (
        pull_request_required
        and not missing
        and bool(baseline_rulesets)
        and not legacy_review_rulesets
    )
    detail_parts = [
        f"pull-request-rule={'present' if pull_request_required else 'missing'}",
        (
            "required-statuses=" + ",".join(sorted(REQUIRED_FACTORY_MERGE_CHECKS))
            if not missing
            else "missing-statuses=" + ",".join(missing)
        ),
        (
            "baseline-ruleset=" + ",".join(str(value) for value in baseline_rulesets)
            if baseline_rulesets
            else "no active ruleset requiring pull requests and CI with an allowed bypass policy"
        ),
        "independent-review=comment",
        (
            "legacy-review-status-rulesets="
            + ",".join(str(value) for value in legacy_review_rulesets)
            if legacy_review_rulesets
            else "legacy-review-status-rulesets=none"
        ),
        (
            f"manual-ci-bypass={manual_bypass_actor}; ruleset="
            + ",".join(str(value) for value in manual_ci_rulesets)
            if manual_bypass_actor is not None and manual_ci_rulesets
            else "manual-ci-bypass=disabled"
        ),
    ]
    return Check("github-merge-policy", passed, "; ".join(detail_parts))


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
                        "rootless terminal ready with a host user namespace fallback",
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
        JobState.SECURITY_REVIEW,
        JobState.VERIFYING,
        JobState.PR_DRAFT,
        JobState.REVIEWING,
        JobState.REPAIRING,
        JobState.QUALITY_REPAIRING,
        JobState.CI_PENDING,
        JobState.READY_TO_MERGE,
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
        AgentCircuitBreaker,
        AgentHealthStore,
        AgentProvider,
        ClaudeCodeProvider,
        CodexProvider,
        GoogleAgentProvider,
        OpenCodeProvider,
        PiProvider,
    )

    configured = config.agents.providers

    claude = configured["claude"]
    codex = configured["codex"]
    google = configured["google"]
    opencode = configured["opencode"]
    pi = configured["pi"]
    providers: dict[str, AgentProvider] = {
        "claude": ClaudeCodeProvider(
            enabled=claude.enabled,
            command=claude.command,
            wrapper_command=claude.wrapper_command,
            model=claude.model,
            phase_models=claude.phase_models,
            credential_paths=claude.credential_paths,
            runtime_paths=claude.runtime_paths,
        ),
        "codex": CodexProvider(
            enabled=codex.enabled,
            command=codex.command,
            wrapper_command=codex.wrapper_command,
            model=codex.model,
            phase_models=codex.phase_models,
            credential_paths=codex.credential_paths,
            runtime_paths=codex.runtime_paths,
        ),
        "google": GoogleAgentProvider(
            enabled=google.enabled,
            command=google.command,
            wrapper_command=google.wrapper_command,
            cli_variant=google.cli_variant,
            model=google.model,
            phase_models=google.phase_models,
            credential_paths=google.credential_paths,
            runtime_paths=google.runtime_paths,
        ),
        "opencode": OpenCodeProvider(
            enabled=opencode.enabled,
            command=opencode.command,
            wrapper_command=opencode.wrapper_command,
            model=opencode.model,
            phase_models=opencode.phase_models,
            credential_paths=opencode.credential_paths,
            runtime_paths=opencode.runtime_paths,
        ),
        "pi": PiProvider(
            enabled=pi.enabled,
            command=pi.command,
            wrapper_command=pi.wrapper_command,
            model=pi.model,
            phase_models=pi.phase_models,
            credential_paths=pi.credential_paths,
            runtime_paths=pi.runtime_paths,
        ),
    }
    from openhands_factory.provider_capacity import (
        ProviderCapacityStore,
        maximum_agent_lease_seconds,
    )

    breaker_config = config.agents.circuit_breaker
    breaker_defaults = {
        name: AgentCircuitBreaker(
            provider=name,
            failure_threshold=breaker_config.failure_threshold,
            cooldown_seconds=breaker_config.default_cooldown_seconds,
        )
        for name in configured
    }
    breakers = AgentHealthStore(config.state_dir / "agent_health.json").load(breaker_defaults)
    generation = generation_snapshot(config.state_dir).get("identifier")
    active = ProviderCapacityStore(
        config.state_dir,
        factory_generation=generation if isinstance(generation, str) else None,
        max_lease_seconds=maximum_agent_lease_seconds(config),
    ).snapshot()
    checks: list[Check] = [
        Check(
            "agent-routing",
            config.agents.routing_enabled,
            "enabled" if config.agents.routing_enabled else "OpenHands compatibility mode",
            warning=not config.agents.routing_enabled,
        )
    ]
    usable = 0
    for name, provider in providers.items():
        provider_config = configured.get(name)
        if provider_config is None or not provider_config.enabled:
            checks.append(Check(f"agent:{name}", True, "disabled"))
            continue
        breaker = breakers[name]
        health = breaker.get_health() if breaker.state != "closed" else provider.health()
        is_usable = health.status.value in {"healthy", "degraded"}
        usable += int(is_usable)
        model = provider_config.model or "provider default"
        credential_paths = ",".join(provider_config.credential_paths) or "none"
        detail = (
            f"{health.status.value}; transport={provider_config.transport}; model={model}; "
            f"concurrency={active.get(name, 0)}/{provider_config.max_concurrency}; "
            f"circuit={breaker.state}; credential_paths={credential_paths}"
        )
        if health.retry_after is not None:
            detail = f"{detail}; retry_after={health.retry_after.isoformat()}"
        if health.detail:
            detail = f"{detail}; {health.detail}"
        checks.append(
            Check(
                f"agent:{name}",
                True,
                detail,
                warning=not is_usable or health.status.value != "healthy",
            )
        )
    openhands = configured.get("openhands")
    openhands_usable = bool(
        openhands
        and openhands.enabled
        and (
            openai_credentials_available(config)
            or (config.opencode_api_key is not None and config.opencode_model is not None)
        )
    )
    openhands_breaker = breakers["openhands"]
    if openhands_breaker.state != "closed":
        openhands_usable = False
    usable += int(openhands_usable)
    openhands_health = openhands_breaker.get_health()
    openhands_source = (
        "openai-oauth"
        if openai_credentials_available(config)
        else "opencode-go-api"
        if config.opencode_api_key is not None and config.opencode_model is not None
        else "none"
    )
    openhands_detail = (
        "healthy; transport=openhands-sdk; emergency-only="
        f"{str(bool(openhands and openhands.emergency_only)).lower()}; "
        f"credential-source={openhands_source}; circuit=closed"
        if openhands_usable
        else "disabled or authentication unavailable"
    )
    if openhands and openhands.enabled and openhands_breaker.state != "closed":
        openhands_detail = (
            f"{openhands_health.status.value}; transport=openhands-sdk; "
            f"emergency-only={str(openhands.emergency_only).lower()}; "
            f"circuit={openhands_breaker.state}"
        )
        if openhands_health.retry_after is not None:
            openhands_detail = (
                f"{openhands_detail}; retry_after={openhands_health.retry_after.isoformat()}"
            )
    checks.append(
        Check(
            "agent:openhands",
            True,
            openhands_detail,
            warning=not openhands_usable,
        )
    )
    checks.append(
        Check(
            "agent-usable",
            True,
            (
                f"{usable} configured provider(s) currently usable"
                if usable > 0
                else (
                    "0 configured providers currently usable; daemon will retain work "
                    "and retry after provider health recovers"
                )
            ),
            warning=usable == 0,
        )
    )
    return checks


def startup_security_checks(config: FactoryConfig) -> list[Check]:
    """Return fail-closed host boundaries required before scheduling agents."""

    from openhands_factory.agents.process import agent_process_isolation_probe

    isolated, isolation_detail = agent_process_isolation_probe()
    active_legacy = [finding for finding in detect_legacy_runtime() if finding.active]
    legacy_detail = (
        "no active competing executor"
        if not active_legacy
        else "; ".join(f"{item.kind}:{item.identifier}" for item in active_legacy)
    )
    return [
        Check("single-owner-runtime", not active_legacy, legacy_detail),
        Check("agent-process-isolation", isolated, isolation_detail),
        verification_isolation_check(),
        git_credential_helper_check(config),
        persistent_github_credentials_check(config.state_dir / "home"),
    ]


def run_doctor(config: FactoryConfig, *, online: bool = False) -> list[Check]:
    """Return diagnostics only. Doctor never pages operators."""
    checks: list[Check] = []
    architecture = check_factory_architecture(config.factory_architecture)
    checks.append(Check("factory-architecture", architecture.passed, architecture.detail))
    single_owner = check_retired_swarm(config.repository)
    checks.append(Check("single-owner", single_owner.passed, single_owner.detail))
    checks.append(Check("provider-chain", True, "phase-specific subscription routing"))
    checks.extend(agent_provider_checks(config))
    checks.append(
        Check("repository", (config.repository / ".git").exists(), str(config.repository))
    )
    checks.extend(startup_security_checks(config))
    checks.append(Check("podman", config.podman_path.is_file(), str(config.podman_path)))
    openai_ready = openai_credentials_available(config)
    checks.append(
        Check(
            "openai-subscription",
            True,
            (
                f"optional OpenHands SDK OAuth model={config.openai_model}"
                if openai_ready
                else (
                    "optional OpenHands SDK OAuth missing or unavailable; "
                    "Codex CLI auth is separate"
                )
            ),
            warning=not openai_ready,
        )
    )
    checks.append(worker_terminal_check(config))
    for executable in ("bash", "curl", "gh", "git", "node", "npm", "python3", "uv"):
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
    checks.extend(disk_space_checks(config))
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

        checks.append(github_repository_access_check(config))
        checks.append(github_merge_policy_check(config))

        if config.opencode_api_key is not None and config.opencode_model is not None:
            try:
                validate_opencode(config)
                checks.append(Check("opencode-go-api", True, config.opencode_model))
            except (RuntimeError, ValueError) as error:
                checks.append(Check("opencode-go-api", False, str(error)))
    try:
        systemd = subprocess.run(
            (
                "systemd-analyze",
                "verify",
                str(config.repository / "config/systemd/hellotalk-factory.service"),
            ),
            capture_output=True,
            text=True,
            timeout=15,
            check=False,
            env={
                "HOME": os.environ.get("HOME", "/var/empty"),
                "LANG": os.environ.get("LANG", "C.UTF-8"),
                "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
            },
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        checks.append(Check("systemd-unit", False, f"could not run systemd-analyze: {error}"))
    else:
        checks.append(
            Check("systemd-unit", systemd.returncode == 0, systemd.stderr.strip() or "valid")
        )
    return checks


def disk_space_checks(config: FactoryConfig) -> list[Check]:
    """Check root separately from the potentially secondary-backed Factory state."""

    checks: list[Check] = []
    for name, label, path in (
        ("disk-free:root", "root", Path("/")),
        ("disk-free", "factory state", config.state_dir),
    ):
        try:
            free_gib = shutil.disk_usage(path).free / 1024**3
        except OSError as error:
            checks.append(Check(name, False, f"{label}: unavailable ({type(error).__name__})"))
            continue
        checks.append(
            Check(
                name,
                free_gib >= config.minimum_free_disk_gib,
                f"{label}: {free_gib:.1f} GiB available, "
                f"{config.minimum_free_disk_gib:.1f} GiB required",
            )
        )
    return checks
