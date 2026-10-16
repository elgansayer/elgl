from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _env_value(relative_path: str, key: str) -> str:
    path = REPOSITORY_ROOT / relative_path
    for line in path.read_text(encoding="utf-8").splitlines():
        name, separator, value = line.partition("=")
        if separator and name == key:
            return value.strip()
    raise AssertionError(f"{key} is missing from {relative_path}")


def test_external_review_head_quiet_period_matches_bounded_policy() -> None:
    expected = {
        "config/factory/instances/hellotalk.env": 30,
        "config/factory/instances/workout-agent.env": 120,
        "config/systemd/factory.env.example": 120,
    }
    for relative_path, expected_seconds in expected.items():
        quiet_seconds = int(_env_value(relative_path, "FACTORY_REVIEW_HEAD_STABILITY_SECONDS"))

        assert quiet_seconds == expected_seconds, relative_path
