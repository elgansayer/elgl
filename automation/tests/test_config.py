from pathlib import Path

import pytest

from openhands_factory.architecture_guard import EXPECTED_FACTORY_ARCHITECTURE
from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError

RETIRED_SYSTEMD_UNITS = {
    "hellotalk-swarm.service",
    "hellotalk-aider.service",
    "hellotalk-swarm-watchdog.service",
    "hellotalk-guardian.service",
    "hellotalk-resolver.service",
    "hellotalk-reviewer.service",
}

RETIRED_EXECUTOR_FILENAMES = {
    "architect.py",
    "auto_dispatcher.py",
    "swarm.py",
    "aider.py",
    "guardian.py",
    "resolver.py",
    "reviewer.py",
    "pr_reviewer.py",
}


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


def test_retired_autonomous_entrypoints_cannot_reappear() -> None:
    repository_root = Path(__file__).parents[2]
    systemd = repository_root / "config" / "systemd"
    factory_sources = repository_root / "automation" / "openhands_factory"
    scripts = repository_root / "scripts"
    offenders: list[str] = []
    for name in RETIRED_SYSTEMD_UNITS:
        if (systemd / name).exists():
            offenders.append(str((systemd / name).relative_to(repository_root)))
    for root in (factory_sources, scripts):
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.name in RETIRED_EXECUTOR_FILENAMES:
                offenders.append(str(path.relative_to(repository_root)))
    assert offenders == [], f"retired autonomous executor entrypoints reappeared: {offenders}"


def test_service_allows_rootless_podman_user_namespace_helpers() -> None:
    unit = (Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory.service").read_text(encoding="utf-8")
    assert "NoNewPrivileges=true" not in unit
    assert "RestrictSUIDSGID=true" not in unit


def test_service_delegates_only_its_cgroup_beneath_the_parent_resource_cap() -> None:
    unit = (Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory.service").read_text(encoding="utf-8")
    assert "Delegate=yes" in unit
    assert "ProtectControlGroups=false" in unit
    assert "MemoryHigh=6G" in unit
    assert "MemoryMax=7G" in unit
    assert "TasksMax=1024" in unit


def test_health_service_is_a_root_daemon_recovery_watchdog() -> None:
    unit = (Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory-health.service").read_text(encoding="utf-8")
    timer = (Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory-health.timer").read_text(encoding="utf-8")
    watchdog = (Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory-watchdog.sh").read_text(encoding="utf-8")
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


def test_gemini_cannot_be_enabled_in_the_production_factory() -> None:
    with pytest.raises(ConfigurationError, match="GEMINI_ENABLED is retired"):
        FactoryConfig.from_environment(environment(GEMINI_ENABLED="true", GEMINI_API_KEY="not-a-real-key"))


def test_retired_factory_architecture_is_rejected() -> None:
    with pytest.raises(ConfigurationError, match="FACTORY_ARCHITECTURE must be"):
        FactoryConfig.from_environment(environment(FACTORY_ARCHITECTURE="old-swarm"))


def test_default_repository_is_production_clone() -> None:
    config = FactoryConfig.from_environment(environment())
    assert config.repository == Path("/var/lib/hellotalk-factory/repository")
    assert config.minimum_free_disk_gib == 5
    assert config.max_parallel_jobs == 5
    assert config.factory_architecture == EXPECTED_FACTORY_ARCHITECTURE
    assert config.factory_generation == "unknown"


def test_factory_environment_template_contains_runtime_path_settings() -> None:
    template = (Path(__file__).parents[2] / "config/systemd/factory.env.example").read_text(encoding="utf-8")
    assert "FACTORY_PODMAN_PATH=/usr/bin/podman" in template
    assert "FACTORY_TASK_IMAGE=localhost/hellotalk-factory-worker:current" in template
    assert "FACTORY_RECOVERY_DIR=/var/lib/hellotalk-factory/recovery" in template
    assert "FACTORY_REQUIRE_READY_LABEL=false" in template
    assert f"FACTORY_ARCHITECTURE={EXPECTED_FACTORY_ARCHITECTURE}" in template
    assert "GEMINI_ENABLED=false" in template


def test_parallel_job_limit_must_be_positive() -> None:
    with pytest.raises(ConfigurationError, match="factory limits must be positive"):
        FactoryConfig.from_environment(environment(FACTORY_MAX_PARALLEL_JOBS="0"))


def test_disk_reserve_cannot_be_disabled() -> None:
    with pytest.raises(ConfigurationError, match="at least 1 GiB"):
        FactoryConfig.from_environment(environment(FACTORY_MINIMUM_FREE_DISK_GIB="0"))
