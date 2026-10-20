from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError


def test_maintenance_defaults_to_disabled_and_environment_enables_bounded_schedule() -> None:
    environment = {"GITHUB_TOKEN": "test"}
    assert not FactoryConfig.from_environment(environment).maintenance_enabled
    assert FactoryConfig.from_environment(environment).maintenance_analysis_interval_seconds == 0
    configured = FactoryConfig.from_environment(
        {
            **environment,
            "FACTORY_MAINTENANCE_ENABLED": "true",
            "FACTORY_MAINTENANCE_INTERVAL_SECONDS": "900",
            "FACTORY_MAINTENANCE_DAILY_LIMIT": "4",
            "FACTORY_MAINTENANCE_ANALYSIS_INTERVAL_SECONDS": "14400",
            "FACTORY_MAINTENANCE_ANALYSIS_TIMEOUT_SECONDS": "180",
            "FACTORY_MAINTENANCE_PEER_STATES": "/var/lib/peer/state",
        }
    )
    assert configured.maintenance_enabled
    assert configured.maintenance_interval_seconds == 900
    assert configured.maintenance_daily_limit == 4
    assert configured.maintenance_analysis_interval_seconds == 14400
    assert configured.maintenance_analysis_timeout_seconds == 180
    assert configured.maintenance_peer_states == [Path("/var/lib/peer/state")]


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("FACTORY_MAINTENANCE_INTERVAL_SECONDS", "0"),
        ("FACTORY_MAINTENANCE_DAILY_LIMIT", "0"),
        ("FACTORY_MAINTENANCE_DAILY_LIMIT", "25"),
        ("FACTORY_MAINTENANCE_ANALYSIS_INTERVAL_SECONDS", "-1"),
        ("FACTORY_MAINTENANCE_ANALYSIS_INTERVAL_SECONDS", "86401"),
        ("FACTORY_MAINTENANCE_ANALYSIS_TIMEOUT_SECONDS", "999999"),
        ("FACTORY_MAINTENANCE_PEER_STATES", "relative/path"),
    ],
)
def test_invalid_maintenance_limits_fail_closed(name: str, value: str) -> None:
    with pytest.raises(ConfigurationError):
        FactoryConfig.from_environment({"GITHUB_TOKEN": "test", name: value})


def test_production_instance_persists_the_spaced_all_day_analysis_policy():
    path = Path(__file__).parents[2] / "config/factory/instances/hellotalk.env"
    environment = {
        name: value
        for line in path.read_text().splitlines()
        if line.startswith("FACTORY_MAINTENANCE_")
        for name, value in [line.split("=", 1)]
    }
    configured = FactoryConfig.from_environment({"GITHUB_TOKEN": "test", **environment})
    assert configured.maintenance_enabled
    assert configured.maintenance_daily_limit == 6
    assert configured.maintenance_analysis_interval_seconds == 14400
    assert configured.maintenance_interval_seconds == 900
