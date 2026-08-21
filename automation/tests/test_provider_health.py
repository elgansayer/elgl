import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.models import CircuitState, FailureKind, ProviderName
from openhands_factory.provider_health import (
    MAX_RETRY_AFTER_SECONDS,
    CircuitBreaker,
    ProviderHealthStore,
    classify_failure,
    extract_retry_after_seconds,
)


def test_transient_failures_open_and_recover_circuit() -> None:
    now = datetime.now(UTC)
    breaker = CircuitBreaker(ProviderName.OPENCODE_GO, 2, 60)
    breaker.record_failure(FailureKind.TRANSIENT, now)
    assert breaker.state is CircuitState.CLOSED
    breaker.record_failure(FailureKind.TRANSIENT, now)
    assert breaker.state is CircuitState.OPEN
    assert breaker.permits_call(now + timedelta(seconds=61))
    assert breaker.state is CircuitState.HALF_OPEN
    breaker.record_success()
    assert breaker.state is CircuitState.CLOSED


def test_authentication_failure_opens_immediately() -> None:
    breaker = CircuitBreaker(ProviderName.OPENAI_SUBSCRIPTION, 3, 300)
    breaker.record_failure(FailureKind.AUTHENTICATION)
    assert breaker.state is CircuitState.OPEN


def test_permanent_and_transient_classification() -> None:
    assert classify_failure(401, "unauthorised") is FailureKind.AUTHENTICATION
    assert classify_failure(404, "unknown model") is FailureKind.CONFIGURATION
    assert classify_failure(503, "unavailable") is FailureKind.TRANSIENT
    assert classify_failure(429, "quota reached") is FailureKind.RATE_LIMIT


def test_usage_limit_message_classified_as_rate_limit() -> None:
    assert (
        classify_failure(None, '{"error":{"message":"The usage limit has been reached"}}')
        is FailureKind.RATE_LIMIT
    )


def test_extract_retry_after_seconds_reads_embedded_reset_duration() -> None:
    message = '{"error":{"type":"usage_limit_reached","resets_in_seconds":496742}}'
    assert extract_retry_after_seconds(message) == 496742


def test_extract_retry_after_seconds_absent_when_not_present() -> None:
    assert extract_retry_after_seconds("plain rate limit error") is None


def test_breaker_honours_a_longer_provider_reported_wait_over_the_default_cooldown() -> None:
    now = datetime.now(UTC)
    breaker = CircuitBreaker(ProviderName.OPENAI_SUBSCRIPTION, 1, 300)
    breaker.record_failure(FailureKind.RATE_LIMIT, now, retry_after_seconds=3600)
    assert breaker.state is CircuitState.OPEN
    # The default 300s cooldown would have reopened this by now - the
    # provider-reported hour-long wait must win instead.
    assert not breaker.permits_call(now + timedelta(seconds=600))
    assert breaker.permits_call(now + timedelta(seconds=3601))


def test_breaker_caps_an_absurd_provider_reported_wait() -> None:
    now = datetime.now(UTC)
    breaker = CircuitBreaker(ProviderName.OPENAI_SUBSCRIPTION, 1, 300)
    breaker.record_failure(FailureKind.RATE_LIMIT, now, retry_after_seconds=10**9)
    assert not breaker.permits_call(now + timedelta(seconds=MAX_RETRY_AFTER_SECONDS - 1))
    assert breaker.permits_call(now + timedelta(seconds=MAX_RETRY_AFTER_SECONDS + 1))


def test_breaker_clamps_a_negative_provider_reported_wait() -> None:
    breaker = CircuitBreaker(ProviderName.OPENAI_SUBSCRIPTION, 1, 300)

    breaker.record_failure(FailureKind.RATE_LIMIT, retry_after_seconds=-1)

    assert breaker.retry_after_seconds == 0


