from openhands_factory.failure_fingerprint import fingerprint_failure
from openhands_factory.models import FailureKind, ProviderName


def test_equivalent_failures_collapse_volatile_identifiers() -> None:
    first = fingerprint_failure(
        FailureKind.TOOL,
        "Run 123456 failed at 2026-08-16T09:12:33Z for commit abcdef1234567890",
        provider=ProviderName.OPENCODE_GO,
        phase="CI repair",
    )
    second = fingerprint_failure(
        FailureKind.TOOL,
        "Run 987654 failed at 2026-08-16T09:45:10Z for commit fedcba0987654321",
        provider=ProviderName.OPENCODE_GO,
        phase="CI   repair",
    )

    assert first.digest == second.digest
    assert first.canonical == second.canonical
    assert "<number>" in first.canonical
    assert "<timestamp>" in first.canonical
    assert "<hex>" in first.canonical


def test_provider_and_failure_kind_remain_part_of_identity() -> None:
    detail = "request failed with status 429"
    opencode = fingerprint_failure(
        FailureKind.RATE_LIMIT,
        detail,
        provider=ProviderName.OPENCODE_GO,
    )
    openai = fingerprint_failure(
        FailureKind.RATE_LIMIT,
        detail,
        provider=ProviderName.OPENAI_SUBSCRIPTION,
    )
    authentication = fingerprint_failure(
        FailureKind.AUTHENTICATION,
        detail,
        provider=ProviderName.OPENCODE_GO,
    )

    assert opencode.digest != openai.digest
    assert opencode.digest != authentication.digest


def test_uuid_and_whitespace_do_not_create_new_fingerprint() -> None:
    first = fingerprint_failure(
        FailureKind.MALFORMED_RESPONSE,
        "Conversation 123e4567-e89b-12d3-a456-426614174000   returned invalid JSON",
    )
    second = fingerprint_failure(
        FailureKind.MALFORMED_RESPONSE,
        "conversation 550e8400-e29b-41d4-a716-446655440000 returned invalid JSON",
    )

    assert first == second


def test_short_meaningful_numbers_are_preserved() -> None:
    first = fingerprint_failure(FailureKind.TOOL, "HTTP 429 from provider")
    second = fingerprint_failure(FailureKind.TOOL, "HTTP 500 from provider")
    assert first.digest != second.digest


def test_canonical_detail_is_bounded() -> None:
    fingerprint = fingerprint_failure(FailureKind.TRANSIENT, "x" * 5000)
    assert len(fingerprint.canonical) < 1100
    assert len(fingerprint.digest) == 20
