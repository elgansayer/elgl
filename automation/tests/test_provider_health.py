from datetime import UTC, datetime, timedelta

from openhands_factory.models import CircuitState, FailureKind, ProviderName
from openhands_factory.provider_health import (
    CircuitBreaker,
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
    from openhands_factory.provider_health import MAX_RETRY_AFTER_SECONDS

    now = datetime.now(UTC)
    breaker = CircuitBreaker(ProviderName.OPENAI_SUBSCRIPTION, 1, 300)
    breaker.record_failure(FailureKind.RATE_LIMIT, now, retry_after_seconds=10**9)
    assert not breaker.permits_call(now + timedelta(seconds=MAX_RETRY_AFTER_SECONDS - 1))
    assert breaker.permits_call(now + timedelta(seconds=MAX_RETRY_AFTER_SECONDS + 1))


def test_success_clears_a_previous_retry_after_override() -> None:
    now = datetime.now(UTC)
    breaker = CircuitBreaker(ProviderName.OPENAI_SUBSCRIPTION, 1, 300)
    breaker.record_failure(FailureKind.RATE_LIMIT, now, retry_after_seconds=3600)
    breaker.record_success()
    breaker.record_failure(FailureKind.TRANSIENT, now)
    # A fresh failure with no reported wait must not inherit the earlier override.
    assert breaker.permits_call(now + timedelta(seconds=301))
