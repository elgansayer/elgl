from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError


def test_worker_image_reuses_the_node_base_image_user() -> None:
    containerfile = (Path(__file__).parents[1] / "Containerfile").read_text(encoding="utf-8")

    assert "usermod --login worker" in containerfile
    assert "useradd --create-home --uid 1000 worker" not in containerfile


def test_bootstrap_installs_a_self_contained_factory_package() -> None:
    setup = (Path(__file__).parents[2] / "setup-debian.sh").read_text(encoding="utf-8")

    assert "--no-editable" in setup
    assert "-- cypress install" in setup
    assert "merge --ff-only origin/main" in setup
    assert "hellotalk-factory@users.noreply.github.com" in setup
    assert "hellotalk-factory-watchdog.sh" in setup


def test_legacy_github_agent_workflows_stay_retired() -> None:
    workflows = Path(__file__).parents[2] / ".github" / "workflows"

    for name in ("architect.yml", "auto-dispatcher.yml", "openhands.yml", "pr-reviewer.yml"):
        assert not (workflows / name).exists()


def test_service_allows_rootless_podman_user_namespace_helpers() -> None:
    unit = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory.service"
    ).read_text(encoding="utf-8")

    assert "NoNewPrivileges=true" not in unit
    assert "RestrictSUIDSGID=true" not in unit


def test_service_delegates_only_its_cgroup_beneath_the_parent_resource_cap() -> None:
    unit = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory.service"
    ).read_text(encoding="utf-8")

    assert "Delegate=yes" in unit
    assert "ProtectControlGroups=false" in unit
    assert "MemoryMax=7G" in unit
    assert "TasksMax=1024" in unit


def test_health_service_is_a_root_daemon_recovery_watchdog() -> None:
    unit = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory-health.service"
    ).read_text(encoding="utf-8")
    timer = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory-health.timer"
    ).read_text(encoding="utf-8")
    watchdog = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory-watchdog.sh"
    ).read_text(encoding="utf-8")

    assert "User=hellotalk-factory" not in unit
    assert "ExecStart=/bin/bash /opt/hellotalk-factory/hellotalk-factory-watchdog.sh" in unit
    assert "Delegate=yes" not in unit
    assert "OnUnitActiveSec=2min" in timer
    assert 'systemctl restart "$SERVICE"' in watchdog
    assert 'for attempt in 1 2 3' in watchdog
    assert 'alert-daemon-failed' in watchdog
    assert 'jobs-quarantined' not in watchdog
    assert 'jobs-stalled' not in watchdog
    for directive in (
        "PrivateTmp=true",
        "ProtectHome=true",
        "ProtectKernelModules=true",
        "ProtectKernelLogs=true",
        "ProtectClock=true",
        "LockPersonality=true",
        "RestrictRealtime=true",
        "SystemCallArchitectures=native",
    ):
        assert directive in unit


def environment(**overrides: str) -> dict[str, str]:
    values = {
        "OPENCODE_GO_API_KEY": "not-a-real-key",
        "OPENCODE_GO_MODEL": "deepseek-v4-flash",
        "GITHUB_TOKEN": "not-a-real-token",
        "GEMINI_ENABLED": "false",
    }
    values.update(overrides)
    return values


def test_missing_required_environment_is_rejected() -> None:
    with pytest.raises(ConfigurationError, match="OPENCODE_GO_API_KEY"):
        FactoryConfig.from_environment({})


def test_gemini_is_configurable_but_requires_a_key() -> None:
    with pytest.raises(ConfigurationError, match="GEMINI_API_KEY"):
        FactoryConfig.from_environment(environment(GEMINI_ENABLED="true"))


def test_free_tier_requires_zero_variable_budget() -> None:
    with pytest.raises(ConfigurationError, match="zero variable budget"):
        FactoryConfig.from_environment(
            environment(
                GEMINI_ENABLED="true",
                GEMINI_API_KEY="not-a-real-key",
                FACTORY_MONTHLY_VARIABLE_BUDGET_USD="1",
            )
        )


def test_default_repository_is_production_clone() -> None:
    config = FactoryConfig.from_environment(environment())
    assert config.repository == Path("/var/lib/hellotalk-factory/repository")
    assert config.minimum_free_disk_gib == 5
    assert config.max_parallel_jobs == 5


def test_factory_environment_template_contains_runtime_path_settings() -> None:
    template = (Path(__file__).parents[2] / "config/systemd/factory.env.example").read_text(
        encoding="utf-8"
    )

    assert "FACTORY_PODMAN_PATH=/usr/bin/podman" in template
    assert "FACTORY_TASK_IMAGE=localhost/hellotalk-factory-worker:current" in template
    assert "FACTORY_RECOVERY_DIR=/var/lib/hellotalk-factory/recovery" in template
    assert "FACTORY_REQUIRE_READY_LABEL=false" in template


def test_parallel_job_limit_must_be_positive() -> None:
    with pytest.raises(ConfigurationError, match="factory limits must be positive"):
        FactoryConfig.from_environment(environment(FACTORY_MAX_PARALLEL_JOBS="0"))


def test_disk_reserve_cannot_be_disabled() -> None:
    with pytest.raises(ConfigurationError, match="at least 1 GiB"):
        FactoryConfig.from_environment(environment(FACTORY_MINIMUM_FREE_DISK_GIB="0"))
