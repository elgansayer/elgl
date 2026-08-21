"""Sanitised GitHub status panel and bounded operator controls."""

from __future__ import annotations

import hashlib
import json
import os
import shutil
import subprocess
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Protocol

from filelock import FileLock

from openhands_factory.agents.base import AgentFailureKind
from openhands_factory.config import FactoryConfig
from openhands_factory.github import GitHubClient, IssueComment
from openhands_factory.state import atomic_write_json, read_json

CONTROL_PANEL_TITLE = "Factory control panel"
CONTROL_PANEL_LABEL = "factory-status"
CONTROL_PANEL_MARKER = "<!-- hellotalk-factory-control-panel -->"
PUBLISH_INTERVAL_SECONDS = 15 * 60
HEARTBEAT_FRESH_SECONDS = 120
GIBIBYTE = 1024**3
MINIMUM_TREND_INTERVAL_SECONDS = 60
MINIMUM_TREND_CHANGE_BYTES = 64 * 1024**2
FAILURE_CLASS_NAMES = frozenset(item.value for item in AgentFailureKind)


class ControlPanelGitHub(Protocol):
    def ensure_factory_labels(self) -> None: ...

    def find_open_issue_by_title(self, title: str, *, required_label: str) -> int | None: ...

    def create_issue(self, title: str, body: str, labels: tuple[str, ...] = ()) -> int: ...

    def update_issue(self, issue: int, *, title: str, body: str) -> None: ...

    def list_issue_comments(self, issue: int, *, after: int = 0) -> list[IssueComment]: ...


@dataclass(frozen=True)
class ControlPanelResult:
    issue: int
    issue_url: str
    status: str
    published: bool
    command: str | None


def _read_mapping(path: Path) -> dict[str, object]:
    try:
        value = read_json(path, {})
    except (OSError, TypeError, ValueError, json.JSONDecodeError):
        return {}
    if not isinstance(value, dict):
        return {}
    return {key: item for key, item in value.items() if isinstance(key, str)}


def _mapping(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return {key: item for key, item in value.items() if isinstance(key, str)}


def _integer(value: object, default: int = 0) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else default


def _text(value: object, default: str = "unknown") -> str:
    return value if isinstance(value, str) and value else default


def _timestamp(value: object) -> datetime | None:
    if not isinstance(value, str):
        return None
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC)


def systemd_unit_state(unit: str) -> str:
    try:
        result = subprocess.run(
            ("systemctl", "show", unit, "--property=ActiveState", "--value", "--no-pager"),
            check=False,
            capture_output=True,
            text=True,
            timeout=10,
            env={
                "LANG": "C.UTF-8",
                "PATH": "/usr/local/bin:/usr/bin:/bin",
            },
        )
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return "unavailable"
    state = result.stdout.strip().casefold()
    if result.returncode != 0 or not state:
        return "unavailable"
    return state


def _queue_snapshot(daemon: Mapping[str, object]) -> dict[str, object]:
    queue = _mapping(daemon.get("queue"))
    by_state = _mapping(queue.get("by_state"))
    return {
        "total": _integer(queue.get("total_jobs")),
        "active": _integer(queue.get("active_count")),
        "runnable": _integer(queue.get("runnable_count")),
        "backing_off": _integer(queue.get("backing_off_count")),
        "quarantined": _integer(queue.get("quarantined_count")),
        "by_state": {
            state: count
            for state, value in sorted(by_state.items())
            if (count := _integer(value, -1)) >= 0
        },
    }


