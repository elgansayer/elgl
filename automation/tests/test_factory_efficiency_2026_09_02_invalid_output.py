from pathlib import Path

from openhands_factory.config import FactoryConfig

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def test_production_invalid_output_circuit_outlives_normal_refreshes() -> None:
    agents_path = REPOSITORY_ROOT / "config" / "factory" / "agents.production.json"
    config = FactoryConfig.from_environment(
        {
            "FACTORY_AGENTS_CONFIG": str(agents_path),
            "GITHUB_TOKEN": "test-token",
        }
    )

    breaker = config.agents.circuit_breaker
    assert breaker.failure_threshold == 1
    assert breaker.invalid_output_cooldown_seconds == 900
    assert breaker.invalid_output_cooldown_seconds > breaker.default_cooldown_seconds
    assert breaker.invalid_output_cooldown_seconds >= 3 * 300
