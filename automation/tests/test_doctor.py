import json
from datetime import UTC, datetime, timedelta
from pathlib import Path
from subprocess import CompletedProcess
from types import SimpleNamespace

import pytest

from openhands_factory.agents.base import AgentFailureKind, ProviderHealth, ProviderStatus
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore
from openhands_factory.cli import _provider_startup_checks
from openhands_factory.config import AgentsConfig, FactoryConfig
from openhands_factory.doctor import (
    Check,
    agent_provider_checks,
    daemon_health_check,
    disk_space_checks,
    git_credential_helper_check,
    github_merge_policy_check,
    github_repository_access_check,
    job_health_checks,
    leaked_port_environment_check,
    persistent_github_credentials_check,
    run_doctor,
    startup_security_checks,
    verification_isolation_check,
    worker_terminal_check,
)
from openhands_factory.jobs import JobStore
from openhands_factory.models import Job, JobState, Task
from openhands_factory.oauth_health import OAuthHealth, OAuthHealthKind
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.state import atomic_write_json


def config(tmp_path: Path) -> FactoryConfig:
    repository = tmp_path / "repository"
    repository.mkdir()
    return FactoryConfig.from_environment(
        {
            "FACTORY_REPOSITORY": str(repository),
            "FACTORY_STATE_DIR": str(tmp_path / "state"),
            "FACTORY_LOG_DIR": str(tmp_path / "log"),
            "FACTORY_PROFILE_STORE": str(tmp_path / "profiles"),
            "FACTORY_WORKTREE_DIR": str(tmp_path / "worktrees"),
            "FACTORY_RECOVERY_DIR": str(tmp_path / "recovery"),
            "OPENCODE_GO_API_KEY": "key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "token",
            "GEMINI_ENABLED": "false",
        }
    )