def _provider_snapshot(
    config: FactoryConfig,
    daemon: Mapping[str, object],
) -> list[dict[str, object]]:
    observed: dict[str, dict[str, object]] = {}
    providers = daemon.get("providers")
    if isinstance(providers, list):
        for item in providers:
            provider = _mapping(item)
            name = provider.get("name")
            if isinstance(name, str):
                observed[name] = provider

    persisted = _read_mapping(config.state_dir / "agent_health.json")
    breakers = persisted.get("breakers")
    persisted_by_name: dict[str, dict[str, object]] = {}
    if isinstance(breakers, list):
        for item in breakers:
            breaker = _mapping(item)
            name = breaker.get("provider")
            if isinstance(name, str):
                persisted_by_name[name] = breaker

    snapshot: list[dict[str, object]] = []
    for name, provider_config in sorted(config.agents.providers.items()):
        status = "disabled" if not provider_config.enabled else "unknown"
        retry_after: str | None = None
        checked_at: str | None = None
        current = observed.get(name)
        if current is not None:
            status = _text(current.get("status"))
            retry_value = current.get("retry_after")
            retry_after = retry_value if isinstance(retry_value, str) else None
            checked_value = current.get("checked_at")
            checked_at = checked_value if isinstance(checked_value, str) else None
        elif provider_config.enabled:
            breaker = persisted_by_name.get(name, {})
            if breaker.get("state") == "open":
                failure = _text(breaker.get("last_failure_kind"))
                status = {
                    "provider_auth": "auth_required",
                    "provider_quota": "quota_exhausted",
                    "provider_rate_limit": "rate_limited",
                }.get(failure, "unavailable")
                opened_at = _timestamp(breaker.get("opened_at"))
                if opened_at is not None:
                    cooldown = min(
                        max(
                            _integer(breaker.get("cooldown_seconds")),
                            _integer(breaker.get("retry_after_seconds")),
                        ),
                        7 * 24 * 3600,
                    )
                    retry_after = (opened_at + timedelta(seconds=cooldown)).isoformat()
        snapshot.append(
            {
                "name": name,
                "status": status,
                "transport": provider_config.transport,
                "model": provider_config.model or "provider default",
                "max_concurrency": provider_config.max_concurrency,
                "checked_at": checked_at,
                "retry_after": retry_after,
            }
        )
    return snapshot


def _metrics_snapshot(config: FactoryConfig) -> list[dict[str, object]]:
    payload = _read_mapping(config.state_dir / "metrics.json")
    records = payload.get("providers")
    numeric_keys = (
        "calls",
        "successes",
        "failures",
        "fallbacks",
        "rate_limits",
        "authentication_failures",
        "quota_failures",
        "timeouts",
    )
    totals: dict[str, dict[str, object]] = {}
    if isinstance(records, list):
        for item in records:
            record = _mapping(item)
            provider = record.get("provider")
            if not isinstance(provider, str) or provider not in config.agents.providers:
                continue
            current = totals.setdefault(
                provider,
                {
                    "calls": 0,
                    "successes": 0,
                    "failures": 0,
                    "fallbacks": 0,
                    "rate_limits": 0,
                    "authentication_failures": 0,
                    "quota_failures": 0,
                    "timeouts": 0,
                    "failure_counts": {},
                },
            )
            for key in numeric_keys:
                current[key] = _integer(current.get(key)) + max(_integer(record.get(key)), 0)
            current_failures = _mapping(current.get("failure_counts"))
            for kind, count in _mapping(record.get("failure_counts")).items():
                if kind not in FAILURE_CLASS_NAMES:
                    continue
                current_failures[kind] = _integer(current_failures.get(kind)) + max(
                    _integer(count), 0
                )
            current["failure_counts"] = current_failures
    return [{"provider": provider, **values} for provider, values in sorted(totals.items())]


def _failure_class_summary(metric: Mapping[str, object]) -> str:
    counts = [
        (kind, count)
        for kind, value in _mapping(metric.get("failure_counts")).items()
        if kind in FAILURE_CLASS_NAMES and (count := _integer(value)) > 0
    ]
    ordered = sorted(counts, key=lambda item: (-item[1], item[0]))
    if not ordered:
        return "none"
    visible = ordered[:4]
    summary = ", ".join(f"{kind}={count}" for kind, count in visible)
    hidden_total = sum(count for _, count in ordered[4:])
    return f"{summary}, other={hidden_total}" if hidden_total else summary


