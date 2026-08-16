"""Shared hardened runtime for CLI-backed agent providers."""

from __future__ import annotations

import re
import shutil
from datetime import UTC, datetime

from openhands_factory.agents.base import (
    AgentFailure,
    AgentFailureKind,
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.pty_wrapper import PTYWrapper
from openhands_factory.sandbox import SandboxRunner

DEFAULT_AGENT_TIMEOUT_SECONDS = 30 * 60
DEFAULT_MAX_OUTPUT_BYTES = 1_000_000

_SECRET_PATTERNS = (
    re.compile(r"(?i)(authorization:\s*bearer\s+)[^\s]+"),
    re.compile(r"(?i)((?:api[_-]?key|access[_-]?token|refresh[_-]?token|secret)\s*[=:]\s*)[^\s]+"),
    re.compile(r"\b(?:sk|ghp|github_pat|xox[baprs])-[-A-Za-z0-9_]{16,}\b"),
)


def redact_agent_output(text: str) -> str:
    redacted = text
    for pattern in _SECRET_PATTERNS:
        if pattern.groups:
            redacted = pattern.sub(r"\1[REDACTED]", redacted)
        else:
            redacted = pattern.sub("[REDACTED]", redacted)
    return redacted


def passive_cli_health(provider: str) -> ProviderHealth:
    if shutil.which("podman") is None:
        return ProviderHealth(
            provider=provider,
            status=ProviderStatus.UNAVAILABLE,
            checked_at=datetime.now(UTC),
            detail="podman is not available on PATH",
        )
    return ProviderHealth(
        provider=provider,
        status=ProviderStatus.HEALTHY,
        checked_at=datetime.now(UTC),
        detail="sandbox runtime available; provider failures are tracked by the circuit breaker",
    )


def classify_cli_failure(output: str, exit_code: int, *, timed_out: bool) -> AgentFailureKind:
    if timed_out:
        return AgentFailureKind.PROVIDER_TIMEOUT
    lowered = output.lower()
    if any(
        marker in lowered
        for marker in (
            "authentication",
            "unauthorized",
            "invalid token",
            "token expired",
            "login required",
            "not logged in",
        )
    ):
        return AgentFailureKind.PROVIDER_AUTH
    if any(
        marker in lowered
        for marker in (
            "quota exhausted",
            "quota exceeded",
            "insufficient quota",
            "usage limit reached",
            "subscription limit",
        )
    ):
        return AgentFailureKind.PROVIDER_QUOTA
    if any(
        marker in lowered
        for marker in (
            "rate limit",
            "too many requests",
            "http 429",
            "status 429",
        )
    ):
        return AgentFailureKind.PROVIDER_RATE_LIMIT
    if exit_code == 127 or "command not found" in lowered or "executable file not found" in lowered:
        return AgentFailureKind.PROVIDER_UNAVAILABLE
    if any(
        marker in lowered
        for marker in (
            "connection refused",
            "connection reset",
            "temporary failure in name resolution",
            "network is unreachable",
            "tls handshake",
            "transport error",
        )
    ):
        return AgentFailureKind.PROVIDER_TRANSPORT
    return AgentFailureKind.INVALID_AGENT_OUTPUT


def run_cli_provider(
    *,
    provider: str,
    request: AgentRequest,
    command: list[str],
    timeout_seconds: int = DEFAULT_AGENT_TIMEOUT_SECONDS,
    max_output_bytes: int = DEFAULT_MAX_OUTPUT_BYTES,
) -> AgentResult:
    started_at = datetime.now(UTC)
    try:
        sandbox = SandboxRunner(request.cwd)
        wrapper = PTYWrapper(sandbox.get_podman_cmd(command))
        process = wrapper.execute_result(
            timeout_seconds=timeout_seconds,
            max_output_bytes=max_output_bytes,
        )
        finished_at = datetime.now(UTC)
        output = redact_agent_output(process.output)
        success = process.exit_code == 0 and not process.timed_out
        failure = None
        if not success:
            kind = classify_cli_failure(
                output,
                process.exit_code,
                timed_out=process.timed_out,
            )
            failure = AgentFailure(
                kind=kind,
                message=(
                    f"{provider} failed with exit code {process.exit_code}: "
                    f"{output[:500]}"
                ),
                exit_code=process.exit_code,
            )
        return AgentResult(
            provider=provider,
            phase=request.phase,
            success=success,
            started_at=started_at,
            finished_at=finished_at,
            exit_code=process.exit_code,
            summary=output,
            output_path=None,
            failure=failure,
        )
    except FileNotFoundError as error:
        finished_at = datetime.now(UTC)
        return AgentResult(
            provider=provider,
            phase=request.phase,
            success=False,
            started_at=started_at,
            finished_at=finished_at,
            exit_code=127,
            summary=None,
            output_path=None,
            failure=AgentFailure(
                kind=AgentFailureKind.PROVIDER_UNAVAILABLE,
                message=redact_agent_output(str(error)),
                exit_code=127,
            ),
        )
    except Exception as error:
        finished_at = datetime.now(UTC)
        return AgentResult(
            provider=provider,
            phase=request.phase,
            success=False,
            started_at=started_at,
            finished_at=finished_at,
            exit_code=None,
            summary=None,
            output_path=None,
            failure=AgentFailure(
                kind=AgentFailureKind.AGENT_CRASH,
                message=redact_agent_output(f"{type(error).__name__}: {error}"),
                exit_code=None,
            ),
        )


def supports_all_phases(_phase: AgentPhase) -> bool:
    return True
