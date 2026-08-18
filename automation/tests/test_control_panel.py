import os
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.control_panel import (
    CONTROL_PANEL_LABEL,
    CONTROL_PANEL_MARKER,
    CONTROL_PANEL_TITLE,
    FactoryControlPanel,
    build_status_snapshot,
    render_status_markdown,
    restart_request_is_safe,
)
from openhands_factory.github import IssueComment
from openhands_factory.state import atomic_write_json, read_json


def config(tmp_path: Path) -> FactoryConfig:
    return FactoryConfig.from_environment(
        {
            "GITHUB_TOKEN": "not-a-real-token",
            "GITHUB_REPOSITORY": "owner/repo",
            "FACTORY_REPOSITORY": str(tmp_path / "repository"),
            "FACTORY_STATE_DIR": str(tmp_path / "state"),
            "FACTORY_MINIMUM_FREE_DISK_GIB": "1",
            "FACTORY_TRUSTED_GITHUB_ACTORS": "repoowner",
            "FACTORY_CONTROL_GITHUB_ACTORS": "repoowner",
        }
    )


class FakeGitHub:
    def __init__(
        self,
        *,
        issue: int | None = 42,
        comments: list[IssueComment] | None = None,
    ) -> None:
        self.issue = issue
        self.comments = comments or []
        self.labels_ensured = False
        self.created: list[tuple[str, str, tuple[str, ...]]] = []
        self.updated: list[tuple[int, str, str]] = []

    def ensure_factory_labels(self) -> None:
        self.labels_ensured = True

    def find_open_issue_by_title(self, title: str, *, required_label: str) -> int | None:
        assert title == CONTROL_PANEL_TITLE
        assert required_label == CONTROL_PANEL_LABEL
        return self.issue

    def create_issue(
        self,
        title: str,
        body: str,
        labels: tuple[str, ...] = (),
    ) -> int:
        self.created.append((title, body, labels))
        self.issue = 77
        return 77

    def update_issue(self, issue: int, *, title: str, body: str) -> None:
        self.updated.append((issue, title, body))

    def list_issue_comments(self, issue: int, *, after: int = 0) -> list[IssueComment]:
        assert issue == self.issue
        return [comment for comment in self.comments if comment.identifier > after]


def write_running_state(factory_config: FactoryConfig, now: datetime) -> None:
    atomic_write_json(
        factory_config.state_dir / "daemon.json",
        {
            "status": "running",
            "updated_at": (now - timedelta(seconds=30)).isoformat(),
            "generation": "generation-1",
            "runtime_version": "agent-canvas-v1",
            "active_jobs": ["1842", "1](https://attacker.invalid)"],
            "queue": {
                "total_jobs": 8,
                "active_count": 1,
                "runnable_count": 3,
                "backing_off_count": 2,
                "quarantined_count": 1,
                "by_state": {"implementing": 1, "discovered": 6, "quarantined": 1},
            },
            "providers": [
                {
                    "name": "openhands",
                    "status": "healthy",
                    "checked_at": now.isoformat(),
                    "retry_after": None,
                }
            ],
        },
    )
    atomic_write_json(factory_config.state_dir / "control.json", {"paused": False})
    atomic_write_json(
        factory_config.state_dir / "metrics.json",
        {
            "providers": [
                {
                    "provider": "openhands",
                    "model": "gpt-test",
                    "phase": "implementation",
                    "calls": 4,
                    "successes": 3,
                    "failures": 1,
                    "fallbacks": 1,
                    "rate_limits": 0,
                    "authentication_failures": 2,
                    "quota_failures": 3,
                    "timeouts": 1,
                    "failure_counts": {
                        "test_failure": 1,
                        "untrusted|value": 999,
                    },
                }
            ]
        },
    )


