"""Owned protocol fixtures and actual-derived diagnostics; no provider invocation."""

import json
from dataclasses import replace
from pathlib import Path

import pytest

from openhands_factory.agents.base import AgentFailureKind, AgentPhase, AgentRequest
from openhands_factory.agents.claude import ClaudeCodeProvider
from openhands_factory.agents.codex import CodexProvider
from openhands_factory.agents.health import AgentCircuitBreaker
from openhands_factory.agents.process import ProcessResult
from openhands_factory.agents.terminal_output import (
    MAX_PROTOCOL_CHARS,
    claude_outcome,
    codex_outcome,
)
from openhands_factory.models import Task

CAPACITY = "Selected model is at capacity. Please try a different model."
WEEKLY = "You've hit your weekly limit · resets 2pm (UTC)"
START = {"type": "turn.started"}
COMPLETE = {"type": "turn.completed", "usage": {"input_tokens": 1, "output_tokens": 1}}


def process(stdout="", stderr="", exit_code=1, **changes):
    result = ProcessResult(
        ("owned-provider-fixture",), exit_code, stdout, stderr, False, False, 0.1
    )
    return replace(result, **changes)


def stream(*events):
    return "\n".join(json.dumps(event) for event in events) + "\n"


def failed(message):
    return {"type": "turn.failed", "error": {"message": message}}


def claude_result(error, result, subtype="success", **changes):
    return json.dumps(
        {"type": "result", "subtype": subtype, "is_error": error, "result": result, **changes}
    )


@pytest.mark.parametrize(
    "content", ["authentication failed", "quota exceeded", "429", "tests failed"]
)
def test_codex_only_terminal_error_drives_account_health(content):
    output = stream(
        START,
        {
            "type": "item.completed",
            "item": {"type": "command_execution", "aggregated_output": content},
        },
        {"type": "item.completed", "item": {"type": "agent_message", "text": content}},
        failed(CAPACITY),
    )
    _, failure = codex_outcome(process(output, stderr="echoed transcript: authentication failed"))
    assert failure.kind is AgentFailureKind.PROVIDER_RATE_LIMIT
    assert content not in failure.message
    breaker = AgentCircuitBreaker("codex", 2, 60)
    breaker.record_failure(failure.kind)
    assert breaker.state == "closed"  # One retryable failure is not an auth lockout.


@pytest.mark.parametrize(
    "message,kind",
    [
        (CAPACITY, AgentFailureKind.PROVIDER_RATE_LIMIT),
        ("Authentication failed: expired token", AgentFailureKind.PROVIDER_AUTH),
        ("Quota exceeded", AgentFailureKind.PROVIDER_QUOTA),
        ("429 too many requests retry-after: 120", AgentFailureKind.PROVIDER_RATE_LIMIT),
        ("connection dropped", AgentFailureKind.PROVIDER_TRANSPORT),
    ],
)
def test_codex_typed_terminal_errors_keep_real_failure_classes(message, kind):
    _, failure = codex_outcome(process(stream(START, failed(message))))
    assert failure.kind is kind
    if "120" in message:
        assert failure.retry_after_seconds == 120
    _, startup = codex_outcome(process(stream({"type": "error", "message": message})))
    assert startup.kind is kind


def test_codex_success_ignores_agent_and_tool_error_words_and_keeps_redaction():
    result = process(
        stream(
            START,
            {
                "type": "item.completed",
                "item": {"type": "command_execution", "aggregated_output": "unauthorized"},
            },
            {
                "type": "item.completed",
                "item": {
                    "type": "agent_message",
                    "text": "quota exceeded is a fixture; token=owned-secret",
                },
            },
            COMPLETE,
        ),
        stderr="warning: authentication failed is quoted source",
        exit_code=0,
    )
    summary, failure = codex_outcome(result)
    assert failure is None
    assert "owned-secret" not in summary
    assert "[redacted]" in summary


def test_codex_completed_turn_owns_recovered_error_diagnostics():
    # The pinned upstream JSONL processor emits error notifications separately
    # and accepts a later Completed status. An earlier auth/retry error cannot
    # override that authoritative successful terminal result.
    result = process(
        stream(
            START,
            {"type": "error", "message": "authentication failed during recovered request"},
            {"type": "item.completed", "item": {"type": "agent_message", "text": "finished"}},
            COMPLETE,
        ),
        exit_code=0,
    )
    summary, failure = codex_outcome(result)
    assert summary == "finished" and failure is None


@pytest.mark.parametrize(
    "output,exit_code",
    [
        ("", 0),
        ("plain text", 0),
        (stream(START), 0),
        (stream(COMPLETE), 0),
        (stream(START, START, COMPLETE), 0),
        (stream(START, COMPLETE, COMPLETE), 0),
        (stream(START, failed(CAPACITY)), 0),
        (stream(START, COMPLETE), 1),
        (stream(START), 1),
        (stream(START, failed(CAPACITY), {"type": "item.completed"}), 1),
        (
            stream(
                START,
                {"type": "error", "message": "authentication failed"},
                {"type": "item.completed"},
            ),
            1,
        ),
        (stream(START, {"type": "turn.failed", "error": {}}), 1),
        ('{"type":"turn.completed","type":"turn.failed"}', 1),
        (stream(START) + '{"type":"turn.failed",', 1),
    ],
)
def test_codex_missing_malformed_and_contradictory_output_is_never_success(output, exit_code):
    _, failure = codex_outcome(process(output, "authentication failed", exit_code=exit_code))
    assert failure.kind is AgentFailureKind.INVALID_AGENT_OUTPUT


