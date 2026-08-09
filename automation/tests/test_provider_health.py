from datetime import UTC, datetime, timedelta

from openhands_factory.models import CircuitState, FailureKind, ProviderName
from openhands_factory.provider_health import CircuitBreaker, classify_failure


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