def _storage_snapshot(
    config: FactoryConfig,
    current: datetime,
    previous_samples: object,
    disk_usage_reader: Callable[[Path], tuple[int, int, int]],
) -> list[dict[str, object]]:
    previous_by_name: dict[str, dict[str, object]] = {}
    if isinstance(previous_samples, list):
        for item in previous_samples:
            sample = _mapping(item)
            name = sample.get("name")
            if isinstance(name, str):
                previous_by_name[name] = sample

    reserve_bytes = int(config.minimum_free_disk_gib * GIBIBYTE)
    samples: list[dict[str, object]] = []
    for name, path in (("root", Path("/")), ("factory_state", config.state_dir)):
        try:
            total_bytes, used_bytes, free_bytes = disk_usage_reader(path)
        except OSError:
            samples.append(
                {
                    "name": name,
                    "status": "unavailable",
                    "sampled_at": current.isoformat(),
                    "reserve_bytes": reserve_bytes,
                }
            )
            continue

        if free_bytes < reserve_bytes:
            status = "critical"
        elif free_bytes < reserve_bytes * 2:
            status = "warning"
        else:
            status = "healthy"

        projected_exhaustion_at: str | None = None
        growth_bytes_per_hour: int | None = None
        previous = previous_by_name.get(name, {})
        previous_free = _integer(previous.get("free_bytes"), -1)
        previous_at = _timestamp(previous.get("sampled_at"))
        if previous_free >= 0 and previous_at is not None:
            elapsed_seconds = (current - previous_at).total_seconds()
            consumed_bytes = previous_free - free_bytes
            if (
                elapsed_seconds >= MINIMUM_TREND_INTERVAL_SECONDS
                and consumed_bytes >= MINIMUM_TREND_CHANGE_BYTES
            ):
                bytes_per_second = consumed_bytes / elapsed_seconds
                growth_bytes_per_hour = round(bytes_per_second * 3600)
                projected_exhaustion_at = (
                    current + timedelta(seconds=free_bytes / bytes_per_second)
                ).isoformat()

        samples.append(
            {
                "name": name,
                "status": status,
                "sampled_at": current.isoformat(),
                "total_bytes": total_bytes,
                "used_bytes": used_bytes,
                "free_bytes": free_bytes,
                "used_percent": round((used_bytes / total_bytes) * 100, 1)
                if total_bytes > 0
                else 0.0,
                "reserve_bytes": reserve_bytes,
                "growth_bytes_per_hour": growth_bytes_per_hour,
                "projected_exhaustion_at": projected_exhaustion_at,
            }
        )
    return samples


