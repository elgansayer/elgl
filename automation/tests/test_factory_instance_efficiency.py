from __future__ import annotations

from pathlib import Path

import pytest


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
MIN_EXTERNAL_REVIEW_QUIET_SECONDS = 600


def _env_value(relative_path: str, key: str) -> str:
    path = REPOSITORY_ROOT / relative_path
    for line in path.read_text(encoding="utf-8").splitlines():
        name, separator, value = line.partition("=")
        if separator and name == key:
            return value.strip()
    raise AssertionError(f"{key} is missing from {relative_path}")


@pytest.mark.parametrize(
    "relative_path",
    [
        "config/factory/instances/hellotalk.env",
        "config/factory/instances/workout-agent.env",
        "config/systemd/factory.env.example",
    ],
)
def test_external_review_head_quiet_period_covers_delayed_provider_pushes(
    relative_path: str,
) -> None:
    quiet_seconds = int(_env_value(relative_path, "FACTORY_REVIEW_HEAD_STABILITY_SECONDS"))

    assert quiet_seconds >= MIN_EXTERNAL_REVIEW_QUIET_SECONDS
