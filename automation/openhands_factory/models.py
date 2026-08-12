"""Shared factory domain models."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum


class ProviderName(StrEnum):
    OPENAI_SUBSCRIPTION = "openai-subscription"
    OPENCODE_GO = "opencode-go"
    GEMINI = "gemini-flash"


class FailureKind(StrEnum):
    TRANSIENT = "transient"
    AUTHENTICATION = "authentication"
    CONFIGURATION = "configuration"
    BUDGET = "budget"
    RATE_LIMIT = "rate-limit"
    MALFORMED_RESPONSE = "malformed-response"
    TOOL = "tool"


class CircuitState(StrEnum):
    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half-open"


class JobState(StrEnum):
    DISCOVERED = "discovered"
    LEASED = "leased"
    IMPLEMENTING = "implementing"
    SECURITY_REVIEW = "security-review"
    VERIFYING = "verifying"
    PR_DRAFT = "pr-draft"
    REVIEWING = "reviewing"
    REPAIRING = "repairing"
    QUALITY_REPAIRING = "quality-repairing"
    CI_PENDING = "ci-pending"
    READY_TO_MERGE = "ready-to-merge"
    MERGE_QUEUED = "merge-queued"
    MERGED = "merged"
    DONE = "done"
    QUARANTINED = "quarantined"


@dataclass(frozen=True)
class Task:
    identifier: str
    title: str
    body: str
    source: str
    priority: int


@dataclass
class Job:
    task: Task
    state: JobState = JobState.DISCOVERED
    branch: str | None = None
    pull_request: int | None = None
    head_sha: str | None = None
    attempts: int = 0
    repair_attempts: int = 0
    quality_repairs: int = 0
    last_error: str | None = None
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class ProviderUsage:
    provider: ProviderName
    model: str
    calls: int = 0
    successes: int = 0
    failures: int = 0
    fallbacks: int = 0
    rate_limits: int = 0
    authentication_failures: int = 0
    estimated_cost_usd: float = 0.0
    unknown_cost_calls: int = 0


@dataclass
class Lease:
    task_id: str
    owner: str
    acquired_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime | None = None
