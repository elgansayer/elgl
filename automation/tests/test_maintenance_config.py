from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError


def test_maintenance_defaults_to_disabled_and_environment_enables_bounded_schedule() -> None:
    environment = {"GITHUB_TOKEN": "test"}
    assert not FactoryConfig.from_environment(environment).maintenance_enabled
    configured = FactoryConfig.from_environment(
        {
            **environment,
            "FACTORY_MAINTENANCE_ENABLED": "true",
            "FACTORY_MAINTENANCE_INTERVAL_SECONDS": "900",
            "FACTORY_MAINTENANCE_DAILY_LIMIT": "4",
            "FACTORY_MAINTENANCE_ANALYSIS_TIMEOUT_SECONDS": "180",
            "FACTORY_MAINTENANCE_PEER_STATES": "/var/lib/peer/state",
        }
    )
    assert configured.maintenance_enabled
    assert configured.maintenance_interval_seconds == 900
    assert configured.maintenance_daily_limit == 4
    assert configured.maintenance_analysis_timeout_seconds == 180
    assert configured.maintenance_peer_states == [Path("/var/lib/peer/state")]


@pytest.mark.parametrize(
    ("name", "value"),
    [
        ("FACTORY_MAINTENANCE_INTERVAL_SECONDS", "0"),
        ("FACTORY_MAINTENANCE_DAILY_LIMIT", "0"),
        ("FACTORY_MAINTENANCE_DAILY_LIMIT", "25"),
        ("FACTORY_MAINTENANCE_ANALYSIS_TIMEOUT_SECONDS", "999999"),
        ("FACTORY_MAINTENANCE_PEER_STATES", "relative/path"),
    ],
)
def test_invalid_maintenance_limits_fail_closed(name: str, value: str) -> None:
    with pytest.raises(ConfigurationError):
        FactoryConfig.from_environment({"GITHUB_TOKEN": "test", name: value})
