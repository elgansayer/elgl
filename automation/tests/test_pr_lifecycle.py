from pathlib import Path

from openhands_factory.pr_lifecycle import PullRequestLifecycleTracker


class Alerts:
    def __init__(self, outcomes: list[bool] | None = None) -> None:
        self.outcomes = list(outcomes or [True])
        self.calls: list[tuple[str, str | None]] = []

    def send(self, message: str, *, category: str | None = None) -> bool:
        self.calls.append((message, category))
        return self.outcomes.pop(0) if self.outcomes else True


def test_lifecycle_notification_is_one_shot_across_restart(tmp_path: Path) -> None:
    alerts = Alerts([True])
    tracker = PullRequestLifecycleTracker(
        tmp_path,
        "owner/repo",
        alerts,  # type: ignore[arg-type]
        retry_seconds=1,
    )

    for _ in range(2):
        tracker.record(
            "reviewed",
            pull_request=77,
            head_sha="abc123",
            title="Fix merge gate",
            detail="Independent review accepted this head.",
        )

    restarted = PullRequestLifecycleTracker(
        tmp_path,
        "owner/repo",
        alerts,  # type: ignore[arg-type]
        retry_seconds=1,
    )
    restarted.record(
        "reviewed",
        pull_request=77,
        head_sha="abc123",
        title="Fix merge gate",
        detail="Independent review accepted this head.",
    )

    assert len(alerts.calls) == 1
    snapshot = restarted.snapshot()
    assert len(snapshot) == 1
    assert snapshot[0]["event"] == "reviewed"
    assert snapshot[0]["notification_sent_at"] is not None


def test_new_reviewed_sha_gets_a_new_notification(tmp_path: Path) -> None:
    alerts = Alerts([True, True])
    tracker = PullRequestLifecycleTracker(tmp_path, "owner/repo", alerts)  # type: ignore[arg-type]

    for sha in ("old-head", "new-head"):
        tracker.record(
            "reviewed",
            pull_request=77,
            head_sha=sha,
            title="Fix merge gate",
            detail="Independent review accepted this head.",
        )

    assert len(alerts.calls) == 2
    assert {item["head_sha"] for item in tracker.snapshot()} == {"old-head", "new-head"}


def test_failed_notification_remains_pending_for_retry(tmp_path: Path) -> None:
    alerts = Alerts([False, True])
    tracker = PullRequestLifecycleTracker(
        tmp_path,
        "owner/repo",
        alerts,  # type: ignore[arg-type]
        retry_seconds=1,
    )
    tracker.record(
        "merge-queued",
        pull_request=77,
        head_sha="abc123",
        title="Fix merge gate",
        detail="Checks passed.",
    )

    first = tracker.snapshot()[0]
    assert first["notification_sent_at"] is None
    assert first["last_notification_attempt_at"] is not None

    # Force the retry due without sleeping in the test.
    first["last_notification_attempt_at"] = "2000-01-01T00:00:00+00:00"
    from openhands_factory.state import atomic_write_json

    key = "77:abc123:merge-queued"
    atomic_write_json(tracker.path, {"events": {key: first}})
    tracker.flush_pending()

    assert len(alerts.calls) == 2
    assert tracker.snapshot()[0]["notification_sent_at"] is not None