def test_status_snapshot_and_markdown_are_sanitised(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)

    snapshot = build_status_snapshot(
        factory_config,
        now=now,
        unit_states={
            "hellotalk-factory.service": "active",
            "hellotalk-factory-health.timer": "active",
        },
    )
    markdown = render_status_markdown(snapshot, factory_config.github_repository)

    assert snapshot["status"] == "healthy"
    assert snapshot["heartbeat_age_seconds"] == 30
    assert snapshot["queue"] == {
        "total": 8,
        "active": 1,
        "runnable": 3,
        "backing_off": 2,
        "quarantined": 1,
        "by_state": {"discovered": 6, "implementing": 1, "quarantined": 1},
    }
    assert CONTROL_PANEL_MARKER in markdown
    assert "[#1842](https://github.com/owner/repo/issues/1842)" in markdown
    assert "attacker.invalid" not in markdown
    assert "not-a-real-token" not in markdown
    assert "test_failure=1" in markdown
    assert "| openhands | 4 | 3 | 1 | 1 | 0 | 2 | 3 | 1 | test_failure=1 |" in markdown
    assert "untrusted" not in markdown
    assert "/factory restart" in markdown


def test_failed_service_is_reported_offline_even_with_old_heartbeat(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now - timedelta(hours=1))

    snapshot = build_status_snapshot(
        factory_config,
        now=now,
        unit_states={
            "hellotalk-factory.service": "failed",
            "hellotalk-factory-health.timer": "inactive",
        },
    )

    assert snapshot["status"] == "offline"
    assert snapshot["heartbeat_fresh"] is False


def test_future_heartbeat_and_inactive_timer_fail_closed(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now + timedelta(minutes=5))

    snapshot = build_status_snapshot(
        factory_config,
        now=now,
        unit_states={
            "hellotalk-factory.service": "active",
            "hellotalk-factory-health.timer": "inactive",
        },
    )

    assert snapshot["status"] == "degraded"
    assert snapshot["heartbeat_age_seconds"] == -270
    assert snapshot["heartbeat_fresh"] is False


