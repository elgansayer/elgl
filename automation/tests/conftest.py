"""Opt-in Neptune fixtures; no credentials, provider sessions or live service."""

import json
from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig


@pytest.fixture
def neptune_environment(tmp_path: Path) -> dict[str, str]:
    root = tmp_path / "neptune"
    repository = root / "repository"
    repository.mkdir(parents=True)
    prompts = tmp_path / "control" / "automation" / "neptune-prompts"
    prompts.mkdir(parents=True)
    for source in (Path(__file__).parents[1] / "neptune-prompts").glob("*.md"):
        (prompts / source.name).write_text(source.read_text(), encoding="utf-8")
    agents = tmp_path / "agents.json"
    agents.write_text(
        json.dumps(
            {
                "providers": {
                    "codex": {
                        "enabled": True,
                        "command": "codex",
                        "transport": "cli",
                        "auth_mode": "subscription",
                    },
                }
            }
        ),
        encoding="utf-8",
    )
    values = {
        "FACTORY_REPOSITORY_PROFILE": "neptune",
        "FACTORY_NEPTUNE_ENABLED": "true",
        "GITHUB_REPOSITORY": "elgansayer/Neptune-Bomberman",
        "GITHUB_TOKEN": "unit-test-token",
        "FACTORY_REPOSITORY": str(repository),
        "FACTORY_STATE_DIR": str(root / "state"),
        "FACTORY_LOG_DIR": str(root / "log"),
        "FACTORY_WORKTREE_DIR": str(root / "worktrees"),
        "FACTORY_RECOVERY_DIR": str(root / "recovery"),
        "FACTORY_PROFILE_STORE": str(root / "profiles"),
        "FACTORY_PROVIDER_CAPACITY_DIR": str(tmp_path / "shared"),
        "FACTORY_PROMPT_DIR": str(prompts),
        "FACTORY_SYSTEM_PROMPT_PATH": str(prompts / "system.md"),
        "FACTORY_AGENTS_CONFIG": str(agents),
        "FACTORY_REQUIRE_TRUSTED_INTAKE": "true",
        "FACTORY_REQUIRE_READY_LABEL": "true",
        "FACTORY_MAX_PARALLEL_JOBS": "1",
        "FACTORY_MONTHLY_VARIABLE_BUDGET_USD": "0",
    }
    return values


@pytest.fixture
def neptune_config(neptune_environment: dict[str, str]) -> FactoryConfig:
    return FactoryConfig.from_environment(neptune_environment)
