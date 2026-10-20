from datetime import UTC, datetime, timedelta
from pathlib import Path

from openhands_factory.config import FactoryConfig
from openhands_factory.daemon import select_batch
from openhands_factory.issue_admission import IssueAdmissionGate
from openhands_factory.models import Job, JobState, Task


def issue_job(
    identifier: str,
    priority: int,
    state: JobState = JobState.DISCOVERED,
) -> Job:
    return Job(Task(identifier, f"Issue {identifier}", "Body", "github-issue", priority), state)


def pull_request_job(identifier: str, priority: int) -> Job:
    task = Task(
        identifier,
        f"Pull request {identifier}",
        "Body",
        "github-pull-request",
        priority,
        pr_branch=f"feature/{identifier}",
    )
    return Job(task)


def test_issue_admission_gate_allows_one_issue_per_interval(tmp_path: Path) -> None:
    gate = IssueAdmissionGate(
        tmp_path / "issue-admissions.json",
        interval_seconds=3600,
        max_admissions=1,
    )
    started = datetime(2026, 8, 17, 10, 0, tzinfo=UTC)

    assert gate.available_slots(started) == 1
    assert gate.admit("100", started)
    assert gate.available_slots(started + timedelta(minutes=59)) == 0
    assert not gate.admit("101", started + timedelta(minutes=59))
    assert gate.available_slots(started + timedelta(hours=1)) == 1
    assert gate.admit("101", started + timedelta(hours=1))


def test_issue_admission_gate_survives_daemon_restart(tmp_path: Path) -> None:
    state_path = tmp_path / "issue-admissions.json"
    started = datetime(2026, 8, 17, 10, 0, tzinfo=UTC)
    first = IssueAdmissionGate(state_path, interval_seconds=3600, max_admissions=1)
    assert first.admit("100", started)

    restarted = IssueAdmissionGate(state_path, interval_seconds=3600, max_admissions=1)

    assert restarted.available_slots(started + timedelta(minutes=10)) == 0
    snapshot = restarted.snapshot(started + timedelta(minutes=10))
    assert snapshot["next_available_at"] == (started + timedelta(hours=1)).isoformat()


def test_disabled_issue_admission_gate_preserves_historical_unlimited_mode(
    tmp_path: Path,
) -> None:
    state_path = tmp_path / "issue-admissions.json"
    gate = IssueAdmissionGate(state_path, interval_seconds=0, max_admissions=1)

    assert gate.available_slots() is None
    assert gate.admit("100")
    assert gate.admit("101")
    assert not state_path.exists()


def test_select_batch_advances_existing_work_before_admitting_one_new_issue() -> None:
    jobs = {
        "10": issue_job("10", 0),
        "11": issue_job("11", 0),
        "12": issue_job("12", 20, JobState.IMPLEMENTING),
        "13": pull_request_job("13", 10),
    }

    selected = select_batch(jobs, 4, new_issue_slots=1)

    assert [item.task.identifier for item in selected] == ["13", "12", "10"]


def test_select_batch_does_not_delay_pull_request_intake_when_issue_gate_is_full() -> None:
    jobs = {
        "10": issue_job("10", 0),
        "11": pull_request_job("11", 10),
    }

    selected = select_batch(jobs, 2, new_issue_slots=0)

    assert [item.task.identifier for item in selected] == ["11"]


def test_factory_config_reads_hourly_issue_admission_policy() -> None:
    config = FactoryConfig.from_environment(
        {
            "GITHUB_TOKEN": "test-token",
            "FACTORY_NEW_ISSUE_INTERVAL_SECONDS": "3600",
            "FACTORY_NEW_ISSUES_PER_INTERVAL": "1",
        }
    )

    assert config.new_issue_interval_seconds == 3600
    assert config.new_issues_per_interval == 1


def test_production_templates_and_host_repair_keep_hourly_issue_admission() -> None:
    repository_root = Path(__file__).parents[2]
    template = (repository_root / "config/systemd/factory.env.example").read_text(encoding="utf-8")
    repair = (repository_root / "scripts/repair-factory-host.sh").read_text(encoding="utf-8")

    for content in (template, repair):
        assert "FACTORY_NEW_ISSUE_INTERVAL_SECONDS=3600" in content
        assert "FACTORY_NEW_ISSUES_PER_INTERVAL=1" in content