def test_persisted_provider_circuit_is_visible_when_daemon_is_offline(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    daemon = read_json(factory_config.state_dir / "daemon.json", {})
    daemon["providers"] = []
    atomic_write_json(factory_config.state_dir / "daemon.json", daemon)
    atomic_write_json(
        factory_config.state_dir / "agent_health.json",
        {
            "breakers": [
                {
                    "provider": "openhands",
                    "state": "open",
                    "last_failure_kind": "provider_quota",
                    "opened_at": now.isoformat(),
                    "cooldown_seconds": 300,
                    "retry_after_seconds": 3600,
                }
            ]
        },
    )

    snapshot = build_status_snapshot(
        factory_config,
        now=now,
        unit_states={
            "hellotalk-factory.service": "failed",
            "hellotalk-factory-health.timer": "active",
        },
    )

    providers = snapshot["providers"]
    assert isinstance(providers, list)
    openhands = next(item for item in providers if item["name"] == "openhands")
    assert openhands["status"] == "quota_exhausted"
    assert openhands["retry_after"] == (now + timedelta(hours=1)).isoformat()


def test_running_factory_is_degraded_when_no_provider_is_usable(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    daemon = read_json(factory_config.state_dir / "daemon.json", {})
    daemon["providers"] = [
        {
            "name": "openhands",
            "status": "auth_required",
            "checked_at": now.isoformat(),
            "retry_after": None,
        }
    ]
    atomic_write_json(factory_config.state_dir / "daemon.json", daemon)

    snapshot = build_status_snapshot(
        factory_config,
        now=now,
        unit_states={
            "hellotalk-factory.service": "active",
            "hellotalk-factory-health.timer": "active",
        },
    )

    assert snapshot["status"] == "degraded"


def test_storage_reserve_and_exhaustion_projection_are_visible(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    gibibyte = 1024**3

    def disk_usage(path: Path) -> tuple[int, int, int]:
        if path == Path("/"):
            return (40 * gibibyte, 39 * gibibyte + gibibyte // 2, gibibyte // 2)
        return (50 * gibibyte, 10 * gibibyte, 40 * gibibyte)

    snapshot = build_status_snapshot(
        factory_config,
        now=now,
        unit_states={
            "hellotalk-factory.service": "active",
            "hellotalk-factory-health.timer": "active",
        },
        previous_storage_samples=[
            {
                "name": "root",
                "sampled_at": (now - timedelta(minutes=10)).isoformat(),
                "free_bytes": 2 * gibibyte + gibibyte // 2,
            }
        ],
        disk_usage_reader=disk_usage,
    )
    markdown = render_status_markdown(snapshot, factory_config.github_repository)

    assert snapshot["status"] == "degraded"
    storage = snapshot["storage"]
    assert isinstance(storage, list)
    root = next(item for item in storage if item["name"] == "root")
    factory_state = next(item for item in storage if item["name"] == "factory_state")
    assert root["status"] == "critical"
    assert root["growth_bytes_per_hour"] == 12 * gibibyte
    assert root["projected_exhaustion_at"] == (now + timedelta(minutes=2, seconds=30)).isoformat()
    assert factory_state["status"] == "healthy"
    assert "### Storage" in markdown
    assert "factory state" in markdown
    assert "0.5" in markdown


def test_sync_creates_one_factory_skipped_status_issue(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    github = FakeGitHub(issue=None)
    panel = FactoryControlPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    )

    result = panel.sync()

    assert result.issue == 77
    assert result.published
    assert github.labels_ensured
    assert github.created[0][2] == ("factory-status", "factory-skip")
    assert CONTROL_PANEL_MARKER in github.created[0][1]
    state = read_json(factory_config.state_dir / "control_panel.json", {})
    assert [sample["name"] for sample in state["storage_samples"]] == [
        "root",
        "factory_state",
    ]


def test_only_trusted_exact_comments_can_change_pause_state(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    github = FakeGitHub(
        comments=[
            IssueComment(10, "outsider", "/factory restart", now.isoformat()),
            IssueComment(11, "RepoOwner", "/factory pause", now.isoformat()),
            IssueComment(12, "RepoOwner", "/factory pause; rm -rf /", now.isoformat()),
        ]
    )
    panel = FactoryControlPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    )

    result = panel.sync()

    assert result.command == "pause"
    assert read_json(factory_config.state_dir / "control.json", {}) == {"paused": True}
    assert not (factory_config.state_dir / "control_request.json").exists()
    state = read_json(factory_config.state_dir / "control_panel.json", {})
    assert state["last_comment_id"] == 12
    assert state["last_command"]["actor"] == "RepoOwner"
    assert "Last accepted command" in github.updated[0][2]


def test_task_intake_actor_does_not_inherit_control_authority(tmp_path: Path) -> None:
    factory_config = FactoryConfig.from_environment(
        {
            "GITHUB_TOKEN": "not-a-real-token",
            "GITHUB_REPOSITORY": "owner/repo",
            "FACTORY_REPOSITORY": str(tmp_path / "repository"),
            "FACTORY_STATE_DIR": str(tmp_path / "state"),
            "FACTORY_TRUSTED_GITHUB_ACTORS": "repoowner,app/github-actions",
            "FACTORY_CONTROL_GITHUB_ACTORS": "repoowner",
        }
    )
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    github = FakeGitHub(
        comments=[IssueComment(15, "app/github-actions", "/factory restart", now.isoformat())]
    )
    panel = FactoryControlPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    )

    result = panel.sync()

    assert result.command is None
    assert not (factory_config.state_dir / "control_request.json").exists()


def test_trusted_resume_and_status_commands_are_idempotent(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    atomic_write_json(factory_config.state_dir / "control.json", {"paused": True})
    github = FakeGitHub(
        comments=[
            IssueComment(16, "repoowner", "/factory resume", now.isoformat()),
            IssueComment(17, "repoowner", "/factory status", now.isoformat()),
        ]
    )
    panel = FactoryControlPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    )

    result = panel.sync()

    assert result.command == "status"
    assert read_json(factory_config.state_dir / "control.json", {}) == {"paused": False}
    assert len(github.updated) == 1


def test_old_trusted_command_is_not_replayed_after_cursor_state_loss(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    github = FakeGitHub(
        comments=[
            IssueComment(
                13,
                "repoowner",
                "/factory restart",
                (now - timedelta(hours=1)).isoformat(),
            )
        ]
    )
    panel = FactoryControlPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    )

    result = panel.sync()

    assert result.command is None
    assert not (factory_config.state_dir / "control_request.json").exists()
    state = read_json(factory_config.state_dir / "control_panel.json", {})
    assert state["last_comment_id"] == 13


def test_trusted_restart_is_bounded_owned_and_single_use(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    github = FakeGitHub(
        comments=[IssueComment(20, "repoowner", "/factory restart", now.isoformat())]
    )
    panel = FactoryControlPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    )

    result = panel.sync()
    request = factory_config.state_dir / "control_request.json"

    assert result.command == "restart"
    assert restart_request_is_safe(request, expected_uid=os.getuid(), now=now)
    assert not request.exists()
    assert not restart_request_is_safe(request, expected_uid=os.getuid(), now=now)


def test_restart_request_rejects_stale_writable_and_symlink_paths(tmp_path: Path) -> None:
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    request = tmp_path / "request.json"
    payload = {
        "action": "restart",
        "request_id": 21,
        "requested_at": now.isoformat(),
        "requested_by": "repoowner",
    }
    atomic_write_json(request, payload)
    request.chmod(0o622)
    assert not restart_request_is_safe(request, expected_uid=os.getuid(), now=now)

    request.unlink()
    payload["requested_at"] = (now - timedelta(minutes=11)).isoformat()
    atomic_write_json(request, payload)
    assert not restart_request_is_safe(request, expected_uid=os.getuid(), now=now)

    target = tmp_path / "target.json"
    payload["requested_at"] = now.isoformat()
    atomic_write_json(target, payload)
    request.unlink()
    request.symlink_to(target)
    assert not restart_request_is_safe(request, expected_uid=os.getuid(), now=now)


def test_unchanged_panel_is_not_republished_before_heartbeat_interval(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    github = FakeGitHub()
    panel = FactoryControlPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    )

    first = panel.sync()
    second = panel.sync()

    assert first.published
    assert not second.published
    assert len(github.updated) == 1


def test_command_cursor_persists_when_remote_panel_update_fails(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)

    class FailingUpdateGitHub(FakeGitHub):
        fail = True

        def update_issue(self, issue: int, *, title: str, body: str) -> None:
            if self.fail:
                raise RuntimeError("GitHub unavailable")
            super().update_issue(issue, title=title, body=body)

    github = FailingUpdateGitHub(
        comments=[IssueComment(30, "repoowner", "/factory restart", now.isoformat())]
    )
    panel = FactoryControlPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    )

    with pytest.raises(RuntimeError, match="GitHub unavailable"):
        panel.sync()
    state = read_json(factory_config.state_dir / "control_panel.json", {})
    assert state["last_comment_id"] == 30
    request = factory_config.state_dir / "control_request.json"
    assert restart_request_is_safe(request, expected_uid=os.getuid(), now=now)

    github.fail = False
    result = panel.sync()

    assert result.command is None
    assert not request.exists()


def test_restart_cursor_prevents_replay_if_request_creation_is_interrupted(
    tmp_path: Path,
) -> None:
    factory_config = config(tmp_path)
    now = datetime(2026, 8, 17, 12, tzinfo=UTC)
    write_running_state(factory_config, now)
    github = FakeGitHub(
        comments=[IssueComment(31, "repoowner", "/factory restart", now.isoformat())]
    )

    class InterruptedPanel(FactoryControlPanel):
        def _apply_command(self, comment: IssueComment, action: str, current: datetime) -> None:
            raise RuntimeError("simulated process interruption")

    interrupted = InterruptedPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    )

    with pytest.raises(RuntimeError, match="simulated process interruption"):
        interrupted.sync()
    state = read_json(factory_config.state_dir / "control_panel.json", {})
    assert state["last_comment_id"] == 31
    assert not (factory_config.state_dir / "control_request.json").exists()

    retry = FactoryControlPanel(
        factory_config,
        github,
        clock=lambda: now,
        unit_state_reader=lambda _unit: "active",
    ).sync()

    assert retry.command is None
    assert not (factory_config.state_dir / "control_request.json").exists()
