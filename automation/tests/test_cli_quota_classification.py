"""Provider usage-limit messages become quota failures with the provider's own retry time."""

from datetime import UTC, datetime

from openhands_factory.agents.base import AgentFailureKind
from openhands_factory.agents.cli import classify_process_failure, extract_retry_after_seconds
from openhands_factory.agents.process import ProcessResult

# Exact Codex 0.166 output observed on 2026-11-04T13:38Z (typographic apostrophe).
CODEX_USAGE_LIMIT = (
    "You\u2019ve hit your usage limit. Visit https://chatgpt.com/settings/usage to purchase "
    "more credits or try again at Nov 8th, 2026 11:38 AM."
)
NOW = datetime(2026, 11, 4, 13, 38, tzinfo=UTC)


def test_codex_usage_limit_is_quota_not_transport() -> None:
    failure = classify_process_failure(
        ProcessResult(("codex",), 1, CODEX_USAGE_LIMIT, "", False, False, 0.1)
    )
    assert failure.kind is AgentFailureKind.PROVIDER_QUOTA
    assert failure.retry_after_seconds is not None
    assert 3 * 24 * 3600 < failure.retry_after_seconds <= 7 * 24 * 3600


def test_absolute_retry_time_is_parsed_and_bounded() -> None:
    lowered = CODEX_USAGE_LIMIT.lower()
    assert extract_retry_after_seconds(lowered, NOW) == (4 * 24 - 2) * 3600
    assert (
        extract_retry_after_seconds("try again at nov 8th, 2026 11:38 pm", NOW)
        == (4 * 24 - 2 + 12) * 3600
    )
    assert extract_retry_after_seconds("try again at dec 31, 2026 09:00", NOW) == 7 * 24 * 3600
    assert extract_retry_after_seconds("try again at nov 1st, 2026 10:00 am", NOW) == 0
    assert extract_retry_after_seconds("try again at nov 31st, 2026 10:00 am", NOW) is None
    assert extract_retry_after_seconds("try again at foo 8th, 2026 10:00 am", NOW) is None


def test_existing_relative_forms_are_unchanged() -> None:
    assert extract_retry_after_seconds("retry-after: 120", NOW) == 120
    assert extract_retry_after_seconds("resets in 2h 5m", NOW) == 2 * 3600 + 300
    assert extract_retry_after_seconds("no timing here", NOW) is None


CLAUDE_FIVE_HOUR = "You've hit your 5-hour limit \u00b7 resets 2:20pm (UTC)"


def test_claude_five_hour_limit_is_quota_without_inferring_a_reset_clock() -> None:
    # Session-style "resets 2:20pm (UTC)" keeps the configured quota cooldown, matching
    # test_terminal_output's existing policy; only the classification changes here.
    failure = classify_process_failure(
        ProcessResult(("claude",), 1, CLAUDE_FIVE_HOUR, "", False, False, 0.1)
    )
    assert failure.kind is AgentFailureKind.PROVIDER_QUOTA
    assert failure.retry_after_seconds is None


def test_hit_limit_family_and_unrelated_text() -> None:
    for text in ("You have hit your monthly limit", "You've hit your daily usage limit"):
        failure = classify_process_failure(ProcessResult(("x",), 1, text, "", False, False, 0.1))
        assert failure.kind is AgentFailureKind.PROVIDER_QUOTA, text
    other = classify_process_failure(
        ProcessResult(("x",), 1, "connection reset by peer", "", False, False, 0.1)
    )
    assert other.kind is AgentFailureKind.PROVIDER_TRANSPORT