def build_status_snapshot(
    config: FactoryConfig,
    *,
    now: datetime | None = None,
    unit_states: Mapping[str, str] | None = None,
    previous_storage_samples: object = None,
    disk_usage_reader: Callable[[Path], tuple[int, int, int]] = shutil.disk_usage,
) -> dict[str, object]:
    current = (now or datetime.now(UTC)).astimezone(UTC)
    daemon = _read_mapping(config.state_dir / "daemon.json")
    control = _read_mapping(config.state_dir / "control.json")
    updated_at = _timestamp(daemon.get("updated_at"))
    heartbeat_age = int((current - updated_at).total_seconds()) if updated_at is not None else None
    heartbeat_fresh = (
        heartbeat_age is not None
        and -HEARTBEAT_FRESH_SECONDS <= heartbeat_age <= HEARTBEAT_FRESH_SECONDS
    )
    service = (
        unit_states.get("hellotalk-factory.service", "unavailable")
        if unit_states is not None
        else systemd_unit_state("hellotalk-factory.service")
    )
    timer = (
        unit_states.get("hellotalk-factory-health.timer", "unavailable")
        if unit_states is not None
        else systemd_unit_state("hellotalk-factory-health.timer")
    )
    paused = control.get("paused") is True or daemon.get("paused") is True
    daemon_status = _text(daemon.get("status"))
    provider_snapshot = _provider_snapshot(config, daemon)
    provider_usable = any(
        provider.get("status") in {"healthy", "degraded"} for provider in provider_snapshot
    )
    storage = _storage_snapshot(
        config,
        current,
        previous_storage_samples,
        disk_usage_reader,
    )
    if service in {"failed", "inactive", "deactivating"}:
        overall = "offline"
    elif service == "active" and daemon_status == "running" and heartbeat_fresh:
        if timer != "active":
            overall = "degraded"
        elif paused:
            overall = "paused"
        else:
            overall = "healthy" if provider_usable else "degraded"
    else:
        overall = "degraded"
    if overall in {"healthy", "paused"} and any(
        sample.get("status") in {"critical", "warning", "unavailable"} for sample in storage
    ):
        overall = "degraded"

    active_jobs = daemon.get("active_jobs")
    active_task_ids = (
        [item for item in active_jobs if isinstance(item, str) and item.isdigit()][:10]
        if isinstance(active_jobs, list)
        else []
    )
    return {
        "status": overall,
        "generated_at": current.isoformat(),
        "daemon_status": daemon_status,
        "daemon_updated_at": updated_at.isoformat() if updated_at is not None else None,
        "heartbeat_age_seconds": heartbeat_age,
        "heartbeat_fresh": heartbeat_fresh,
        "paused": paused,
        "generation": _text(daemon.get("generation")),
        "runtime_version": _text(daemon.get("runtime_version")),
        "components": {
            "hellotalk-factory.service": service,
            "hellotalk-factory-health.timer": timer,
        },
        "active_tasks": active_task_ids,
        "queue": _queue_snapshot(daemon),
        "providers": provider_snapshot,
        "metrics": _metrics_snapshot(config),
        "storage": storage,
    }


def _markdown_cell(value: str) -> str:
    return value.replace("\n", " ").replace("\r", " ").replace("|", "\\|")


def _markdown_table(headers: tuple[str, ...], rows: list[tuple[str, ...]]) -> list[str]:
    lines = [f"| {' | '.join(headers)} |", f"| {' | '.join('---' for _ in headers)} |"]
    lines.extend(f"| {' | '.join(_markdown_cell(value) for value in row)} |" for row in rows)
    return lines