@pytest.mark.parametrize(
    "outcome,output",
    [
        (codex_outcome, stream(START, COMPLETE)),
        (claude_outcome, claude_result(False, "done")),
    ],
)
def test_truncation_and_size_bound_reject_a_previously_complete_envelope(outcome, output):
    _, failure = outcome(process(output, exit_code=0, output_truncated=True))
    assert failure.kind is AgentFailureKind.INVALID_AGENT_OUTPUT
    _, failure = outcome(process(output, stderr="x" * (MAX_PROTOCOL_CHARS + 1), exit_code=0))
    assert failure.kind is AgentFailureKind.INVALID_AGENT_OUTPUT


@pytest.mark.parametrize("outcome", [codex_outcome, claude_outcome])
@pytest.mark.parametrize(
    "changes,kind",
    [
        ({"cancelled": True}, AgentFailureKind.CANCELLED),
        ({"timed_out": True}, AgentFailureKind.PROVIDER_TIMEOUT),
        ({"exit_code": -9}, AgentFailureKind.AGENT_CRASH),
        ({"exit_code": 127}, AgentFailureKind.PROVIDER_UNAVAILABLE),
    ],
)
def test_lifecycle_precedence_ignores_partial_untrusted_transcripts(outcome, changes, kind):
    _, failure = outcome(process("authentication failed", "quota exceeded", **changes))
    assert failure.kind is kind


def test_claude_result_success_and_errors_are_separate_from_model_text():
    summary, failure = claude_outcome(
        process(claude_result(False, "authentication failed is test data"), exit_code=0)
    )
    assert summary == "authentication failed is test data" and failure is None
    _, failure = claude_outcome(process(claude_result(True, WEEKLY), stderr="unauthorized fixture"))
    assert failure.kind is AgentFailureKind.PROVIDER_QUOTA
    _, startup = claude_outcome(process(WEEKLY))
    assert startup.kind is AgentFailureKind.PROVIDER_QUOTA
    _, errors = claude_outcome(
        process(
            json.dumps(
                {
                    "type": "result",
                    "subtype": "error_during_execution",
                    "is_error": True,
                    "errors": ["Authentication required: token=owned-secret"],
                }
            )
        )
    )
    assert errors.kind is AgentFailureKind.PROVIDER_AUTH
    assert "owned-secret" not in errors.message


@pytest.mark.parametrize("subtype", ["error_max_turns", "error_max_budget_usd"])
def test_claude_task_limits_cannot_poison_shared_account_health(subtype):
    _, failure = claude_outcome(process(claude_result(True, "authentication failed", subtype)))
    assert failure.kind is AgentFailureKind.TASK_FAILURE


@pytest.mark.parametrize(
    "output,exit_code",
    [
        ("", 0),
        ("plain success", 0),
        ("[]", 0),
        ("{}", 0),
        (claude_result(True, WEEKLY), 0),
        (claude_result(False, "done"), 1),
        (claude_result(False, "done", "unexpected"), 0),
        (claude_result(True, "authentication failed", "unknown-error"), 1),
        (claude_result("false", "done"), 0),
        ('{"type":"result","type":"other"}', 1),
    ],
)
def test_claude_malformed_or_contradictory_result_fails_without_auth_inference(output, exit_code):
    _, failure = claude_outcome(process(output, "authentication failed", exit_code))
    assert failure.kind is AgentFailureKind.INVALID_AGENT_OUTPUT


@pytest.mark.parametrize(
    "provider,output,expected",
    [
        (CodexProvider, stream(START, failed(CAPACITY)), AgentFailureKind.PROVIDER_RATE_LIMIT),
        (ClaudeCodeProvider, claude_result(True, WEEKLY), AgentFailureKind.PROVIDER_QUOTA),
    ],
)
def test_adapter_run_uses_the_new_terminal_boundary(provider, output, expected, tmp_path):
    class Runner:
        def run(self, command, **kwargs):
            self.command = command
            return process(output, "authentication failed is earlier transcript")

    runner = Runner()
    adapter = provider(process_runner=runner)
    result = adapter.run(
        AgentRequest(
            AgentPhase.CODE_REVIEW,
            Task("621", "terminal", "", "issue", 1),
            "review owned fixture",
            Path(tmp_path),
        )
    )
    assert not result.success and result.failure.kind is expected
    if provider is CodexProvider:
        assert "--json" in runner.command
    else:
        assert runner.command[runner.command.index("--output-format") + 1] == "json"
