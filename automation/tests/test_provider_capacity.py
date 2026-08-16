from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import FactoryError
from openhands_factory.models import ProviderName
from openhands_factory.provider_capacity import ProviderCapacityStore, provider_limit


def config(tmp_path: Path) -> FactoryConfig:
    return FactoryConfig.from_environment(
        {
            "FACTORY_STATE_DIR": str(tmp_path),
            "OPENCODE_GO_API_KEY": "not-a-real-key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "not-a-real-token",
            "GEMINI_ENABLED": "false",
            "FACTORY_MAX_PARALLEL_JOBS": "5",
            "FACTORY_OPENAI_MAX_PARALLEL": "1",
            "FACTORY_OPENCODE_MAX_PARALLEL": "3",
            "FACTORY_PROVIDER_SLOT_WAIT_SECONDS": "1",
        }
    )


def test_provider_limits_are_independent_from_global_parallelism(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    assert provider_limit(factory_config, ProviderName.OPENAI_SUBSCRIPTION) == 1
    assert provider_limit(factory_config, ProviderName.OPENCODE_GO) == 3
    assert factory_config.max_parallel_jobs == 5


def test_second_subscription_conversation_is_backpressured(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    store = ProviderCapacityStore(tmp_path)
    store.acquire(
        ProviderName.OPENAI_SUBSCRIPTION,
        limit=1,
        owner="first",
        wait_seconds=1,
        lease_seconds=60,
    )
    with pytest.raises(FactoryError, match="capacity exhausted"):
        store.acquire(
            ProviderName.OPENAI_SUBSCRIPTION,
            limit=1,
            owner="second",
            wait_seconds=1,
            lease_seconds=60,
        )
    store.release(ProviderName.OPENAI_SUBSCRIPTION, owner="first")
    store.acquire(
        ProviderName.OPENAI_SUBSCRIPTION,
        limit=1,
        owner="second",
        wait_seconds=1,
        lease_seconds=60,
    )


def test_provider_limit_cannot_exceed_global_parallelism(tmp_path: Path) -> None:
    with pytest.raises(Exception, match="concurrency cannot exceed global parallelism"):
        FactoryConfig.from_environment(
            {
                "FACTORY_STATE_DIR": str(tmp_path),
                "OPENCODE_GO_API_KEY": "not-a-real-key",
                "OPENCODE_GO_MODEL": "deepseek-v4-flash",
                "GITHUB_TOKEN": "not-a-real-token",
                "GEMINI_ENABLED": "false",
                "FACTORY_MAX_PARALLEL_JOBS": "2",
                "FACTORY_OPENAI_MAX_PARALLEL": "3",
            }
        )
