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


def test_competing_legacy_agent_workflows_are_retired() -> None:
    workflows = Path(__file__).parents[2] / ".github" / "workflows"

    for name in ("architect.yml", "auto-dispatcher.yml", "openhands.yml", "pr-reviewer.yml"):
        assert not (workflows / name).exists()


def test_service_allows_rootless_podman_user_namespace_helpers() -> None:
    unit = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory.service"
    ).read_text(encoding="utf-8")

    assert "NoNewPrivileges=true" not in unit
    assert "RestrictSUIDSGID=true" not in unit


def test_backend_test_heap_fits_the_service_memory_limit() -> None:
    package = (Path(__file__).parents[2] / "backend" / "package.json").read_text(
        encoding="utf-8"
    )

    assert "--max-old-space-size=3072" in package




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


def test_disk_reserve_cannot_be_disabled() -> None:
    with pytest.raises(ConfigurationError, match="at least 1 GiB"):
        FactoryConfig.from_environment(environment(FACTORY_MINIMUM_FREE_DISK_GIB="0"))
