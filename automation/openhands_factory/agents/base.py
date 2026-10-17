"""Base models and protocols for agent providers."""

from __future__ import annotations

from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import Protocol, runtime_checkable

from openhands_factory.models import Task


class AgentPhase(StrEnum):
    PLANNING = "planning"
    ARCHITECTURE = "architecture"
    IMPLEMENTATION = "implementation"
    SECURITY_REVIEW = "security-review"
    QUALITY_REPAIR = "quality-repair"
    CODE_REVIEW = "code-review"
    CI_REPAIR = "ci-repair"
    GENERAL_ACTION = "general-action"


class ProviderStatus(StrEnum):
    HEALTHY = "healthy"
    DEGRADED = "degraded"
    RATE_LIMITED = "rate_limited"
    QUOTA_EXHAUSTED = "quota_exhausted"
    AUTH_REQUIRED = "auth_required"
    UNAVAILABLE = "unavailable"
    DISABLED = "disabled"


@dataclass
class ProviderHealth:
    provider: str
    status: ProviderStatus
    checked_at: datetime
    retry_after: datetime | None = None
    detail: str | None = None


class AgentFailureKind(StrEnum):
    PROVIDER_UNAVAILABLE = "provider_unavailable"
    PROVIDER_AUTH = "provider_auth"
    PROVIDER_RATE_LIMIT = "provider_rate_limit"
    PROVIDER_QUOTA = "provider_quota"
    PROVIDER_TIMEOUT = "provider_timeout"
    PROVIDER_TRANSPORT = "provider_transport"
    AGENT_CRASH = "agent_crash"
    INVALID_AGENT_OUTPUT = "invalid_agent_output"
    TASK_FAILURE = "task_failure"
    TEST_FAILURE = "test_failure"
    REPOSITORY_FAILURE = "repository_failure"
    POLICY_FAILURE = "policy_failure"
    INTERNAL_FACTORY_FAILURE = "internal_factory_failure"


@dataclass
class AgentFailure:
    kind: AgentFailureKind
    message: str
    exit_code: int | None = None
    retry_after_seconds: int | None = None


@dataclass
class AgentResult:
    provider: str
    phase: AgentPhase
    success: bool
    started_at: datetime
    finished_at: datetime
    exit_code: int | None
    summary: str | None
    output_path: Path | None
    failure: AgentFailure | None
    transport: str = "unknown"
    model: str | None = None
    attempt: int = 1
    fallback_reason: str | None = None


@dataclass
class AgentRequest:
    phase: AgentPhase
    task: Task
    prompt: str
    cwd: Path
    system_prompt: str = ""
    timeout_seconds: int | None = None
    max_output_bytes: int | None = None
    prepare_attempt: Callable[[], None] | None = None
    validate_output: Callable[[], None] | None = None


class AgentProvider(Protocol):
    name: str

    def health(self) -> ProviderHealth: ...

    def supports(self, phase: AgentPhase) -> bool: ...

    def run(self, request: AgentRequest) -> AgentResult: ...


@runtime_checkable
class HealthCacheInvalidator(Protocol):
    """Optional capability for providers that cache inexpensive health probes."""

    def invalidate_health_cache(self) -> None: ...
