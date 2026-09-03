from __future__ import annotations

from copy import deepcopy

import pytest
from pydantic import ValidationError

from openhands_factory.config_reconcile import reconcile_agents_config


def _base_config() -> dict[str, object]:
    return {
        "routing_enabled": True,
        "providers": {
            "claude": {
                "enabled": True,
                "command": "claude",
                "auth_mode": "subscription",
                "transport": "cli",
                "model": "sonnet-old",
                "phase_models": {"implementation": "sonnet-old"},
            },
            "google": {
                "enabled": False,
                "command": "agy",
                "auth_mode": "subscription",
                "transport": "cli",
                "model": "gemini-old",
            },
        },
        "routing": {
            "planning": ["claude", "google"],
            "architecture": ["claude", "google"],
            "implementation": ["claude", "google"],
            "security_review": ["claude", "google"],
            "quality_repair": ["claude", "google"],
            "code_review": ["claude", "google"],
            "ci_repair": ["claude", "google"],
            "general_action": ["google", "claude"],
            "skip_busy_providers": True,
            "same_provider_retries": 0,
        },
        "timeouts": {
            "planning": 1200,
            "architecture": 1800,
            "implementation": 3600,
            "security_review": 1800,
            "quality_repair": 1800,
            "code_review": 900,
            "ci_repair": 1800,
            "general_action": 600,
        },
        "circuit_breaker": {
            "failure_threshold": 1,
            "default_cooldown_seconds": 300,
            "rate_limit_cooldown_seconds": 900,
            "quota_cooldown_seconds": 3600,
            "auth_cooldown_seconds": 900,
            "unavailable_cooldown_seconds": 300,
            "transport_cooldown_seconds": 300,
            "timeout_cooldown_seconds": 300,
            "crash_cooldown_seconds": 300,
            "invalid_output_cooldown_seconds": 60,
        },
    }


def test_reconciliation_applies_repository_policy_when_local_value_is_unchanged() -> None:
    base = _base_config()
    local = deepcopy(base)
    desired = deepcopy(base)
    desired["circuit_breaker"]["invalid_output_cooldown_seconds"] = 900  # type: ignore[index]
    desired["providers"]["claude"]["model"] = "sonnet-new"  # type: ignore[index]

    merged = reconcile_agents_config(base, local, desired)

    assert merged["circuit_breaker"]["invalid_output_cooldown_seconds"] == 900  # type: ignore[index]
    assert merged["providers"]["claude"]["model"] == "sonnet-new"  # type: ignore[index]


def test_reconciliation_preserves_host_provider_enablement_override() -> None:
    base = _base_config()
    local = deepcopy(base)
    desired = deepcopy(base)
    local["providers"]["google"]["enabled"] = True  # type: ignore[index]
    desired["providers"]["google"]["model"] = "gemini-new"  # type: ignore[index]
    desired["circuit_breaker"]["invalid_output_cooldown_seconds"] = 900  # type: ignore[index]

    merged = reconcile_agents_config(base, local, desired)

    assert merged["providers"]["google"]["enabled"] is True  # type: ignore[index]
    assert merged["providers"]["google"]["model"] == "gemini-new"  # type: ignore[index]
    assert merged["circuit_breaker"]["invalid_output_cooldown_seconds"] == 900  # type: ignore[index]


def test_reconciliation_preserves_operator_route_override_as_atomic_list() -> None:
    base = _base_config()
    local = deepcopy(base)
    desired = deepcopy(base)
    local["routing"]["implementation"] = ["google", "claude"]  # type: ignore[index]
    desired["routing"]["implementation"] = ["claude"]  # type: ignore[index]
    desired["routing"]["same_provider_retries"] = 1  # type: ignore[index]

    merged = reconcile_agents_config(base, local, desired)

    assert merged["routing"]["implementation"] == ["google", "claude"]  # type: ignore[index]
    assert merged["routing"]["same_provider_retries"] == 1  # type: ignore[index]


def test_reconciliation_preserves_local_additions_and_deletions() -> None:
    base = _base_config()
    local = deepcopy(base)
    desired = deepcopy(base)
    local["providers"]["custom"] = {  # type: ignore[index]
        "enabled": False,
        "auth_mode": "subscription",
        "transport": "cli",
        "model": "custom-model",
    }
    del local["providers"]["google"]  # type: ignore[index]
    desired["providers"]["google"]["model"] = "gemini-new"  # type: ignore[index]

    merged = reconcile_agents_config(base, local, desired)

    assert "custom" in merged["providers"]  # type: ignore[operator]
    assert "google" not in merged["providers"]  # type: ignore[operator]


def test_reconciliation_rejects_invalid_operator_override() -> None:
    base = _base_config()
    local = deepcopy(base)
    desired = deepcopy(base)
    local["routing"]["same_provider_retries"] = 99  # type: ignore[index]
    desired["circuit_breaker"]["invalid_output_cooldown_seconds"] = 900  # type: ignore[index]

    with pytest.raises(ValidationError):
        reconcile_agents_config(base, local, desired)
