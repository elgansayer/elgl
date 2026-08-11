from datetime import UTC, datetime, timedelta
from pathlib import Path
from subprocess import CompletedProcess

import pytest

from openhands_factory.config import FactoryConfig
from openhands_factory.doctor import (
    daemon_health_check,
    job_health_checks,
    run_doctor,
    worker_terminal_check,
)
from openhands_factory.jobs import JobStore
from openhands_factory.models import Job, JobState, Task
from openhands_factory.state import atomic_write_json


def config(tmp_path: Path) -> FactoryConfig:
    repository = tmp_path / "repository"
    repository.mkdir()
    return FactoryConfig.from_environment(
        {
            "FACTORY_REPOSITORY": str(repository),
            "FACTORY_STATE_DIR": str(tmp_path / "state"),
            "FACTORY_LOG_DIR": str(tmp_path / "log"),
            "FACTORY_PROFILE_STORE": str(tmp_path / "profiles"),
            "FACTORY_WORKTREE_DIR": str(tmp_path / "worktrees"),
            "OPENCODE_GO_API_KEY": "key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "token",
            "GEMINI_ENABLED": "false",
        }
    )


def test_worker_terminal_probe_uses_small_nested_resource_limits(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[list[str]] = []

    def run(arguments: list[str], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        return CompletedProcess(arguments, 0, "factory-terminal-ready\n", "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = worker_terminal_check(config(tmp_path))

    assert check.passed
    assert "--pids-limit=32" in calls[0]
    assert "--memory=256m" in calls[0]
    assert "--cpus=0.25" in calls[0]
    assert "--network=none" in calls[0]


def test_worker_terminal_probe_falls_back_when_nested_cgroup_is_unavailable(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    calls: list[list[str]] = []

    def run(arguments: list[str], **kwargs: object) -> CompletedProcess[str]:
        calls.append(arguments)
        if len(calls) == 1:
            return CompletedProcess(arguments, 125, "cannot set cgroup: permission denied", "")
        return CompletedProcess(arguments, 0, "factory-terminal-ready\n", "")

    monkeypatch.setattr("openhands_factory.doctor.subprocess.run", run)

    check = worker_terminal_check(config(tmp_path))

    assert check.passed
    assert "without nested cgroup limits" in check.detail
    assert len(calls) == 2
    assert "--pids-limit=32" in calls[0]
    assert "--pids-limit=32" not in calls[1]


def test_doctor_reports_openai_subscription_credentials(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    factory_config = config(tmp_path)
    auth = tmp_path / "home" / ".openhands" / "auth"
    auth.mkdir(parents=True)
    (auth / "openai_oauth.json").write_text("{}", encoding="utf-8")
    monkeypatch.setattr("openhands_factory.doctor.Path.home", lambda: tmp_path / "home")
    monkeypatch.setattr(
        "openhands_factory.doctor.subprocess.run",
        lambda *args, **kwargs: CompletedProcess(args, 0, "", ""),
    )

    checks = {check.name: check for check in run_doctor(factory_config)}

    assert checks["openai-subscription"].passed
    assert checks["openai-subscription"].detail == "gpt-5.6-sol"


def test_health_reports_quarantined_and_stalled_jobs(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime.now(UTC)
    quarantined = Job(Task("3152", "Task", "", "github", 0), JobState.QUARANTINED)
    stalled = Job(Task("239", "Task", "", "github", 0), JobState.IMPLEMENTING)
    stalled.updated_at = now - timedelta(minutes=factory_config.max_task_minutes + 16)
    JobStore(factory_config.state_dir / "jobs.json").save(
        {"3152": quarantined, "239": stalled}
    )

    checks = {check.name: check for check in job_health_checks(factory_config, now)}

    assert not checks["jobs-quarantined"].passed
    assert checks["jobs-quarantined"].detail == "issues=3152"
    assert not checks["jobs-stalled"].passed
    assert checks["jobs-stalled"].detail == "issues=239"


def test_health_reports_stale_daemon_heartbeat(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime.now(UTC)
    atomic_write_json(
        factory_config.state_dir / "daemon.json",
        {
            "status": "running",
            "updated_at": (now - timedelta(minutes=5)).isoformat(),
            "active_jobs": ["242"],
        },
    )

    check = daemon_health_check(factory_config, now)

    assert not check.passed
    assert "active_jobs=1" in check.detail


def test_health_fails_closed_for_malformed_state_payloads(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    atomic_write_json(factory_config.state_dir / "daemon.json", ["not", "a", "mapping"])
    atomic_write_json(factory_config.state_dir / "jobs.json", ["not", "a", "mapping"])

    heartbeat = daemon_health_check(factory_config)
    jobs = job_health_checks(factory_config)

    assert not heartbeat.passed
    assert heartbeat.detail == "invalid heartbeat payload"
    assert all(not check.passed for check in jobs)


def test_health_fails_closed_when_durable_job_state_is_missing(tmp_path: Path) -> None:
    checks = job_health_checks(config(tmp_path))

    assert all(not check.passed for check in checks)
    assert {check.detail for check in checks} == {"durable job state is missing"}


def test_health_rejects_a_materially_future_dated_heartbeat(tmp_path: Path) -> None:
    factory_config = config(tmp_path)
    now = datetime.now(UTC)
    atomic_write_json(
        factory_config.state_dir / "daemon.json",
        {
            "status": "running",
            "updated_at": (now + timedelta(minutes=5)).isoformat(),
            "active_jobs": [],
        },
    )

    check = daemon_health_check(factory_config, now)

    assert not check.passed
    assert "future timestamp" in check.detail
