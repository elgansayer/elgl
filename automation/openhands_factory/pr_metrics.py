"""Durable pull-request convergence and capacity metrics."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from datetime import UTC, datetime
from pathlib import Path

from filelock import FileLock

from openhands_factory.pr_convergence import PullRequestCapacity, PullRequestRecord
from openhands_factory.state import atomic_write_json, read_json

SCHEMA_VERSION = 1
_STALE_MERGE_STATES = frozenset({"BEHIND", "DIRTY", "UNSTABLE"})


def _mapping(value: object) -> dict[str, object]:
    if not isinstance(value, dict):
        return {}
    return {key: item for key, item in value.items() if isinstance(key, str)}


def _integer(value: object, default: int = 0) -> int:
    return value if isinstance(value, int) and not isinstance(value, bool) else default


def _text(value: object) -> str | None:
    return value if isinstance(value, str) and value else None


def _timestamp(value: object) -> datetime | None:
    text = _text(value)
    if text is None:
        return None
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is None:
        return None
    return parsed.astimezone(UTC)


def _valid_payload(value: object) -> bool:
    if not isinstance(value, dict):
        return False
    return (
        value.get("schema_version") == SCHEMA_VERSION
        and isinstance(value.get("pull_requests"), list)
        and isinstance(value.get("capacity"), dict)
        and isinstance(value.get("summary"), dict)
    )


def _ratio(numerator: int | float, denominator: int) -> float | None:
    return round(numerator / denominator, 3) if denominator > 0 else None


def _is_replay(record: PullRequestRecord) -> bool:
    value = f"{record.title}\n{record.body}".casefold()
    return "current-main replay" in value or "supersedes" in value


class PullRequestMetricsStore:
    """Persist bounded PR observations and publish the requested ratios."""

    def __init__(self, path: Path, *, max_records: int = 2_000) -> None:
        self.path = path
        self.max_records = max_records
        self.lock = FileLock(str(path) + ".lock")

    @staticmethod
    def _default() -> dict[str, object]:
        return {
            "schema_version": SCHEMA_VERSION,
            "recorded_at": None,
            "pull_requests": [],
            "capacity": {},
            "summary": {},
        }

    def _restore(self) -> dict[str, object]:
        payload = read_json(self.path, self._default(), validator=_valid_payload)
        return _mapping(payload)

    @staticmethod
    def _records(payload: Mapping[str, object]) -> dict[int, dict[str, object]]:
        records: dict[int, dict[str, object]] = {}
        raw_records = payload.get("pull_requests")
        if not isinstance(raw_records, list):
            return records
        for item in raw_records:
            record = _mapping(item)
            number = _integer(record.get("number"), -1)
            if number > 0:
                records[number] = record
        return records

    def observe_inventory(
        self,
        pull_requests: Sequence[PullRequestRecord],
        capacity: PullRequestCapacity,
        *,
        now: datetime | None = None,
    ) -> dict[str, object]:
        observed_at = (now or datetime.now(UTC)).astimezone(UTC)
        with self.lock:
            payload = self._restore()
            records = self._records(payload)
            for pull_request in pull_requests:
                record = records.setdefault(
                    pull_request.number,
                    {
                        "number": pull_request.number,
                        "reviewer_model_invocations": 0,
                        "superseded": False,
                    },
                )
                previous_runs = record.get("workflow_run_ids")
                run_ids = (
                    {item for item in previous_runs if isinstance(item, str)}
                    if isinstance(previous_runs, list)
                    else set()
                )
                run_ids.update(pull_request.workflow_run_ids)
                record.update(
                    {
                        "title": pull_request.title,
                        "task_key": pull_request.task_key,
                        "change_fingerprint": pull_request.change_fingerprint,
                        "lane": pull_request.lane,
                        "component": pull_request.component,
                        "state": pull_request.state,
                        "is_draft": pull_request.is_draft,
                        "stack_parent": pull_request.stack_parent,
                        "workflow_run_ids": sorted(run_ids),
                        "created_at": pull_request.created_at,
                        "last_observed_at": observed_at.isoformat(),
                        "replay": record.get("replay") is True or _is_replay(pull_request),
                        "stale_or_conflicting": (
                            record.get("stale_or_conflicting") is True
                            or pull_request.merge_state_status in _STALE_MERGE_STATES
                        ),
                    }
                )
                if pull_request.checks_passed and _text(record.get("green_at")) is None:
                    merged_at = _timestamp(pull_request.merged_at)
                    green_at = min(observed_at, merged_at) if merged_at is not None else observed_at
                    record["green_at"] = green_at.isoformat()
                if pull_request.is_merged:
                    record["merged_at"] = pull_request.merged_at or observed_at.isoformat()
                if pull_request.closed_at is not None:
                    record["closed_at"] = pull_request.closed_at
            return self._write(records, capacity.to_dict(), observed_at)

    def record_reviewer_invocations(
        self,
        pull_request: int,
        count: int = 1,
        *,
        now: datetime | None = None,
    ) -> None:
        if count <= 0:
            return
        observed_at = (now or datetime.now(UTC)).astimezone(UTC)
        with self.lock:
            payload = self._restore()
            records = self._records(payload)
            record = records.setdefault(pull_request, {"number": pull_request})
            record["reviewer_model_invocations"] = (
                max(0, _integer(record.get("reviewer_model_invocations"))) + count
            )
            record["last_observed_at"] = observed_at.isoformat()
            self._write(records, _mapping(payload.get("capacity")), observed_at)

    def record_supersession(
        self,
        pull_request: int,
        canonical: int | None,
        reason: str,
        *,
        now: datetime | None = None,
    ) -> None:
        observed_at = (now or datetime.now(UTC)).astimezone(UTC)
        with self.lock:
            payload = self._restore()
            records = self._records(payload)
            record = records.setdefault(pull_request, {"number": pull_request})
            record.update(
                {
                    "superseded": True,
                    "superseded_by": canonical,
                    "supersession_reason": reason,
                    "last_observed_at": observed_at.isoformat(),
                }
            )
            self._write(records, _mapping(payload.get("capacity")), observed_at)

    def snapshot(self) -> dict[str, object]:
        with self.lock:
            return self._restore()

    def _write(
        self,
        records: Mapping[int, dict[str, object]],
        capacity: Mapping[str, object],
        observed_at: datetime,
    ) -> dict[str, object]:
        ordered = sorted(
            records.values(),
            key=lambda record: _text(record.get("last_observed_at")) or "",
            reverse=True,
        )
        open_records = [record for record in ordered if record.get("state") == "OPEN"]
        closed_records = [record for record in ordered if record.get("state") != "OPEN"]
        retained = [*open_records, *closed_records[: max(0, self.max_records - len(open_records))]]
        payload: dict[str, object] = {
            "schema_version": SCHEMA_VERSION,
            "recorded_at": observed_at.isoformat(),
            "pull_requests": retained,
            "capacity": dict(capacity),
            "summary": self._summary(retained, capacity),
        }
        atomic_write_json(self.path, payload, validator=_valid_payload)
        return payload

    @staticmethod
    def _summary(
        records: Sequence[Mapping[str, object]],
        capacity: Mapping[str, object],
    ) -> dict[str, object]:
        merged = [record for record in records if _timestamp(record.get("merged_at"))]
        workflow_runs = sum(
            len({item for item in runs if isinstance(item, str)})
            for record in merged
            if isinstance((runs := record.get("workflow_run_ids")), list)
        )
        reviewer_invocations = sum(
            max(0, _integer(record.get("reviewer_model_invocations"))) for record in merged
        )
        superseded = sum(record.get("superseded") is True for record in records)
        replays = sum(record.get("replay") is True for record in records)
        green_waits: list[float] = []
        for record in merged:
            green_at = _timestamp(record.get("green_at"))
            merged_at = _timestamp(record.get("merged_at"))
            if green_at is not None and merged_at is not None and merged_at >= green_at:
                green_waits.append((merged_at - green_at).total_seconds())
        stale = sum(record.get("stale_or_conflicting") is True for record in records)
        return {
            "active_pr_count_by_lane": _mapping(capacity.get("active_by_lane")),
            "merged_pr_count": len(merged),
            "superseded_pr_count": superseded,
            "replay_pr_count": replays,
            "superseded_prs_per_merged_pr": _ratio(superseded, len(merged)),
            "replay_prs_per_merged_pr": _ratio(replays, len(merged)),
            "ci_workflow_runs_per_merged_pr": _ratio(workflow_runs, len(merged)),
            "reviewer_model_invocations_per_merged_pr": _ratio(reviewer_invocations, len(merged)),
            "average_green_wait_seconds": (
                round(sum(green_waits) / len(green_waits), 1) if green_waits else None
            ),
            "stale_conflicting_pr_rate": _ratio(stale, len(records)),
            "duplicate_task_fingerprints": _integer(capacity.get("duplicate_task_fingerprints")),
            "duplicate_change_fingerprints": _integer(
                capacity.get("duplicate_change_fingerprints")
            ),
        }