def test_success_clears_a_previous_retry_after_override() -> None:
    now = datetime.now(UTC)
    breaker = CircuitBreaker(ProviderName.OPENAI_SUBSCRIPTION, 1, 300)
    breaker.record_failure(FailureKind.RATE_LIMIT, now, retry_after_seconds=3600)
    breaker.record_success()
    breaker.record_failure(FailureKind.TRANSIENT, now)
    # A fresh failure with no reported wait must not inherit the earlier override.
    assert breaker.permits_call(now + timedelta(seconds=301))


def test_invalid_persisted_state_fails_closed_for_one_bounded_cooldown(tmp_path: Path) -> None:
    now = datetime(2026, 8, 17, 1, 0, tzinfo=UTC)
    path = tmp_path / "health.json"
    path.write_text(
        json.dumps(
            {
                "breakers": [
                    {
                        "provider": ProviderName.OPENAI_SUBSCRIPTION.value,
                        "failure_threshold": 3,
                        "cooldown_seconds": 300,
                        "state": "corrupt-state",
                        "consecutive_failures": 1,
                        "opened_at": "not-a-timestamp",
                        "retry_after_seconds": None,
                    }
                ]
            }
        )
    )

    breaker = ProviderHealthStore(path).load(now=now)[0]

    assert breaker.state is CircuitState.OPEN
    assert breaker.opened_at == now
    assert breaker.consecutive_failures == breaker.failure_threshold
    assert not breaker.permits_call(now + timedelta(seconds=299))
    assert breaker.permits_call(now + timedelta(seconds=301))


def test_corrupt_open_timestamp_restarts_cooldown_instead_of_wedging_provider(
    tmp_path: Path,
) -> None:
    now = datetime(2026, 8, 17, 1, 0, tzinfo=UTC)
    path = tmp_path / "health.json"
    path.write_text(
        json.dumps(
            {
                "breakers": [
                    {
                        "provider": ProviderName.OPENCODE_GO.value,
                        "failure_threshold": 2,
                        "cooldown_seconds": 120,
                        "state": CircuitState.OPEN.value,
                        "consecutive_failures": 2,
                        "opened_at": "broken",
                        "retry_after_seconds": 10**12,
                    }
                ]
            }
        )
    )

    breaker = ProviderHealthStore(path).load(now=now)[0]

    assert breaker.opened_at == now
    assert breaker.retry_after_seconds == MAX_RETRY_AFTER_SECONDS
    assert not breaker.permits_call(now + timedelta(days=6, hours=23))
    assert breaker.permits_call(now + timedelta(days=7, seconds=1))


def test_future_open_timestamp_is_clamped_to_restart_time(tmp_path: Path) -> None:
    now = datetime(2026, 8, 17, 1, 0, tzinfo=UTC)
    path = tmp_path / "health.json"
    path.write_text(
        json.dumps(
            {
                "breakers": [
                    {
                        "provider": ProviderName.OPENCODE_GO.value,
                        "failure_threshold": 2,
                        "cooldown_seconds": 60,
                        "state": CircuitState.OPEN.value,
                        "consecutive_failures": 2,
                        "opened_at": (now + timedelta(days=365)).isoformat(),
                        "retry_after_seconds": None,
                    }
                ]
            }
        )
    )

    breaker = ProviderHealthStore(path).load(now=now)[0]

    assert breaker.opened_at == now
    assert not breaker.permits_call(now + timedelta(seconds=59))
    assert breaker.permits_call(now + timedelta(seconds=61))


def test_unknown_provider_entry_is_ignored_without_losing_known_provider(tmp_path: Path) -> None:
    path = tmp_path / "health.json"
    path.write_text(
        json.dumps(
            {
                "breakers": [
                    {"provider": "retired-provider", "state": "open"},
                    {
                        "provider": ProviderName.OPENCODE_GO.value,
                        "failure_threshold": 2,
                        "cooldown_seconds": 60,
                        "state": CircuitState.CLOSED.value,
                        "consecutive_failures": 0,
                        "opened_at": None,
                        "retry_after_seconds": None,
                    },
                ]
            }
        )
    )

    breakers = ProviderHealthStore(path).load()

    assert [breaker.provider for breaker in breakers] == [ProviderName.OPENCODE_GO]
