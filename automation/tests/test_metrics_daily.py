from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.metrics import DAILY_RETENTION_DAYS, MetricsStore


def test_record_adds_a_per_day_bucket_beside_cumulative_totals(tmp_path: Path) -> None:
    metrics = MetricsStore(tmp_path / "metrics.json")

    metrics.record("claude", "sonnet", phase="code-review", successful=True, duration_seconds=10)
    metrics.record(
        "codex",
        "gpt",
        phase="quality-repair",
        successful=False,
        failure_kind="provider_transport",
        duration_seconds=4,
    )

    cumulative = json.loads((tmp_path / "metrics.json").read_text())
    assert sum(item["calls"] for item in cumulative["providers"]) == 2

    days = metrics.daily()["days"]
    assert isinstance(days, dict)
    today = datetime.now(UTC).date().isoformat()
    bucket = days[today]
    assert bucket["claude:sonnet:code-review"]["successes"] == 1
    failed = bucket["codex:gpt:quality-repair"]
    assert failed["failures"] == 1
    assert failed["failure_counts"] == {"provider_transport": 1}
    assert failed["duration_seconds"] == 4


def test_daily_buckets_expire_after_retention(tmp_path: Path) -> None:
    metrics = MetricsStore(tmp_path / "metrics.json")
    now = datetime(2026, 10, 23, 12, tzinfo=UTC)
    expired = (now - timedelta(days=DAILY_RETENTION_DAYS)).date().isoformat()
    kept = (now - timedelta(days=DAILY_RETENTION_DAYS - 1)).date().isoformat()
    metrics.daily_path.write_text(
        json.dumps(
            {
                "days": {
                    expired: {"a:b:c": {"calls": 9}},
                    kept: {"a:b:c": {"calls": 3}},
                    "not-a-date": {"a:b:c": {"calls": 1}},
                }
            }
        )
    )

    metrics._record_daily(
        "a:b:c",
        successful=True,
        fallback=False,
        timed_out=False,
        duration_seconds=1,
        failure_kind=None,
        now=now,
    )

    days = metrics.daily()["days"]
    assert isinstance(days, dict)
    assert set(days) == {kept, now.date().isoformat()}
    assert days[now.date().isoformat()]["a:b:c"]["calls"] == 1


def test_corrupt_daily_file_does_not_block_recording(tmp_path: Path) -> None:
    metrics = MetricsStore(tmp_path / "metrics.json")
    metrics.daily_path.write_text("not json")

    metrics.record("claude", "haiku", phase="ci-repair", successful=True)

    days = metrics.daily()["days"]
    assert isinstance(days, dict)
    assert len(days) == 1
