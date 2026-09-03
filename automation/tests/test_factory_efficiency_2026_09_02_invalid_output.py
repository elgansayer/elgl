from pathlib import Path

from openhands_factory.config import FactoryConfig

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _environment_value(path: Path, name: str) -> str:
    for line in path.read_text(encoding="utf-8").splitlines():
        key, separator, value = line.partition("=")
        if separator and key == name:
            return value
    raise AssertionError(f"{name} is missing from {path}")


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

    for instance in ("hellotalk", "workout-agent"):
        environment_path = (
            REPOSITORY_ROOT / "config" / "factory" / "instances" / f"{instance}.env"
        )
        refresh_seconds = int(_environment_value(environment_path, "FACTORY_COOLDOWN_SECONDS"))
        assert breaker.invalid_output_cooldown_seconds >= 3 * refresh_seconds
