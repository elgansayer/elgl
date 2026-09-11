from __future__ import annotations

from datetime import UTC, datetime, timedelta

from openhands_factory.agents.base import AgentFailureKind
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore


def test_repeated_quota_failures_back_off_exponentially_with_a_bound() -> None:
    start = datetime(2026, 9, 10, 12, 0, tzinfo=UTC)
    breaker = AgentCircuitBreaker("quota-provider", failure_threshold=1, cooldown_seconds=3600)

    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, start)
    assert breaker.effective_cooldown_seconds() == 3600
    assert breaker.get_health().retry_after == start + timedelta(hours=1)

    second_probe = start + timedelta(hours=1)
    assert breaker.permits_call(second_probe)
    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, second_probe)
    assert breaker.effective_cooldown_seconds() == 7200
    assert breaker.get_health().retry_after == second_probe + timedelta(hours=2)

    third_probe = second_probe + timedelta(hours=2)
    assert breaker.permits_call(third_probe)
    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, third_probe)
    assert breaker.effective_cooldown_seconds() == 14_400

    fourth_probe = third_probe + timedelta(hours=4)
    assert breaker.permits_call(fourth_probe)
    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, fourth_probe)
    assert breaker.effective_cooldown_seconds() == 14_400


def test_quota_backoff_scales_the_failure_specific_production_floor() -> None:
    """Production passes the quota floor as retry_after_seconds, not breaker default."""

    start = datetime(2026, 9, 10, 12, 0, tzinfo=UTC)
    breaker = AgentCircuitBreaker("quota-provider", failure_threshold=1, cooldown_seconds=300)

    breaker.record_failure(
        AgentFailureKind.PROVIDER_QUOTA,
        start,
        retry_after_seconds=3600,
    )
    assert breaker.effective_cooldown_seconds() == 3600

    second_probe = start + timedelta(hours=1)
    assert breaker.permits_call(second_probe)
    breaker.record_failure(
        AgentFailureKind.PROVIDER_QUOTA,
        second_probe,
        retry_after_seconds=3600,
    )
    assert breaker.effective_cooldown_seconds() == 7200

    third_probe = second_probe + timedelta(hours=2)
    assert breaker.permits_call(third_probe)
    breaker.record_failure(
        AgentFailureKind.PROVIDER_QUOTA,
        third_probe,
        retry_after_seconds=3600,
    )
    assert breaker.effective_cooldown_seconds() == 14_400


def test_success_resets_quota_backoff_immediately() -> None:
    start = datetime(2026, 9, 10, 12, 0, tzinfo=UTC)
    breaker = AgentCircuitBreaker("quota-provider", failure_threshold=1, cooldown_seconds=3600)

    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, start)
    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, start + timedelta(hours=1))
    assert breaker.effective_cooldown_seconds() == 7200

    breaker.record_success()
    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, start + timedelta(hours=2))

    assert breaker.consecutive_failures == 1
    assert breaker.effective_cooldown_seconds() == 3600


def test_quota_backoff_scales_a_longer_retry_floor_after_failed_probe() -> None:
    start = datetime(2026, 9, 10, 12, 0, tzinfo=UTC)
    breaker = AgentCircuitBreaker("quota-provider", failure_threshold=1, cooldown_seconds=3600)

    breaker.record_failure(
        AgentFailureKind.PROVIDER_QUOTA,
        start,
        retry_after_seconds=21_600,
    )
    assert breaker.effective_cooldown_seconds() == 21_600

    next_probe = start + timedelta(hours=6)
    assert breaker.permits_call(next_probe)
    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, next_probe)

    assert breaker.effective_cooldown_seconds() == 43_200
    assert breaker.get_health().retry_after == next_probe + timedelta(hours=12)


def test_non_quota_cooldowns_do_not_gain_exponential_backoff() -> None:
    start = datetime(2026, 9, 10, 12, 0, tzinfo=UTC)
    breaker = AgentCircuitBreaker("auth-provider", failure_threshold=1, cooldown_seconds=3600)

    breaker.record_failure(AgentFailureKind.PROVIDER_AUTH, start)
    breaker.record_failure(AgentFailureKind.PROVIDER_AUTH, start + timedelta(hours=1))

    assert breaker.consecutive_failures == 1
    assert breaker.effective_cooldown_seconds() == 3600


def test_quota_backoff_survives_health_store_restart(tmp_path) -> None:
    start = datetime(2026, 9, 10, 12, 0, tzinfo=UTC)
    path = tmp_path / "quota-health.json"
    store = AgentHealthStore(path)
    breaker = AgentCircuitBreaker("quota-provider", failure_threshold=1, cooldown_seconds=3600)
    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, start)
    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, start + timedelta(hours=1))
    breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA, start + timedelta(hours=3))
    store.save({breaker.provider: breaker})

    loaded = store.load(
        {
            breaker.provider: AgentCircuitBreaker(
                breaker.provider,
                failure_threshold=1,
                cooldown_seconds=3600,
            )
        }
    )[breaker.provider]

    assert loaded.consecutive_failures == 3
    assert loaded.last_failure_kind is AgentFailureKind.PROVIDER_QUOTA
    assert loaded.effective_cooldown_seconds() == 14_400