def test_worker_terminal_probe_uses_small_nested_resource_limits(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[list[str]] = []

    def run(arguments: list[str], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        return CompletedProcess(arguments, 0, "factory-terminal-ready\n", "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)
    check = worker_terminal_check(config(tmp_path))
    assert check.passed
    assert "--pids-limit=32" in calls[0]
    assert "--memory=256m" in calls[0]
    assert "--cpus=0.25" in calls[0]
    assert "--network=none" in calls[0]


def test_startup_security_rejects_an_active_competing_executor(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    from openhands_factory.legacy_runtime import LegacyFinding

    monkeypatch.setattr(
        "openhands_factory.doctor.detect_legacy_runtime",
        lambda: [
            LegacyFinding(
                "systemd",
                "hellotalk-meta-agent.service",
                True,
                "active",
            )
        ],
    )
    monkeypatch.setattr(
        "openhands_factory.agents.process.agent_process_isolation_probe",
        lambda: (True, "ready"),
    )
    monkeypatch.setattr(
        "openhands_factory.doctor.verification_isolation_check",
        lambda: Check("verification-isolation", True, "ready"),
    )
    monkeypatch.setattr(
        "openhands_factory.doctor.git_credential_helper_check",
        lambda factory_config: Check("git-credential-helper", True, "ready"),
    )
    monkeypatch.setattr(
        "openhands_factory.doctor.persistent_github_credentials_check",
        lambda home: Check("persistent-github-credentials", True, "ready"),
    )

    checks = {check.name: check for check in startup_security_checks(config(tmp_path))}

    assert not checks["single-owner-runtime"].passed
    assert "hellotalk-meta-agent.service" in checks["single-owner-runtime"].detail


def test_worker_terminal_probe_falls_back_when_nested_cgroup_is_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[list[str]] = []

    def run(arguments: list[str], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        if len(calls) == 1:
            return CompletedProcess(
                arguments,
                125,
                "cannot set cgroup: permission denied",
                "",
            )
        return CompletedProcess(arguments, 0, "factory-terminal-ready\n", "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)
    check = worker_terminal_check(config(tmp_path))
    assert check.passed
    assert "without nested cgroup limits" in check.detail
    assert len(calls) == 2
    assert "--pids-limit=32" in calls[0]
    assert "--pids-limit=32" not in calls[1]


def test_worker_terminal_probe_falls_back_when_user_namespace_is_blocked(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[list[str]] = []

    def run(arguments: list[str], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        if len(calls) == 1:
            return CompletedProcess(
                arguments,
                125,
                "newuidmap: Operation not permitted",
                "",
            )
        return CompletedProcess(arguments, 0, "factory-terminal-ready\n", "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)
    check = worker_terminal_check(config(tmp_path))
    assert check.passed
    assert "host user namespace fallback" in check.detail
    assert len(calls) == 2
    assert all("--pid=host" not in call for call in calls)


def test_doctor_reports_openai_subscription_credentials(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory_config = config(tmp_path)
    monkeypatch.setattr(
        "openhands_factory.doctor.openai_credentials_available",
        lambda _config: True,
    )
    monkeypatch.setattr(
        "openhands_factory.doctor.subprocess.run",
        lambda *args, **kwargs: CompletedProcess(args, 0, "", ""),
    )
    checks = {check.name: check for check in run_doctor(factory_config)}
    assert checks["openai-subscription"].passed
    assert checks["openai-subscription"].detail == (
        "optional OpenHands SDK OAuth model=gpt-5.6-sol"
    )


def test_doctor_checks_root_and_factory_state_volumes_separately(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    factory_config = config(tmp_path)
    factory_config.state_dir.mkdir()
    gibibyte = 1024**3

    def disk_usage(path: Path) -> SimpleNamespace:
        free = 2 * gibibyte if path == Path("/") else 20 * gibibyte
        return SimpleNamespace(free=free)

    monkeypatch.setattr("openhands_factory.doctor.shutil.disk_usage", disk_usage)

    checks = {check.name: check for check in disk_space_checks(factory_config)}

    assert not checks["disk-free:root"].passed
    assert "root: 2.0 GiB available" in checks["disk-free:root"].detail
    assert checks["disk-free"].passed
    assert "factory state: 20.0 GiB available" in checks["disk-free"].detail


def test_doctor_reports_missing_systemd_analyse_without_crashing(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    def unavailable(*args: object, **kwargs: object) -> CompletedProcess[str]:
        del args, kwargs
        raise FileNotFoundError("systemd-analyze")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", unavailable)

    checks = {check.name: check for check in run_doctor(config(tmp_path))}

    assert not checks["systemd-unit"].passed
    assert "could not run systemd-analyze" in checks["systemd-unit"].detail


def test_git_credential_helper_check_requires_gh_helper(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[tuple[str, ...]] = []

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        return CompletedProcess(arguments, 0, "\n!gh auth git-credential\n", "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = git_credential_helper_check(config(tmp_path))

    assert check.passed
    assert calls[0][-2:] == ("--get-all", "credential.helper")


def test_git_credential_helper_rejects_unreset_persistent_helpers(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "openhands_factory.doctor.subprocess.run",
        lambda arguments, **kwargs: CompletedProcess(
            arguments,
            0,
            "store\n!gh auth git-credential\n",
            "",
        ),
    )

    check = git_credential_helper_check(config(tmp_path))

    assert not check.passed


def test_persistent_github_credentials_are_rejected_without_echoing_them(
    tmp_path: Path,
) -> None:
    gh_config = tmp_path / ".config" / "gh"
    gh_config.mkdir(parents=True)
    token = "synthetic-oauth-value"
    (gh_config / "hosts.yml").write_text(
        f"github.com:\n  user: factory\n  oauth_token: {token}\n",
        encoding="utf-8",
    )

    check = persistent_github_credentials_check(tmp_path)

    assert not check.passed
    assert token not in check.detail


def test_absent_persistent_github_credentials_pass(tmp_path: Path) -> None:
    check = persistent_github_credentials_check(tmp_path)

    assert check.passed


def test_verification_isolation_probe_requires_private_namespaces(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[tuple[str, ...]] = []

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        captured.append(arguments)
        return CompletedProcess(arguments, 0, "", "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = verification_isolation_check()

    assert check.passed
    assert "--mount-proc" in captured[0]
    assert "--net" in captured[0]


def test_online_github_probe_scopes_token_without_reporting_it(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    environments: list[dict[str, str]] = []

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        environment = kwargs.get("env")
        assert isinstance(environment, dict)
        environments.append(environment)
        return CompletedProcess(arguments, 0, "main\n", "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = github_repository_access_check(config(tmp_path))

    assert check.passed
    assert check.detail == "authenticated; default branch=main"
    assert environments == [
        {
            "GH_TOKEN": "token",
            "HOME": str(Path.home()),
            "PATH": environments[0]["PATH"],
            "LANG": environments[0]["LANG"],
        }
    ]
    assert "token" not in check.detail


def test_online_merge_policy_requires_pull_requests_and_factory_statuses(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    rules = [
        {"type": "pull_request", "parameters": {}, "ruleset_id": 42},
        {
            "type": "required_status_checks",
            "ruleset_id": 42,
            "parameters": {
                "required_status_checks": [
                    {"context": "CI / required"},
                    {"context": "factory/independent-review"},
                ]
            },
        },
    ]
    environments: list[dict[str, str]] = []

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        environment = kwargs.get("env")
        assert isinstance(environment, dict)
        environments.append(environment)
        payload: object = rules
        if arguments[-1].endswith("/rulesets/42"):
            payload = {"enforcement": "active", "bypass_actors": []}
        return CompletedProcess(arguments, 0, json.dumps(payload), "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = github_merge_policy_check(config(tmp_path))

    assert check.passed
    assert "required-statuses=CI / required,factory/independent-review" in check.detail
    assert "baseline-ruleset=42" in check.detail
    assert "review-ruleset=42" in check.detail
    assert "manual-review-bypass=disabled" in check.detail
    assert all(environment["GH_TOKEN"] == "token" for environment in environments)
    assert "token" not in check.detail


def test_online_merge_policy_allows_exact_owner_to_bypass_review_only(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    rules = [
        {"type": "pull_request", "parameters": {}, "ruleset_id": 42},
        {
            "type": "required_status_checks",
            "ruleset_id": 42,
            "parameters": {"required_status_checks": [{"context": "CI / required"}]},
        },
        {
            "type": "required_status_checks",
            "ruleset_id": 43,
            "parameters": {"required_status_checks": [{"context": "factory/independent-review"}]},
        },
    ]

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        del kwargs
        payload: object = rules
        if arguments[-1].endswith("/rulesets/42"):
            payload = {"enforcement": "active", "bypass_actors": []}
        elif arguments[-1].endswith("/rulesets/43"):
            payload = {
                "enforcement": "active",
                "bypass_actors": [
                    {
                        "actor_id": 6_216_372,
                        "actor_type": "User",
                        "bypass_mode": "pull_request",
                    }
                ],
            }
        elif arguments[-1] == "users/elgansayer":
            payload = {"id": 6_216_372, "login": "elgansayer", "type": "User"}
        return CompletedProcess(arguments, 0, json.dumps(payload), "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = github_merge_policy_check(config(tmp_path))

    assert check.passed
    assert "baseline-ruleset=42" in check.detail
    assert "review-ruleset=43" in check.detail
    assert "manual-ci-bypass=disabled" in check.detail
    assert "manual-review-bypass=elgansayer; ruleset=43" in check.detail


def test_online_merge_policy_allows_exact_owner_to_bypass_all_checks(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    rules = [
        {"type": "pull_request", "parameters": {}, "ruleset_id": 42},
        {
            "type": "required_status_checks",
            "ruleset_id": 42,
            "parameters": {"required_status_checks": [{"context": "CI / required"}]},
        },
        {
            "type": "required_status_checks",
            "ruleset_id": 43,
            "parameters": {"required_status_checks": [{"context": "factory/independent-review"}]},
        },
    ]
    owner_bypass = [
        {
            "actor_id": 6_216_372,
            "actor_type": "User",
            "bypass_mode": "pull_request",
        }
    ]

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        del kwargs
        payload: object = rules
        if arguments[-1].endswith(("/rulesets/42", "/rulesets/43")):
            payload = {"enforcement": "active", "bypass_actors": owner_bypass}
        elif arguments[-1] == "users/elgansayer":
            payload = {"id": 6_216_372, "login": "elgansayer", "type": "User"}
        return CompletedProcess(arguments, 0, json.dumps(payload), "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = github_merge_policy_check(config(tmp_path))

    assert check.passed
    assert "baseline-ruleset=42" in check.detail
    assert "review-ruleset=43" in check.detail
    assert "manual-ci-bypass=elgansayer; ruleset=42" in check.detail
    assert "manual-review-bypass=elgansayer; ruleset=43" in check.detail


@pytest.mark.parametrize(
    ("rules", "missing_detail"),
    [
        ([], "pull-request-rule=missing"),
        ([{"type": "pull_request", "parameters": {}}], "missing-statuses="),
        (
            [
                {"type": "pull_request", "parameters": {}},
                {
                    "type": "required_status_checks",
                    "parameters": {"required_status_checks": [{"context": "CI / required"}]},
                },
            ],
            "missing-statuses=factory/independent-review",
        ),
    ],
)
def test_online_merge_policy_fails_closed_when_rules_are_incomplete(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    rules: list[dict[str, object]],
    missing_detail: str,
) -> None:
    monkeypatch.setattr(
        "openhands_factory.doctor.subprocess.run",
        lambda arguments, **kwargs: CompletedProcess(
            arguments,
            0,
            json.dumps(rules),
            "",
        ),
    )

    check = github_merge_policy_check(config(tmp_path))

    assert not check.passed
    assert missing_detail in check.detail


def test_online_merge_policy_rejects_complete_ruleset_with_bypass_actors(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    rules = [
        {"type": "pull_request", "parameters": {}, "ruleset_id": 42},
        {
            "type": "required_status_checks",
            "ruleset_id": 42,
            "parameters": {
                "required_status_checks": [
                    {"context": "CI / required"},
                    {"context": "factory/independent-review"},
                ]
            },
        },
    ]

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        del kwargs
        payload: object = rules
        if arguments[-1].endswith("/rulesets/42"):
            payload = {
                "enforcement": "active",
                "bypass_actors": [{"actor_type": "RepositoryRole"}],
            }
        return CompletedProcess(arguments, 0, json.dumps(payload), "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = github_merge_policy_check(config(tmp_path))

    assert not check.passed
    assert "no active ruleset requiring pull requests and CI" in check.detail


@pytest.mark.parametrize(
    "bypass_actors",
    [
        [
            {
                "actor_id": 123,
                "actor_type": "User",
                "bypass_mode": "pull_request",
            }
        ],
        [
            {
                "actor_id": 6_216_372,
                "actor_type": "User",
                "bypass_mode": "always",
            }
        ],
        [
            {
                "actor_id": 6_216_372,
                "actor_type": "RepositoryRole",
                "bypass_mode": "pull_request",
            }
        ],
    ],
)
def test_online_merge_policy_rejects_broad_or_wrong_manual_review_bypass(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
    bypass_actors: list[dict[str, object]],
) -> None:
    rules = [
        {"type": "pull_request", "parameters": {}, "ruleset_id": 42},
        {
            "type": "required_status_checks",
            "ruleset_id": 42,
            "parameters": {"required_status_checks": [{"context": "CI / required"}]},
        },
        {
            "type": "required_status_checks",
            "ruleset_id": 43,
            "parameters": {"required_status_checks": [{"context": "factory/independent-review"}]},
        },
    ]

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        del kwargs
        payload: object = rules
        if arguments[-1].endswith("/rulesets/42"):
            payload = {"enforcement": "active", "bypass_actors": []}
        elif arguments[-1].endswith("/rulesets/43"):
            payload = {"enforcement": "active", "bypass_actors": bypass_actors}
        elif arguments[-1] == "users/elgansayer":
            payload = {"id": 6_216_372, "login": "elgansayer", "type": "User"}
        return CompletedProcess(arguments, 0, json.dumps(payload), "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = github_merge_policy_check(config(tmp_path))

    assert not check.passed
    assert "baseline-ruleset=42" in check.detail
    assert "no active independent-review ruleset with an allowed bypass policy" in check.detail


def test_online_merge_policy_rejects_owner_bypass_on_non_review_rule(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    rules = [
        {"type": "pull_request", "parameters": {}, "ruleset_id": 42},
        {
            "type": "required_status_checks",
            "ruleset_id": 42,
            "parameters": {"required_status_checks": [{"context": "CI / required"}]},
        },
        {"type": "non_fast_forward", "parameters": {}, "ruleset_id": 43},
        {
            "type": "required_status_checks",
            "ruleset_id": 43,
            "parameters": {"required_status_checks": [{"context": "factory/independent-review"}]},
        },
    ]

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        del kwargs
        payload: object = rules
        if arguments[-1].endswith("/rulesets/42"):
            payload = {"enforcement": "active", "bypass_actors": []}
        elif arguments[-1].endswith("/rulesets/43"):
            payload = {
                "enforcement": "active",
                "bypass_actors": [
                    {
                        "actor_id": 6_216_372,
                        "actor_type": "User",
                        "bypass_mode": "pull_request",
                    }
                ],
            }
        elif arguments[-1] == "users/elgansayer":
            payload = {"id": 6_216_372, "login": "elgansayer", "type": "User"}
        return CompletedProcess(arguments, 0, json.dumps(payload), "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = github_merge_policy_check(config(tmp_path))

    assert not check.passed
    assert "no active independent-review ruleset with an allowed bypass policy" in check.detail


def test_provider_startup_uses_aggregate_health_and_merge_safety(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "openhands_factory.cli.agent_provider_checks",
        lambda factory_config: [
            Check("agent:claude", True, "auth required", warning=True),
            Check("agent:codex", True, "healthy"),
            Check("agent-usable", True, "1 configured provider currently usable"),
        ],
    )
    monkeypatch.setattr("openhands_factory.cli._legacy_checks", lambda: [])
    monkeypatch.setattr(
        "openhands_factory.cli.github_repository_access_check",
        lambda factory_config: Check("github-repository-access", True, "ready"),
    )
    monkeypatch.setattr(
        "openhands_factory.cli.github_merge_policy_check",
        lambda factory_config: Check("github-merge-policy", True, "ready"),
    )
    monkeypatch.setattr(
        "openhands_factory.cli.smoke_openai_subscription",
        lambda factory_config: OAuthHealth(
            OAuthHealthKind.AUTH_FAILURE,
            False,
            "optional OAuth unavailable",
        ),
    )

    checks = {check.name: check for check in _provider_startup_checks(config(tmp_path))}

    assert checks["agent-usable"].passed
    assert checks["github-merge-policy"].passed
    assert checks["openai-subscription-online"].passed
    assert checks["openai-subscription-online"].warning


def test_provider_startup_keeps_daemon_available_when_all_providers_need_recovery(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "openhands_factory.cli.agent_provider_checks",
        lambda factory_config: [
            Check("agent:claude", True, "quota exhausted", warning=True),
            Check("agent:codex", True, "rate limited", warning=True),
            Check(
                "agent-usable",
                True,
                "0 configured providers currently usable",
                warning=True,
            ),
        ],
    )
    monkeypatch.setattr("openhands_factory.cli._legacy_checks", lambda: [])
    monkeypatch.setattr(
        "openhands_factory.cli.github_repository_access_check",
        lambda factory_config: Check("github-repository-access", True, "ready"),
    )
    monkeypatch.setattr(
        "openhands_factory.cli.github_merge_policy_check",
        lambda factory_config: Check("github-merge-policy", True, "ready"),
    )
    monkeypatch.setattr(
        "openhands_factory.cli.smoke_openai_subscription",
        lambda factory_config: OAuthHealth(
            OAuthHealthKind.AUTH_FAILURE,
            False,
            "optional OAuth unavailable",
        ),
    )

    checks = {check.name: check for check in _provider_startup_checks(config(tmp_path))}

    assert all(check.passed for check in checks.values())
    assert checks["agent-usable"].warning


def test_agent_diagnostics_warn_when_no_provider_is_temporarily_usable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory_config = config(tmp_path).model_copy(
        update={
            "agents": AgentsConfig(),
            "opencode_api_key": None,
            "opencode_model": None,
        }
    )
    unavailable = lambda provider: ProviderHealth(  # noqa: E731
        provider,
        ProviderStatus.UNAVAILABLE,
        datetime.now(UTC),
        detail="temporary provider outage",
    )
    monkeypatch.setattr(
        "openhands_factory.agents.ClaudeCodeProvider.health",
        lambda provider: unavailable(provider.name),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.CodexProvider.health",
        lambda provider: unavailable(provider.name),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.GoogleAgentProvider.health",
        lambda provider: unavailable(provider.name),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.OpenCodeProvider.health",
        lambda provider: unavailable(provider.name),
    )
    monkeypatch.setattr(
        "openhands_factory.doctor.openai_credentials_available",
        lambda _config: False,
    )

    checks = {check.name: check for check in agent_provider_checks(factory_config)}

    assert checks["agent-usable"].passed
    assert checks["agent-usable"].warning
    assert "daemon will retain work" in checks["agent-usable"].detail


def test_agent_diagnostics_ignore_capacity_from_a_previous_daemon_generation(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory_config = config(tmp_path).model_copy(update={"agents": AgentsConfig()})
    atomic_write_json(
        factory_config.state_dir / "generation.json",
        {"identifier": "current"},
    )
    previous = ProviderCapacityStore(
        factory_config.state_dir,
        factory_generation="previous",
    )
    current = ProviderCapacityStore(
        factory_config.state_dir,
        factory_generation="current",
    )
    previous.acquire("claude", limit=2, owner="old", wait_seconds=0, lease_seconds=60)
    current.acquire("claude", limit=2, owner="new", wait_seconds=0, lease_seconds=60)
    healthy = lambda provider: ProviderHealth(  # noqa: E731
        provider,
        ProviderStatus.HEALTHY,
        datetime.now(UTC),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.ClaudeCodeProvider.health",
        lambda provider: healthy(provider.name),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.CodexProvider.health",
        lambda provider: healthy(provider.name),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.GoogleAgentProvider.health",
        lambda provider: healthy(provider.name),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.OpenCodeProvider.health",
        lambda provider: healthy(provider.name),
    )
    monkeypatch.setattr(
        "openhands_factory.doctor.openai_credentials_available",
        lambda _config: False,
    )

    checks = {check.name: check for check in agent_provider_checks(factory_config)}

    assert "concurrency=1/2" in checks["agent:claude"].detail


def test_agent_diagnostics_report_persisted_circuit_and_retry_time(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    factory_config = config(tmp_path).model_copy(update={"agents": AgentsConfig()})
    breaker = AgentCircuitBreaker("claude", 1, 300)
    breaker.record_failure(
        AgentFailureKind.PROVIDER_QUOTA,
        retry_after_seconds=900,
    )
    AgentHealthStore(factory_config.state_dir / "agent_health.json").save({"claude": breaker})
    monkeypatch.setattr(
        "openhands_factory.agents.ClaudeCodeProvider.health",
        lambda provider: ProviderHealth(
            provider.name,
            ProviderStatus.HEALTHY,
            datetime.now(UTC),
        ),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.CodexProvider.health",
        lambda provider: ProviderHealth(
            provider.name,
            ProviderStatus.HEALTHY,
            datetime.now(UTC),
        ),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.GoogleAgentProvider.health",
        lambda provider: ProviderHealth(
            provider.name,
            ProviderStatus.HEALTHY,
            datetime.now(UTC),
        ),
    )
    monkeypatch.setattr(
        "openhands_factory.agents.OpenCodeProvider.health",
        lambda provider: ProviderHealth(
            provider.name,
            ProviderStatus.HEALTHY,
            datetime.now(UTC),
        ),
    )
    monkeypatch.setattr(
        "openhands_factory.doctor.openai_credentials_available",
        lambda _config: False,
    )

    checks = {check.name: check for check in agent_provider_checks(factory_config)}

    assert checks["agent:claude"].warning
    assert "quota_exhausted" in checks["agent:claude"].detail
    assert "circuit=open" in checks["agent:claude"].detail
    assert "retry_after=" in checks["agent:claude"].detail


def test_leaked_port_env_fails_the_check(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PORT", "3000")
    check = leaked_port_environment_check()
    assert not check.passed
    assert "PORT=3000" in check.detail


def test_no_port_env_passes_the_check(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("PORT", raising=False)
    check = leaked_port_environment_check()
    assert check.passed


def test_health_normalizes_quarantined_state_and_reports_only_stalled_jobs(
    tmp_path: Path,
) -> None:
    factory_config = config(tmp_path)
    now = datetime.now(UTC)
    quarantined = Job(Task("3152", "Task", "", "github", 0), JobState.QUARANTINED)
    stalled = Job(Task("239", "Task", "", "github", 0), JobState.IMPLEMENTING)
    stalled.updated_at = now - timedelta(minutes=factory_config.max_task_minutes + 16)
    JobStore(factory_config.state_dir / "jobs.json").save({"3152": quarantined, "239": stalled})
    checks = {check.name: check for check in job_health_checks(factory_config, now)}
    assert set(checks) == {"jobs-stalled"}
    assert checks["jobs-stalled"].passed
    assert checks["jobs-stalled"].detail == "retry/recovery pending: issues=239"


@pytest.mark.parametrize(
    "state",
    [JobState.SECURITY_REVIEW, JobState.QUALITY_REPAIRING, JobState.READY_TO_MERGE],
)
def test_health_includes_every_active_review_and_repair_state(
    tmp_path: Path,
    state: JobState,
) -> None:
    factory_config = config(tmp_path)
    now = datetime.now(UTC)
    stalled = Job(Task("240", "Task", "", "github", 0), state)
    stalled.updated_at = now - timedelta(minutes=factory_config.max_task_minutes + 16)
    JobStore(factory_config.state_dir / "jobs.json").save({"240": stalled})

    check = job_health_checks(factory_config, now)[0]

    assert check.warning
    assert "issues=240" in check.detail


def test_health_reports_stale_daemon_heartbeat(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime.now(UTC)
    atomic_write_json(
        factory_config.state_dir / "daemon.json",
        {
            "status": "running",
            "updated_at": (now - timedelta(minutes=5)).isoformat(),
            "active_jobs": ["242"],
        },
    )
    check = daemon_health_check(factory_config, now)
    assert not check.passed
    assert "active_jobs=1" in check.detail


def test_health_fails_closed_for_malformed_state_payloads(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    atomic_write_json(factory_config.state_dir / "daemon.json", ["not", "a", "mapping"])
    atomic_write_json(factory_config.state_dir / "jobs.json", ["not", "a", "mapping"])
    heartbeat = daemon_health_check(factory_config)
    jobs = job_health_checks(factory_config)
    assert not heartbeat.passed
    assert heartbeat.detail == "invalid heartbeat payload"
    assert all(not check.passed for check in jobs)


def test_health_fails_closed_when_durable_job_state_is_missing(tmp_path: Path) -> None:
    checks = job_health_checks(config(tmp_path))
    assert all(not check.passed for check in checks)
    assert {check.detail for check in checks} == {"durable job state is missing"}


def test_health_rejects_a_materially_future_dated_heartbeat(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime.now(UTC)
    atomic_write_json(
        factory_config.state_dir / "daemon.json",
        {
            "status": "running",
            "updated_at": (now + timedelta(minutes=5)).isoformat(),
            "active_jobs": [],
        },
    )
    check = daemon_health_check(factory_config, now)
    assert not check.passed
    assert "future timestamp" in check.detail


def test_health_reports_no_pull_request_progress_with_active_jobs(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime.now(UTC)
    atomic_write_json(
        factory_config.state_dir / "daemon.json",
        {
            "status": "running",
            "updated_at": now.isoformat(),
            "active_jobs": ["1"],
        },
    )
    JobStore(factory_config.state_dir / "jobs.json").save(
        {"1": Job(Task("1", "Task", "", "github", 0), JobState.IMPLEMENTING)}
    )
    from openhands_factory.doctor import no_pr_progress_check

    check = no_pr_progress_check(factory_config, now)
    assert check.passed
    assert check.detail == "no pull request yet; active_jobs=1"