def render_status_markdown(
    snapshot: Mapping[str, object],
    repository: str,
    *,
    last_command: Mapping[str, object] | None = None,
) -> str:
    status = _text(snapshot.get("status"))
    icon = {"healthy": "🟢", "paused": "🟡", "degraded": "🟠", "offline": "🔴"}.get(status, "⚪")
    components = _mapping(snapshot.get("components"))
    queue = _mapping(snapshot.get("queue"))
    by_state = _mapping(queue.get("by_state"))
    providers = snapshot.get("providers")
    metrics = snapshot.get("metrics")
    storage = snapshot.get("storage")
    active_tasks = snapshot.get("active_tasks")
    active_links = []
    if isinstance(active_tasks, list):
        active_links = [
            f"[#{task}](https://github.com/{repository}/issues/{task})"
            for task in active_tasks
            if isinstance(task, str)
        ]

    lines = [
        CONTROL_PANEL_MARKER,
        "# Factory control panel",
        "",
        f"## {icon} {status.replace('_', ' ').title()}",
        "",
        "This issue is maintained by the Factory watchdog. If its update time becomes "
        "stale, treat the control plane as unavailable.",
        "",
        f"- Last panel update: `{_text(snapshot.get('generated_at'))}`",
        f"- Daemon heartbeat: `{_text(snapshot.get('daemon_updated_at'))}`",
        f"- Heartbeat age: `{snapshot.get('heartbeat_age_seconds')}` seconds",
        f"- Generation: `{_text(snapshot.get('generation'))}`",
        f"- Runtime: `{_text(snapshot.get('runtime_version'))}`",
        f"- Active tasks: {', '.join(active_links) if active_links else 'none'}",
        "",
        "### Components",
        "",
        *_markdown_table(
            ("Component", "State"),
            [(name, _text(value)) for name, value in sorted(components.items())],
        ),
        "",
        "### Storage",
        "",
        *_markdown_table(
            ("Volume", "State", "Used", "Free GiB", "Reserve GiB", "Projected exhaustion"),
            [
                (
                    _text(sample.get("name")).replace("_", " "),
                    _text(sample.get("status")),
                    f"{sample.get('used_percent', 'unknown')}%",
                    f"{_integer(sample.get('free_bytes')) / GIBIBYTE:.1f}",
                    f"{_integer(sample.get('reserve_bytes')) / GIBIBYTE:.1f}",
                    _text(sample.get("projected_exhaustion_at"), "not projected"),
                )
                for item in storage
                if (sample := _mapping(item))
            ]
            if isinstance(storage, list)
            else [("none", "unavailable", "unknown", "0.0", "0.0", "not projected")],
        ),
        "",
        "### Queue",
        "",
        *_markdown_table(
            ("Total", "Active", "Runnable", "Backoff", "Quarantined"),
            [
                tuple(
                    str(_integer(queue.get(key)))
                    for key in ("total", "active", "runnable", "backing_off", "quarantined")
                )
            ],
        ),
    ]
    if by_state:
        lines.extend(
            [
                "",
                "Queue states: "
                + ", ".join(f"`{name}={_integer(value)}`" for name, value in by_state.items()),
            ]
        )

    provider_rows: list[tuple[str, ...]] = []
    if isinstance(providers, list):
        for item in providers:
            provider = _mapping(item)
            provider_rows.append(
                (
                    _text(provider.get("name")),
                    _text(provider.get("status")),
                    _text(provider.get("transport")),
                    _text(provider.get("model")),
                    str(_integer(provider.get("max_concurrency"))),
                    _text(provider.get("retry_after"), "none"),
                )
            )
    lines.extend(
        [
            "",
            "### Providers",
            "",
            *_markdown_table(
                ("Provider", "Status", "Transport", "Model", "Limit", "Retry after"),
                provider_rows or [("none", "unknown", "none", "none", "0", "none")],
            ),
        ]
    )

    metric_rows: list[tuple[str, ...]] = []
    if isinstance(metrics, list):
        for item in metrics:
            metric = _mapping(item)
            metric_rows.append(
                tuple(
                    [_text(metric.get("provider"))]
                    + [
                        str(_integer(metric.get(key)))
                        for key in (
                            "calls",
                            "successes",
                            "failures",
                            "fallbacks",
                            "rate_limits",
                            "authentication_failures",
                            "quota_failures",
                            "timeouts",
                        )
                    ]
                    + [_failure_class_summary(metric)]
                )
            )
    lines.extend(
        [
            "",
            "### Provider outcomes",
            "",
            *_markdown_table(
                (
                    "Provider",
                    "Calls",
                    "Success",
                    "Failure",
                    "Fallback",
                    "Rate limit",
                    "Auth",
                    "Quota",
                    "Timeout",
                    "Failure classes",
                ),
                metric_rows or [("none", "0", "0", "0", "0", "0", "0", "0", "0", "none")],
            ),
            "",
            "### Controls",
            "",
            "Only configured trusted GitHub actors are accepted. Post one exact comment:",
            "",
            "```text",
            "/factory status",
            "/factory pause",
            "/factory resume",
            "/factory restart",
            "```",
            "",
            "Commands are parsed as a fixed enum. Comment text is never passed to a shell. "
            "Restart is consumed by the root watchdog after ownership and freshness validation.",
        ]
    )
    command = _mapping(last_command)
    if command:
        lines.extend(
            [
                "",
                "### Last accepted command",
                "",
                f"`{_text(command.get('action'))}` by `{_text(command.get('actor'))}` "
                f"at `{_text(command.get('accepted_at'))}`",
            ]
        )
    lines.extend(
        [
            "",
            "Normal fallback details remain in Factory state and logs to avoid GitHub "
            "notification noise.",
            "",
        ]
    )
    return "\n".join(lines)


