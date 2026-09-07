"""Shared factory domain models."""

from __future__ import annotations

import hashlib
import re
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum

_TASK_KEY_MARKER = re.compile(
    r"(?im)^\s*(?:factory[-_ ]task[-_ ]key|logical[-_ ]task[-_ ]key)\s*:\s*"
    r"([a-z0-9][a-z0-9._:/-]{2,127})\s*$"
)
_ISSUE_PREFIX = re.compile(r"^(?:fix(?:es|ed)?|close[sd]?|resolve[sd]?)\s+#\d+\s*:\s*", re.I)
_TITLE_DECORATION = re.compile(r"\s*(?:\(#\d+\)|#\d+)\s*$")
_TITLE_SPACE = re.compile(r"\s+")
_SUPERSESSION_REFERENCE = re.compile(
    r"(?i)\b(?:supersedes?|superseded\s+by|predecessor(?:\s+pr)?|"
    r"successor(?:\s+pr)?|replaces?|replaced\s+by)\s*:?\s*"
    r"(?:https://github\.com/[^\s/]+/[^\s/]+/(?:issues|pull)/)?#?(\d+)\b"
)


def _normalise_task_title(title: str) -> str:
    """Return the identity-bearing title scope, excluding issue/PR decoration."""

    value = _TITLE_SPACE.sub(" ", title.strip().casefold())
    value = _ISSUE_PREFIX.sub("", value)
    value = _TITLE_DECORATION.sub("", value).strip()
    return value


def logical_task_key(title: str, body: str = "") -> str:
    """Build a stable task identity that is independent of GitHub object numbers.

    An explicit marker is authoritative and lets a task retain its identity across a
    substantial retitle or a successor issue/PR. Without a marker, use a digest of the
    normalized semantic title. The Factory already treats identical normalized titles
    as duplicate issue scope; using the same scope for durable leases extends that
    invariant across issue numbers, retries, providers, branches, and PR review tasks.
    """

    marker = _TASK_KEY_MARKER.search(body)
    if marker:
        value = marker.group(1).casefold()
        if value.startswith(("explicit:", "title:")):
            return value
        return f"explicit:{value}"
    normalized = _normalise_task_title(title)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()[:24]
    return f"title:{digest}"


def changed_path_fingerprint(paths: Iterable[str]) -> str | None:
    """Return a stable identity for a non-empty set of repository-relative paths."""

    normalised = sorted(
        {value for path in paths if (value := path.strip().replace("\\", "/").strip("/"))}
    )
    if not normalised:
        return None
    digest = hashlib.sha256("\0".join(normalised).encode("utf-8")).hexdigest()
    return f"paths:{digest[:24]}"


def supersession_references(text: str) -> frozenset[str]:
    """Extract explicit predecessor or successor object references from prose."""

    return frozenset(_SUPERSESSION_REFERENCE.findall(text))


MAX_PROVIDER_HISTORY = 500


class ProviderName(StrEnum):
    """Providers available inside the OpenHands compatibility adapter."""

    OPENAI_SUBSCRIPTION = "openai-subscription"
    OPENCODE_GO = "opencode-go"
    # Retained only so historical provider-health/attribution state can still be
    # deserialised during migration. The outer AgentRouter never selects this enum.
    GEMINI = "gemini-flash"


class FailureKind(StrEnum):
    TRANSIENT = "transient"
    AUTHENTICATION = "authentication"
    CONFIGURATION = "configuration"
    BUDGET = "budget"
    RATE_LIMIT = "rate-limit"
    MALFORMED_RESPONSE = "malformed-response"
    TOOL = "tool"
    TASK_TIMEOUT = "task-timeout"
    VALIDATION = "validation"


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
    pr_branch: str | None = None
    triage_tags: frozenset[str] = frozenset()

    @property
    def logical_key(self) -> str:
        return logical_task_key(self.title, self.body)


@dataclass
class Job:
    task: Task
    state: JobState = JobState.DISCOVERED
    branch: str | None = None
    pull_request: int | None = None
    head_sha: str | None = None
    canonical_task_id: str | None = None
    producer_identity: str | None = None
    initial_base_sha: str | None = None
    latest_verified_sha: str | None = None
    predecessor_pull_request: int | None = None
    successor_pull_request: int | None = None
    changed_path_fingerprint: str | None = None
    attempts: int = 0
    repair_attempts: int = 0
    quality_repairs: int = 0
    last_error: str | None = None
    next_attempt_at: datetime | None = None
    failure_counts: dict[str, int] = field(default_factory=dict)
    last_failure_kind: str | None = None
    last_failure_fingerprint: str | None = None
    repeated_failure_count: int = 0
    quarantine_reason: str | None = None
    quarantined_at: datetime | None = None
    quarantine_notification_pending: bool = False
    factory_generation: str = "unknown"
    implementation_provider: str | None = None
    review_provider: str | None = None
    security_provider: str | None = None
    last_provider_failure: str | None = None
    provider_failover_count: int = 0
    review_findings: list[str] = field(default_factory=list)
    provider_history: list[dict[str, str | int | float | bool | None]] = field(default_factory=list)
    updated_at: datetime = field(default_factory=lambda: datetime.now(UTC))


@dataclass
class ProviderUsage:
    provider: str
    model: str
    phase: str = "unknown"
    calls: int = 0
    successes: int = 0
    failures: int = 0
    fallbacks: int = 0
    rate_limits: int = 0
    authentication_failures: int = 0
    quota_failures: int = 0
    timeouts: int = 0
    total_duration_seconds: float = 0.0
    capacity_wait_seconds: float = 0.0
    capacity_waited_calls: int = 0
    estimated_cost_usd: float = 0.0
    unknown_cost_calls: int = 0
    prompt_measured_calls: int = 0
    total_request_prompt_chars: int = 0
    max_request_prompt_chars: int = 0
    failure_counts: dict[str, int] = field(default_factory=dict)


@dataclass
class Lease:
    task_id: str
    owner: str | None
    acquired_at: datetime = field(default_factory=lambda: datetime.now(UTC))
    expires_at: datetime | None = None
    factory_generation: str = "unknown"
    task_key: str | None = None
    claimed_at: datetime | None = None
    producer_identity: str | None = None
    canonical_branch: str | None = None
    canonical_pull_request: int | None = None
    initial_base_sha: str | None = None
    latest_verified_sha: str | None = None
    predecessor_pull_request: int | None = None
    successor_pull_request: int | None = None
    failure_fingerprint: str | None = None
    changed_path_fingerprint: str | None = None
    completed_at: datetime | None = None
    predecessor_task_id: str | None = None
