from __future__ import annotations

from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import FactoryError, ProviderCapacityUnavailable
from openhands_factory.models import FailureKind, ProviderName
from openhands_factory.provider_capacity import ProviderCapacityStore, provider_limit, provider_slot
from openhands_factory.provider_runtime import (
    ProviderAttributionStore,
    conversation_role,
    provider_model,
)
from openhands_factory.state import read_json


def config(tmp_path: Path, **overrides: str) -> FactoryConfig:
    environment = {
        "OPENCODE_GO_API_KEY": "not-a-real-key",
        "OPENCODE_GO_MODEL": "deepseek-v4-flash",
        "GITHUB_TOKEN": "not-a-real-token",
        "GEMINI_ENABLED": "false",
        "FACTORY_STATE_DIR": str(tmp_path),
        "FACTORY_GENERATION": "test-generation",
    }
    environment.update(overrides)
    return FactoryConfig.from_environment(environment)


def test_provider_limits_are_independent_from_global_job_limit(tmp_path: Path) -> None:
    factory_config = config(
        tmp_path,
        FACTORY_MAX_PARALLEL_JOBS="5",
        FACTORY_OPENAI_MAX_CONCURRENT_CONVERSATIONS="1",
        FACTORY_OPENCODE_MAX_CONCURRENT_CONVERSATIONS="3",
    )

    assert factory_config.max_parallel_jobs == 5
    assert provider_limit(factory_config, ProviderName.OPENAI_SUBSCRIPTION) == 1
    assert provider_limit(factory_config, ProviderName.OPENCODE_GO) == 3


def test_capacity_store_is_cross_process_durable_and_expires_stale_leases(tmp_path: Path) -> None:
    store = ProviderCapacityStore(tmp_path)
    store.acquire(
        ProviderName.OPENCODE_GO,
        limit=1,
        owner="first",
        wait_seconds=1,
        lease_seconds=60,
    )

    with pytest.raises(FactoryError, match="capacity exhausted"):
        store.acquire(
            ProviderName.OPENCODE_GO,
            limit=1,
            owner="second",
            wait_seconds=1,
            lease_seconds=60,
        )

    assert store.snapshot()[ProviderName.OPENCODE_GO.value] == 1
    store.release(ProviderName.OPENCODE_GO, owner="first")
    assert store.snapshot()[ProviderName.OPENCODE_GO.value] == 0


def test_capacity_store_discards_previous_daemon_generation(tmp_path: Path) -> None:
    previous = ProviderCapacityStore(tmp_path, factory_generation="previous")
    previous.acquire(
        "claude",
        limit=1,
        owner="old-worker",
        wait_seconds=0,
        lease_seconds=3600,
    )

    current = ProviderCapacityStore(tmp_path, factory_generation="current")
    current.acquire(
        "claude",
        limit=1,
        owner="new-worker",
        wait_seconds=0,
        lease_seconds=60,
    )

    assert current.snapshot() == {"claude": 1}


def test_shared_capacity_counts_leases_from_independent_instances(tmp_path: Path) -> None:
    first = ProviderCapacityStore(tmp_path)
    second = ProviderCapacityStore(tmp_path)
    first.acquire("claude", limit=1, owner="hellotalk:1", wait_seconds=0, lease_seconds=60)

    with pytest.raises(ProviderCapacityUnavailable):
        second.acquire(
            "claude",
            limit=1,
            owner="workout-agent:1",
            wait_seconds=0,
            lease_seconds=60,
        )


def test_conversation_provider_slot_uses_shared_capacity_directory(tmp_path: Path) -> None:
    shared = tmp_path / "shared"
    shared.mkdir()
    factory_config = config(tmp_path).model_copy(update={"provider_capacity_dir": shared})

    with provider_slot(factory_config, ProviderName.OPENAI_SUBSCRIPTION, owner="job:1"):
        assert (shared / "provider-capacity.json").exists()
        assert not (factory_config.state_dir / "provider-capacity.json").exists()


def test_provider_model_is_non_secret_and_provider_specific(tmp_path: Path) -> None:
    factory_config = config(tmp_path)

    assert provider_model(factory_config, ProviderName.OPENAI_SUBSCRIPTION) == "gpt-5.6-sol"
    assert provider_model(factory_config, ProviderName.OPENCODE_GO) == "openai/deepseek-v4-flash"


def test_prompt_prefixes_produce_phase_attribution() -> None:
    assert conversation_role("# Task Execution\nbody") == "implementation"
    assert conversation_role("# Independent Pull Request Review\nbody") == "review"


def test_attribution_records_generation_phase_fallback_reason_and_failure(tmp_path: Path) -> None:
    path = tmp_path / "provider-attribution.json"
    store = ProviderAttributionStore(path)
    store.record(
        task_id="7049",
        role="implementation",
        provider=ProviderName.OPENCODE_GO,
        model="openai/deepseek-v4-flash",
        generation="test-generation",
        successful=False,
        fallback=True,
        fallback_reason="openai-oauth-missing",
        elapsed_seconds=1.2345,
        capacity_wait_seconds=0.25,
        failure_kind=FailureKind.RATE_LIMIT,
    )

    attempt = read_json(path, {"attempts": []})["attempts"][0]
    assert attempt["task_id"] == "7049"
    assert attempt["role"] == "implementation"
    assert attempt["provider"] == "opencode-go"
    assert attempt["factory_generation"] == "test-generation"
    assert attempt["fallback_reason"] == "openai-oauth-missing"
    assert attempt["failure_kind"] == "rate-limit"
    assert store.latest_provider("7049", role="implementation") is ProviderName.OPENCODE_GO
    assert "not-a-real-key" not in path.read_text(encoding="utf-8")
