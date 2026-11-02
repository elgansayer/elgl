"""Classify provider envelopes, never tool output or agent-authored transcript text.

Codex exec JSONL schema: openai/codex rust-v0.166.0 exec_events.rs.
Claude print JSON: official headless CLI / Agent SDK result envelope.
These parsers do not grant merge authority or modify provider health/allowances.
"""

from __future__ import annotations

import json
import re
from dataclasses import replace
from typing import Any

from openhands_factory.agents.base import AgentFailure, AgentFailureKind
from openhands_factory.agents.cli import classify_process_failure, redact_agent_output
from openhands_factory.agents.process import ProcessResult

MAX_PROTOCOL_CHARS = 8 * 1024 * 1024
MAX_EVENTS = 50_000
MAX_MESSAGE_CHARS = 64 * 1024


def _invalid(result: ProcessResult, reason: str) -> tuple[None, AgentFailure]:
    return None, AgentFailure(
        AgentFailureKind.INVALID_AGENT_OUTPUT,
        "Invalid provider terminal protocol: " + reason,
        result.exit_code,
    )


def _process_failure(result: ProcessResult) -> tuple[None, AgentFailure] | None:
    if (
        result.cancelled
        or result.timed_out
        or result.exit_code < 0
        or result.exit_code in {126, 127}
    ):
        # Process lifecycle outranks transcripts, including on partial output.
        return None, classify_process_failure(replace(result, stdout="", stderr=""))
    if result.output_truncated:
        return _invalid(result, "output was truncated")
    if len(result.stdout) + len(result.stderr) > MAX_PROTOCOL_CHARS:
        return _invalid(result, "output exceeds the protocol bound")
    return None


def _object(raw: str) -> dict[str, Any]:
    def unique(pairs: list[tuple[str, Any]]) -> dict[str, Any]:
        value: dict[str, Any] = {}
        for key, item in pairs:
            if key in value:
                raise ValueError("duplicate JSON key")
            value[key] = item
        return value

    value = json.loads(raw, object_pairs_hook=unique)
    if not isinstance(value, dict):
        raise ValueError("expected an event object")
    return value


def _message(value: object) -> str:
    if not isinstance(value, str) or not value.strip() or len(value) > MAX_MESSAGE_CHARS:
        raise ValueError("missing or oversized terminal error message")
    return value


def _failed_message(result: ProcessResult, message: str) -> tuple[None, AgentFailure]:
    # Only a selected outer provider error reaches account-level classification.
    return None, classify_process_failure(replace(result, stdout="", stderr=message))


def codex_outcome(result: ProcessResult) -> tuple[str | None, AgentFailure | None]:
    process = _process_failure(result)
    if process is not None:
        return process
    if not result.stdout.strip():
        if result.exit_code != 0:
            # Before JSONL starts, startup/argument errors are CLI stderr only.
            return _failed_message(result, result.stderr)
        return _invalid(result, "missing Codex terminal event")
    try:
        lines = [line for line in result.stdout.splitlines() if line.strip()]
        if len(lines) > MAX_EVENTS:
            raise ValueError("too many events")
        started = False
        terminal: str | None = None
        failure_message: str | None = None
        last_error_message: str | None = None
        summary: str | None = None
        for line in lines:
            if terminal is not None:
                raise ValueError("events follow a terminal turn")
            event = _object(line)
            kind = event.get("type")
            if not isinstance(kind, str) or not kind:
                raise ValueError("missing event type")
            if kind == "turn.started":
                if started:
                    raise ValueError("duplicate turn start")
                started = True
            elif kind == "turn.completed":
                if not started:
                    raise ValueError("completion lacks a turn start")
                terminal = kind
            elif kind == "turn.failed":
                error = event.get("error")
                failure_message = _message(
                    error.get("message") if isinstance(error, dict) else None
                )
                terminal = kind
            elif kind == "error":
                last_error_message = _message(event.get("message"))
            elif kind == "item.completed":
                item = event.get("item")
                if isinstance(item, dict) and item.get("type") == "agent_message":
                    text = item.get("text")
                    if isinstance(text, str):
                        summary = redact_agent_output(text)[-4000:] or None
            # Other item/metadata records carry untrusted content, not errors.
        if result.exit_code == 0:
            if terminal != "turn.completed":
                raise ValueError("zero exit lacks a successful terminal turn")
            return summary, None
        if terminal == "turn.completed":
            raise ValueError("failed process claims successful completion")
        # A final turn.failed owns its diagnosis; previous tool/retry text cannot
        # override it. The pinned event processor permits an error notification
        # followed by a completed turn, so only a failed process may use an
        # otherwise-final error notification as its failure diagnosis.
        message = failure_message or last_error_message
        if message is None:
            raise ValueError("failed process lacks a provider terminal error")
        if terminal is None and kind != "error":
            raise ValueError("an unrecoverable error is followed by incomplete output")
        return _failed_message(result, message)
    except (ValueError, RecursionError) as error:
        return _invalid(result, str(error))


def claude_outcome(result: ProcessResult) -> tuple[str | None, AgentFailure | None]:
    process = _process_failure(result)
    if process is not None:
        return process
    raw = result.stdout.strip()
    if not raw:
        if result.exit_code != 0:
            return _failed_message(result, result.stderr)
        return _invalid(result, "missing Claude result envelope")
    # A known CLI startup quota error can precede JSON initialisation. Accept
    # only this bounded whole-line diagnostic, never a substring of a transcript.
    if (
        result.exit_code != 0
        and len(raw) <= 1024
        and re.fullmatch(r"You've hit your (?:weekly|session) limit\b[^\r\n]*", raw)
    ):
        return _failed_message(result, raw)
    try:
        envelope = _object(raw)
        if envelope.get("type") != "result" or type(envelope.get("is_error")) is not bool:
            raise ValueError("missing typed result envelope")
        subtype = envelope.get("subtype")
        if not isinstance(subtype, str) or not subtype:
            raise ValueError("missing result subtype")
        if not envelope["is_error"]:
            if subtype != "success" or result.exit_code != 0:
                raise ValueError("success envelope contradicts process or subtype")
            text = envelope.get("result")
            if not isinstance(text, str):
                raise ValueError("missing success text")
            return redact_agent_output(text)[-4000:] or None, None
        if result.exit_code == 0:
            raise ValueError("zero exit contradicts error envelope")
        if subtype == "error_max_turns":
            return None, AgentFailure(
                AgentFailureKind.TASK_FAILURE,
                "Agent reached its configured max turns",
                result.exit_code,
            )
        if subtype == "error_max_budget_usd":
            return None, AgentFailure(
                AgentFailureKind.TASK_FAILURE,
                "Agent reached its configured task budget",
                result.exit_code,
            )
        if subtype not in {"success", "error_during_execution"}:
            raise ValueError("unsupported error subtype")
        text = envelope.get("result")
        if text is None:
            errors = envelope.get("errors")
            if not isinstance(errors, list) or not 1 <= len(errors) <= 32:
                raise ValueError("missing bounded execution errors")
            text = "\n".join(_message(message) for message in errors)
        return _failed_message(result, _message(text))
    except (ValueError, RecursionError) as error:
        return _invalid(result, str(error))
