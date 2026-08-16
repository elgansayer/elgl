from __future__ import annotations

import threading
import time
from pathlib import Path

from openhands_factory.config import FactoryConfig
from openhands_factory.models import FailureKind, ProviderName
from openhands_factory.provider_runtime import (
    ProviderAttributionStore,
    ProviderConcurrencyLimiter,
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
    assert factory_config.openai_max_concurrent_conversations == 1
    assert factory_config.opencode_max_concurrent_conversations == 3


def test_provider_limiter_applies_backpressure_per_provider(tmp_path: Path) -> None:
    limiter = ProviderConcurrencyLimiter(
        config(tmp_path, FACTORY_OPENCODE_MAX_CONCURRENT_CONVERSATIONS="1")
    )
    entered = threading.Event()
    release = threading.Event()
    second_entered = threading.Event()

    def first() -> None:
        with limiter.reserve(ProviderName.OPENCODE_GO):
            entered.set()
            release.wait(timeout=2)

    def second() -> None:
        with limiter.reserve(ProviderName.OPENCODE_GO):
            second_entered.set()

    first_thread = threading.Thread(target=first)
    second_thread = threading.Thread(target=second)
    first_thread.start()
    assert entered.wait(timeout=1)
    second_thread.start()
    time.sleep(0.05)
    assert not second_entered.is_set()
    release.set()
    first_thread.join(timeout=1)
    second_thread.join(timeout=1)
    assert second_entered.is_set()


def test_provider_model_is_non_secret_and_provider_specific(tmp_path: Path) -> None:
    factory_config = config(tmp_path)

    assert provider_model(factory_config, ProviderName.OPENAI_SUBSCRIPTION) == "gpt-5.2-codex"
    assert provider_model(factory_config, ProviderName.OPENCODE_GO) == "openai/deepseek-v4-flash"


def test_attribution_records_generation_provider_model_and_failure_reason(tmp_path: Path) -> None:
    path = tmp_path / "provider-attribution.json"
    store = ProviderAttributionStore(path)
    store.record(
        task_id="7049",
        provider=ProviderName.OPENCODE_GO,
        model="openai/deepseek-v4-flash",
        generation="test-generation",
        successful=False,
        fallback=True,
        elapsed_seconds=1.2345,
        failure_kind=FailureKind.RATE_LIMIT,
    )

    attempt = read_json(path, {"attempts": []})["attempts"][0]
    assert attempt["task_id"] == "7049"
    assert attempt["provider"] == "opencode-go"
    assert attempt["factory_generation"] == "test-generation"
    assert attempt["fallback"] is True
    assert attempt["failure_kind"] == "rate-limit"
    assert "not-a-real-key" not in path.read_text(encoding="utf-8")
