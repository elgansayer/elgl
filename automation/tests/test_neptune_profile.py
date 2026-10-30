"""Configuration/doctor contracts, not live provider or deployment evidence."""

import json
from pathlib import Path
from subprocess import CompletedProcess, TimeoutExpired

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.doctor import github_merge_policy_check
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.neptune_merge import NEPTUNE_GATE


def test_explicit_neptune_profile_uses_existing_subscription_broker(
    neptune_config: FactoryConfig,
) -> None:
    assert neptune_config.tests_only_merging
    assert neptune_config.max_parallel_jobs == 1
    assert neptune_config.monthly_variable_budget_usd == 0
    assert neptune_config.agents.providers["codex"].enabled
    assert not neptune_config.agents.providers["openhands"].enabled
    assert neptune_config.provider_capacity_dir != neptune_config.state_dir


@pytest.mark.parametrize(
    "field,value",
    [
        ("FACTORY_NEPTUNE_ENABLED", "false"),
        ("FACTORY_REPOSITORY_PROFILE", "hellotalk"),
        ("GITHUB_REPOSITORY", "other/repository"),
        ("FACTORY_BASE_BRANCH", "stack-parent"),
        ("FACTORY_REQUIRE_TRUSTED_INTAKE", "false"),
        ("FACTORY_REQUIRE_READY_LABEL", "false"),
        ("FACTORY_MAX_PARALLEL_JOBS", "2"),
        ("FACTORY_MAINTENANCE_ENABLED", "true"),
        ("FACTORY_MONTHLY_VARIABLE_BUDGET_USD", "1"),
        ("FACTORY_REPOSITORY", "/var/lib/hellotalk-factory/repository"),
        ("FACTORY_STATE_DIR", "/var/lib/hellotalk-factory"),
        ("FACTORY_LOG_DIR", "/var/log/hellotalk-factory"),
        ("FACTORY_PROMPT_DIR", "/control/automation/prompts"),
        ("FACTORY_PROVIDER_CAPACITY_DIR", "relative-shared"),
    ],
)
def test_neptune_activation_rejects_unsafe_defaults(
    neptune_environment: dict[str, str],
    field: str,
    value: str,
) -> None:
    neptune_environment[field] = value
    with pytest.raises(ConfigurationError):
        FactoryConfig.from_environment(neptune_environment)


def test_neptune_cannot_create_a_separate_provider_allowance(
    neptune_environment: dict[str, str],
) -> None:
    neptune_environment["FACTORY_PROVIDER_CAPACITY_DIR"] = neptune_environment["FACTORY_STATE_DIR"]
    with pytest.raises(ConfigurationError, match="shared provider broker"):
        FactoryConfig.from_environment(neptune_environment)


def test_neptune_cannot_enable_api_fallback(neptune_environment: dict[str, str]) -> None:
    agents = Path(neptune_environment["FACTORY_AGENTS_CONFIG"])
    payload = json.loads(agents.read_text())
    payload["providers"]["openhands"] = {
        "enabled": True,
        "transport": "openhands-sdk",
        "auth_mode": "api",
    }
    agents.write_text(json.dumps(payload))
    with pytest.raises(ConfigurationError, match="subscription CLIs only"):
        FactoryConfig.from_environment(neptune_environment)


def test_neptune_private_state_cannot_be_mounted_as_canonical_source(
    neptune_environment: dict[str, str],
) -> None:
    neptune_environment["FACTORY_STATE_DIR"] = neptune_environment["FACTORY_REPOSITORY"]
    with pytest.raises(ConfigurationError, match="must not overlap"):
        FactoryConfig.from_environment(neptune_environment)


def test_neptune_control_prompts_cannot_come_from_game_source(
    neptune_environment: dict[str, str],
) -> None:
    prompts = Path(neptune_environment["FACTORY_REPOSITORY"]) / "automation/neptune-prompts"
    neptune_environment["FACTORY_PROMPT_DIR"] = str(prompts)
    neptune_environment["FACTORY_SYSTEM_PROMPT_PATH"] = str(prompts / "system.md")
    with pytest.raises(ConfigurationError, match="outside game workspaces"):
        FactoryConfig.from_environment(neptune_environment)


def protection() -> dict[str, object]:
    return {
        "required_status_checks": {
            "strict": True,
            "contexts": [NEPTUNE_GATE],
            "checks": [{"context": NEPTUNE_GATE, "app_id": 15368}],
        },
        "enforce_admins": {"enabled": True},
        "required_pull_request_reviews": None,
        "allow_force_pushes": {"enabled": False},
        "allow_deletions": {"enabled": False},
    }


def test_doctor_validates_neptune_protection_without_requiring_review_status(
    neptune_config: FactoryConfig,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    calls: list[tuple[str, ...]] = []
    values = [
        {"allow_auto_merge": True, "allow_merge_commit": True, "delete_branch_on_merge": False},
        protection(),
    ]

    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        return CompletedProcess(arguments, 0, json.dumps(values.pop(0)), "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)
    result = github_merge_policy_check(neptune_config)
    assert result.passed
    assert len(calls) == 2
    assert calls[1][-1].endswith("/branches/main/protection")
    assert "independent-review" not in repr(calls)
    assert "unit-test-token" not in repr(calls)


@pytest.mark.parametrize("failure", ["bad-json", "api-denied", "timeout", "drift"])
def test_doctor_fails_closed_without_echoing_response_bodies(
    neptune_config: FactoryConfig,
    monkeypatch: pytest.MonkeyPatch,
    failure: str,
) -> None:
    def run(arguments: tuple[str, ...], **kwargs: object) -> CompletedProcess[str]:
        if failure == "timeout":
            raise TimeoutExpired(arguments, 30)
        if failure == "api-denied":
            return CompletedProcess(arguments, 403, "private response", "private response")
        if failure == "drift":
            return CompletedProcess(arguments, 0, "{}", "")
        return CompletedProcess(arguments, 0, "private response", "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)
    result = github_merge_policy_check(neptune_config)
    assert not result.passed
    assert "private response" not in result.detail
