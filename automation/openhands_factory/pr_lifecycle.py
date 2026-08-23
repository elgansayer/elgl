"""Durable pull-request lifecycle tracking and one-shot operator notifications."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta
from pathlib import Path
from threading import RLock
from typing import Literal

from filelock import FileLock

from openhands_factory.alerts import AlertService
from openhands_factory.state import atomic_write_json, read_json

PullRequestLifecycleEvent = Literal["reviewed", "merge-queued", "merged"]
MAX_RETAINED_SENT_EVENTS = 2_000
NOTIFICATION_RETRY_SECONDS = 300


class PullRequestLifecycleTracker:
    """Persist reviewed/merge-queued/merged evidence and notify exactly once.

    Delivery is deliberately decoupled from the merge safety decision. A transient
    Telegram failure never blocks a merge; instead the event remains pending and is
    retried on later Factory transitions. Event identity includes the reviewed SHA,
    so a new commit gets a fresh review/merge lifecycle while repeated polling and
    daemon restarts cannot spam the same notification.
    """

    _process_lock = RLock()

    def __init__(
        self,
        state_dir: Path,
        repository: str,
        alerts: AlertService,
        *,
        retry_seconds: int = NOTIFICATION_RETRY_SECONDS,
    ) -> None:
        self.path = state_dir / "pr_lifecycle.json"
        self.repository = repository
        self.alerts = alerts
        self.retry_seconds = max(1, retry_seconds)
        self.file_lock = FileLock(str(self.path) + ".lock")

    @staticmethod
    def _event_key(pull_request: int, head_sha: str, event: PullRequestLifecycleEvent) -> str:
        return f"{pull_request}:{head_sha}:{event}"

    def _load(self) -> dict[str, object]:
        payload = read_json(self.path, {"events": {}})
        if not isinstance(payload, dict):
            return {"events": {}}
        events = payload.get("events")
        if not isinstance(events, dict):
            payload["events"] = {}
        return payload

    def _save(self, payload: dict[str, object]) -> None:
        events = payload.get("events")
        if isinstance(events, dict):
            pending = {
                key: value
                for key, value in events.items()
                if isinstance(value, dict) and value.get("notification_sent_at") is None
            }
            sent = [
                (key, value)
                for key, value in events.items()
                if isinstance(value, dict) and value.get("notification_sent_at") is not None
            ]
            sent.sort(key=lambda item: str(item[1].get("recorded_at") or ""), reverse=True)
            retained = dict(sent[:MAX_RETAINED_SENT_EVENTS])
            retained.update(pending)
            payload["events"] = retained
        atomic_write_json(self.path, payload)

    def record(
        self,
        event: PullRequestLifecycleEvent,
        *,
        pull_request: int,
        head_sha: str,
        title: str,
        detail: str,
    ) -> None:
        """Record an idempotent lifecycle event and attempt its notification."""

        now = datetime.now(UTC)
        key = self._event_key(pull_request, head_sha, event)
        clean_title = " ".join(title.split())[:240]
        state_label = event.replace("-", "_").upper()
        message = (
            f"OpenHands Factory pull request {event}: #{pull_request} {clean_title}\n"
            f"State: {state_label}\n"
            f"Reviewed head SHA: {head_sha}\n"
            f"{detail}\n"
            f"https://github.com/{self.repository}/pull/{pull_request}"
        )
        with self._process_lock, self.file_lock:
            payload = self._load()
            events = payload.get("events")
            if not isinstance(events, dict):
                events = {}
                payload["events"] = events
            if key not in events:
                events[key] = {
                    "pull_request": pull_request,
                    "head_sha": head_sha,
                    "event": event,
                    "title": clean_title,
                    "detail": detail,
                    "message": message,
                    "recorded_at": now.isoformat(),
                    "last_notification_attempt_at": None,
                    "notification_sent_at": None,
                }
                self._save(payload)
            self._deliver_due(payload, keys=(key,), now=now)

    def flush_pending(self, *, limit: int = 3) -> None:
        """Retry a bounded number of due notifications without blocking merge safety."""

        if limit <= 0:
            return
        now = datetime.now(UTC)
        with self._process_lock, self.file_lock:
            payload = self._load()
            events = payload.get("events")
            if not isinstance(events, dict):
                return
            due: list[str] = []
            for key, raw in sorted(
                events.items(),
                key=lambda item: str(item[1].get("recorded_at") if isinstance(item[1], dict) else ""),
            ):
                if not isinstance(raw, dict) or raw.get("notification_sent_at") is not None:
                    continue
                if self._attempt_due(raw, now):
                    due.append(key)
                if len(due) >= limit:
                    break
            if due:
                self._deliver_due(payload, keys=tuple(due), now=now)

    def _attempt_due(self, event: dict[str, object], now: datetime) -> bool:
        value = event.get("last_notification_attempt_at")
        if not isinstance(value, str) or not value:
            return True
        try:
            attempted = datetime.fromisoformat(value)
        except ValueError:
            return True
        if attempted.tzinfo is None:
            attempted = attempted.replace(tzinfo=UTC)
        return now - attempted.astimezone(UTC) >= timedelta(seconds=self.retry_seconds)

    def _deliver_due(
        self,
        payload: dict[str, object],
        *,
        keys: tuple[str, ...],
        now: datetime,
    ) -> None:
        events = payload.get("events")
        if not isinstance(events, dict):
            return
        changed = False
        for key in keys:
            raw = events.get(key)
            if not isinstance(raw, dict) or raw.get("notification_sent_at") is not None:
                continue
            if not self._attempt_due(raw, now):
                continue
            message = raw.get("message")
            event = raw.get("event")
            pull_request = raw.get("pull_request")
            head_sha = raw.get("head_sha")
            if not isinstance(message, str):
                continue
            if not isinstance(event, str):
                continue
            if not isinstance(head_sha, str):
                continue
            if not isinstance(pull_request, int):
                continue
            raw["last_notification_attempt_at"] = now.isoformat()
            changed = True
            sent = self.alerts.send(
                message,
                category=f"factory-pr:{event}:{pull_request}:{head_sha}",
            )
            if sent:
                raw["notification_sent_at"] = datetime.now(UTC).isoformat()
        if changed:
            self._save(payload)

    def snapshot(self) -> list[dict[str, object]]:
        """Return lifecycle events in chronological order for operator diagnostics."""

        with self._process_lock, self.file_lock:
            events = self._load().get("events")
            if not isinstance(events, dict):
                return []
            snapshots = [dict(value) for value in events.values() if isinstance(value, dict)]
        return sorted(snapshots, key=lambda item: str(item.get("recorded_at") or ""))