def _status_fingerprint(snapshot: Mapping[str, object], last_command: Mapping[str, object]) -> str:
    stable = {
        key: value
        for key, value in snapshot.items()
        if key not in {"generated_at", "daemon_updated_at", "heartbeat_age_seconds"}
    }
    providers = stable.get("providers")
    if isinstance(providers, list):
        stable["providers"] = [
            {key: value for key, value in _mapping(item).items() if key != "checked_at"}
            for item in providers
        ]
    storage = stable.get("storage")
    if isinstance(storage, list):
        stable["storage"] = [
            {
                "name": sample.get("name"),
                "status": sample.get("status"),
            }
            for item in storage
            if (sample := _mapping(item))
        ]
    stable["last_command"] = dict(last_command)
    encoded = json.dumps(stable, sort_keys=True, separators=(",", ":"), default=str)
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


class FactoryControlPanel:
    def __init__(
        self,
        config: FactoryConfig,
        github: ControlPanelGitHub | None = None,
        *,
        clock: Callable[[], datetime] | None = None,
        unit_state_reader: Callable[[str], str] = systemd_unit_state,
        disk_usage_reader: Callable[[Path], tuple[int, int, int]] = shutil.disk_usage,
    ) -> None:
        self.config = config
        self.github = github or GitHubClient(
            config.github_repository,
            config.repository,
            config.github_token.get_secret_value(),
            base_branch=config.base_branch,
        )
        self.clock = clock or (lambda: datetime.now(UTC))
        self.unit_state_reader = unit_state_reader
        self.disk_usage_reader = disk_usage_reader
        self.state_path = config.state_dir / "control_panel.json"
        self.lock = FileLock(str(self.state_path) + ".lock")

    def _snapshot(
        self,
        now: datetime,
        previous_storage_samples: object = None,
    ) -> dict[str, object]:
        return build_status_snapshot(
            self.config,
            now=now,
            unit_states={
                "hellotalk-factory.service": self.unit_state_reader("hellotalk-factory.service"),
                "hellotalk-factory-health.timer": self.unit_state_reader(
                    "hellotalk-factory-health.timer"
                ),
            },
            previous_storage_samples=previous_storage_samples,
            disk_usage_reader=self.disk_usage_reader,
        )

    def _apply_command(self, comment: IssueComment, action: str, now: datetime) -> None:
        if action in {"pause", "resume"}:
            atomic_write_json(
                self.config.state_dir / "control.json",
                {"paused": action == "pause"},
            )
        elif action == "restart":
            atomic_write_json(
                self.config.state_dir / "control_request.json",
                {
                    "action": "restart",
                    "request_id": comment.identifier,
                    "requested_at": now.isoformat(),
                    "requested_by": comment.author,
                },
            )

    @staticmethod
    def _command(body: str) -> str | None:
        return {
            "/factory status": "status",
            "/factory pause": "pause",
            "/factory resume": "resume",
            "/factory restart": "restart",
        }.get(body.strip().casefold())

    @staticmethod
    def _publish_due(state: Mapping[str, object], now: datetime) -> bool:
        last_published = _timestamp(state.get("last_published_at"))
        if last_published is None:
            return True
        elapsed = (now - last_published).total_seconds()
        return elapsed < -HEARTBEAT_FRESH_SECONDS or elapsed >= PUBLISH_INTERVAL_SECONDS

    @staticmethod
    def _command_is_fresh(comment: IssueComment, now: datetime) -> bool:
        created_at = _timestamp(comment.created_at)
        if created_at is None:
            return False
        age = (now - created_at).total_seconds()
        return -HEARTBEAT_FRESH_SECONDS <= age <= 600

    def sync(self, *, force: bool = False) -> ControlPanelResult:
        with self.lock:
            now = self.clock().astimezone(UTC)
            state = _read_mapping(self.state_path)
            last_comment_id = _integer(state.get("last_comment_id"))
            last_command = _mapping(state.get("last_command"))
            previous_storage_samples = state.get("storage_samples")
            snapshot = self._snapshot(now, previous_storage_samples)
            body = render_status_markdown(
                snapshot,
                self.config.github_repository,
                last_command=last_command,
            )
            issue = self.github.find_open_issue_by_title(
                CONTROL_PANEL_TITLE,
                required_label=CONTROL_PANEL_LABEL,
            )
            created = issue is None
            if issue is None:
                self.github.ensure_factory_labels()
                issue = self.github.create_issue(
                    CONTROL_PANEL_TITLE,
                    body,
                    (CONTROL_PANEL_LABEL, "factory-skip"),
                )

            accepted_command: str | None = None
            for comment in self.github.list_issue_comments(issue, after=last_comment_id):
                last_comment_id = max(last_comment_id, comment.identifier)
                action = self._command(comment.body)
                if (
                    action is None
                    or comment.author.casefold() not in self.config.control_github_actors
                    or not self._command_is_fresh(comment, now)
                ):
                    continue
                command_record: dict[str, object] = {
                    "action": action,
                    "actor": comment.author,
                    "accepted_at": now.isoformat(),
                    "comment_id": comment.identifier,
                }
                if action == "restart":
                    # Persist the cursor before creating the restart request. If
                    # this process is killed in between, the operator can submit
                    # a new command, but one comment can never trigger two host
                    # restarts after the request has already been consumed.
                    state["issue"] = issue
                    state["last_comment_id"] = last_comment_id
                    state["last_command"] = command_record
                    atomic_write_json(self.state_path, state)
                self._apply_command(comment, action, now)
                accepted_command = action
                last_command = command_record
                force = True

            # Persist the command cursor before any remote panel update. Pause and
            # resume are idempotent, while restart must never replay merely because
            # GitHub became unavailable after the local request was accepted.
            state["issue"] = issue
            state["last_comment_id"] = last_comment_id
            state["last_command"] = last_command
            state["storage_samples"] = snapshot.get("storage", [])
            atomic_write_json(self.state_path, state)

            if accepted_command is not None:
                snapshot = self._snapshot(now, previous_storage_samples)
                body = render_status_markdown(
                    snapshot,
                    self.config.github_repository,
                    last_command=last_command,
                )
            fingerprint = _status_fingerprint(snapshot, last_command)
            published = created
            if not created and (
                force
                or fingerprint != state.get("last_fingerprint")
                or self._publish_due(state, now)
            ):
                self.github.update_issue(issue, title=CONTROL_PANEL_TITLE, body=body)
                published = True

            if published:
                state["last_published_at"] = now.isoformat()
                state["last_fingerprint"] = fingerprint
            atomic_write_json(self.state_path, state)
            status = _text(snapshot.get("status"))
            return ControlPanelResult(
                issue=issue,
                issue_url=f"https://github.com/{self.config.github_repository}/issues/{issue}",
                status=status,
                published=published,
                command=accepted_command,
            )


def restart_request_is_safe(path: Path, *, expected_uid: int, now: datetime) -> bool:
    """Validate and consume a root-watchdog restart request without executing input."""

    try:
        metadata = path.lstat()
    except FileNotFoundError:
        return False
    if not path.is_file() or path.is_symlink() or metadata.st_uid != expected_uid:
        return False
    if metadata.st_mode & 0o022:
        return False
    payload = _read_mapping(path)
    requested_at = _timestamp(payload.get("requested_at"))
    valid = (
        payload.get("action") == "restart"
        and isinstance(payload.get("request_id"), int)
        and not isinstance(payload.get("request_id"), bool)
        and isinstance(payload.get("requested_by"), str)
        and bool(payload.get("requested_by"))
        and requested_at is not None
        and -120 <= (now.astimezone(UTC) - requested_at).total_seconds() <= 600
    )
    if valid:
        os.unlink(path)
    return valid
