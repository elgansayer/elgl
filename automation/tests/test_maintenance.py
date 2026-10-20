from __future__ import annotations

import json
import shutil
import subprocess
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from pathlib import Path
from types import SimpleNamespace

import pytest
from pydantic import SecretStr

from openhands_factory.config import FactoryConfig
from openhands_factory.daemon import is_new_github_issue, select_batch, select_batch_failsafe
from openhands_factory.exceptions import FactoryError, ProviderCapacityUnavailable
from openhands_factory.jobs import JobStore
from openhands_factory.main_merge_gate import MainCiStatus
from openhands_factory.maintenance import (
    MAINTENANCE_TAG,
    MaintenanceController,
    MaintenancePlan,
    collect_incidents,
    error_identity,
    maintenance_feedback,
    runtime_signature,
    validate_proposal,
)
from openhands_factory.models import Job, JobState, Task
from openhands_factory.pr_metrics import PullRequestMetricsStore
from openhands_factory.state import atomic_write_json


class GitHub:
    def __init__(self) -> None:
        self.issues: list[Task] = []
        self.created: list[tuple[str, str, tuple[str, ...]]] = []
        self.merged = False
        self.collect_calls = 0

    def collect_open_issues(self) -> list[Task]:
        self.collect_calls += 1
        return self.issues

    def create_issue(self, title: str, body: str, labels: tuple[str, ...]) -> int:
        self.created.append((title, body, labels))
        self.issues.append(Task("100", title, body, "github-issue", 10))
        return 100

    def pull_request_status(self, number: int) -> SimpleNamespace:
        return SimpleNamespace(state="MERGED" if self.merged else "CLOSED")


def failed_job(identifier: str) -> Job:
    return Job(
        Task(identifier, "Repair", "", "github-pull-request", 5),
        state=JobState.REPAIRING,
        pull_request=int(identifier),
        head_sha="old-head",
        last_error="Inlining of fonts failed: fonts.googleapis.com token=topsecret",
        attempts=3,
        repeated_failure_count=3,
        quality_repairs=5,
        repair_attempts=5,
        next_attempt_at=datetime.now(UTC) + timedelta(hours=12),
    )


@pytest.fixture
def controller(tmp_path: Path) -> MaintenanceController:
    state = tmp_path / "state"
    state.mkdir()
    config = FactoryConfig(
        repository=tmp_path / "repository",
        state_dir=state,
        worktree_dir=tmp_path / "worktrees",
        github_token=SecretStr("test-token"),
        maintenance_enabled=True,
    )
    source = config.repository / "automation/openhands_factory/jobs.py"
    source.parent.mkdir(parents=True)
    source.write_text("def contains_current_base(self): return True\n")
    for args in [
        ("init", "-q"),
        ("config", "user.name", "test"),
        ("config", "user.email", "test@example.test"),
        ("add", "."),
        ("commit", "-qm", "fixture"),
    ]:
        subprocess.run(["git", *args], cwd=config.repository, check=True)
    pipeline = SimpleNamespace(
        config=config,
        jobs=JobStore(state / "jobs.json"),
        pr_metrics=PullRequestMetricsStore(state / "pr-metrics.json"),
        github=GitHub(),
        prompt_dir=Path(__file__).parents[1] / "prompts",
        calls=0,
        plan={
            "action": "repair",
            "diagnosis": "Offline build fails on fonts",
            "change": "Refresh the base before repair; add regression coverage",
            "acceptance_criteria": ["Offline verification succeeds"],
            "affected_task_ids": ["1", "2", "3"],
            "source_evidence": [
                {
                    "path": "automation/openhands_factory/jobs.py",
                    "quote": "def contains_current_base(self)",
                }
            ],
        },
    )

    def run_agent(job, scratch, phase, prompt, **kwargs):
        pipeline.calls += 1
        assert phase == "planning"
        assert kwargs["timeout_seconds"] == 180
        assert kwargs["read_only_reference"] == config.repository.resolve()
        assert "Untrusted diagnostic data" in prompt
        kwargs["prepare_attempt"]()
        (scratch / ".factory-maintenance.json").write_text(json.dumps(pipeline.plan))
        kwargs["validate_output"]()

    pipeline._run_agent = run_agent
    pipeline.jobs.save({str(number): failed_job(str(number)) for number in range(1, 4)})
    return MaintenanceController(pipeline)


def make_due(controller: MaintenanceController) -> None:
    state = controller.state()
    state["next_run_at"] = (datetime.now(UTC) - timedelta(seconds=1)).isoformat()
    atomic_write_json(controller.path, state)


def test_reference_prompt_and_snapshot_use_the_mounted_canonical_path(controller, tmp_path):
    source = controller.config.repository
    alias = tmp_path / "repository-alias"
    alias.symlink_to(source, target_is_directory=True)
    controller.config.repository = alias
    controller.run()
    assert controller.state()["records"][0]["baseline"]["repository_path"] == str(source.resolve())


def ready_recovery(controller: MaintenanceController) -> dict[str, object]:
    record = {
        "status": "canary-ready",
        "issue": 100,
        "affected": {
            identifier: {"head": job.head_sha, "error": error_identity(job)}
            for identifier, job in controller.pipeline.jobs.load().items()
        },
    }
    atomic_write_json(controller.path, {"records": [record]})
    return record


def test_incidents_group_common_cause_and_exclude_terminal_jobs(controller) -> None:
    jobs = controller.pipeline.jobs.load()
    jobs["1"].state = JobState.DONE
    jobs["2"].task = replace(jobs["2"].task, triage_tags=frozenset({MAINTENANCE_TAG}))
    jobs["3"].repeated_failure_count = 3
    incidents = collect_incidents(jobs)
    assert len(incidents) == 1
    assert incidents[0].key == "offline-font-verification"
    assert [job.task.identifier for job in incidents[0].jobs] == ["3"]
    assert "topsecret" not in str(incidents[0].evidence())


def test_one_deduplicated_repair_with_durable_schedule_and_daily_report(controller) -> None:
    controller.run()
    pipeline = controller.pipeline
    assert pipeline.calls == 1
    assert len(pipeline.github.created) == 1
    assert pipeline.github.created[0][2] == (MAINTENANCE_TAG,)
    assert "topsecret" not in pipeline.github.created[0][1]
    assert "regression test" in pipeline.github.created[0][1]
    assert controller.state()["analyses_today"] == 1
    assert len(controller.state()["reports"]) == 1
    record = controller.records()[0]
    assert record["change"] == pipeline.plan["change"]
    assert record["acceptance_criteria"] == pipeline.plan["acceptance_criteria"]
    controller.run()
    make_due(controller)
    controller.run()
    assert pipeline.calls == 1
    assert len(pipeline.github.created) == 1


def test_planner_receives_measured_outcomes_without_recursive_history(controller):
    baseline = {
        "observed_at": "2026-10-18T00:00:00+00:00",
        "throughput": {
            "rolling_throughput": {
                "24h": {
                    "merged_pr_count": 2,
                    "merged_pr_count_by_component": {"unknown": 2},
                }
            }
        },
        "jobs_by_state": {"repairing": 12},
        "recent_maintenance": [{"recursive": "must not be copied"}],
        "provider_usage_lifetime": [{"irrelevant": "must not be copied"}],
    }
    outcome = {
        **baseline,
        "observed_at": "2026-10-19T00:00:00+00:00",
        "jobs_by_state": {"repairing": 8},
    }
    record = {
        "key": "experiment",
        "status": "measured",
        "change": "targeted repair",
        "acceptance_criteria": ["verified source and new-head canary"],
        "baseline": baseline,
        "outcome": outcome,
    }
    atomic_write_json(controller.path, {"records": [record]})
    feedback = controller.snapshot(controller.pipeline.jobs.load())["recent_maintenance"][0]
    assert feedback["change"] == "targeted repair"
    assert feedback["acceptance_criteria"] == record["acceptance_criteria"]
    measurement = feedback["measurement"]
    assert measurement["baseline"]["jobs_by_state"] == {"repairing": 12}
    assert measurement["outcome"]["jobs_by_state"] == {"repairing": 8}
    assert measurement["outcome"]["merged_pr_count_by_component_24h"] == {"unknown": 2}
    assert "not causal proof" in measurement["interpretation"]
    assert "must not be copied" not in json.dumps(feedback)


@pytest.mark.parametrize(
    "status", ["observing", "canary-failed", "canary-delayed", "canary-obsolete"]
)
def test_feedback_preserves_unverified_outcomes_and_legacy_records(status):
    feedback = maintenance_feedback({"key": "old", "status": status})
    assert feedback["status"] == status
    assert feedback["change"] is None
    assert feedback["acceptance_criteria"] == []
    assert feedback["canary_verified_sha"] is None
    assert feedback["measurement"]["baseline"] is None
    assert feedback["measurement"]["outcome"] is None


def test_feedback_bounds_and_redacts_historical_model_text():
    feedback = maintenance_feedback(
        {
            "diagnosis": "token=fixture-secret " + "x" * 4000,
            "change": "token=fixture-secret",
            "acceptance_criteria": ["token=fixture-secret"] * 20,
            "outcome": {
                "jobs_by_state": {"valid": 1, "bad": True, "negative": -1},
                "throughput": {"rolling_throughput": {"24h": {"merged_pr_count": True}}},
            },
        }
    )
    assert "fixture-secret" not in json.dumps(feedback)
    assert len(feedback["diagnosis"]) <= 2000
    assert len(feedback["acceptance_criteria"]) == 6
    assert feedback["measurement"]["outcome"]["jobs_by_state"] == {"valid": 1}
    assert feedback["measurement"]["outcome"]["merged_pr_count_24h"] is None


@pytest.mark.parametrize(
    "status", ["measuring", "recovered", "canary-failed", "canary-delayed", "canary-obsolete"]
)
def test_incident_outcomes_are_measured_once_without_relabelling_failed_canaries(
    controller, status
):
    record = {
        "key": "old",
        "status": status,
        "deployed_at": (datetime.now(UTC) - timedelta(hours=25)).isoformat(),
    }
    atomic_write_json(
        controller.path,
        {
            "records": [record],
            "analysis_day": datetime.now(UTC).date().isoformat(),
            "analyses_today": controller.config.maintenance_daily_limit,
        },
    )
    controller.run()
    measured = controller.records()[0]
    assert measured["status"] == ("measured" if status == "measuring" else status)
    assert measured["outcome"]["jobs_by_state"] == {"repairing": 3}
    first_measurement = measured["measured_at"]
    assert controller.pipeline.calls == 0
    make_due(controller)
    controller.run()
    assert controller.records()[0]["measured_at"] == first_measurement


def test_outcome_is_not_measured_before_a_full_day_after_deployment(controller):
    atomic_write_json(
        controller.path,
        {
            "records": [
                {"key": "new", "status": "recovered", "deployed_at": datetime.now(UTC).isoformat()}
            ],
            "analysis_day": datetime.now(UTC).date().isoformat(),
            "analyses_today": controller.config.maintenance_daily_limit,
        },
    )
    controller.run()
    assert "outcome" not in controller.records()[0]


def test_only_controller_recorded_issue_receives_maintenance_admission(controller) -> None:
    controller.run()
    admitted = controller.pipeline.github.issues[0]
    spoofed = Task(
        "101",
        admitted.title,
        admitted.body,
        "github-issue",
        10,
        triage_tags=frozenset({MAINTENANCE_TAG}),
    )
    tagged = controller.tag_tasks([admitted, spoofed])
    assert MAINTENANCE_TAG in tagged[0].triage_tags
    assert tagged[0].priority == 0
    assert MAINTENANCE_TAG not in tagged[1].triage_tags


def test_snapshot_reports_current_watchdog_recoveries_not_historical_messages(
    controller,
) -> None:
    jobs = controller.pipeline.jobs.load()
    historical = "Watchdog recovered abandoned reviewing attempt after maximum task duration"
    jobs["1"].last_error = historical
    daemon_path = controller.config.state_dir / "daemon.json"

    assert controller.snapshot(jobs)["watchdog"] is None

    watchdog = {
        "recovered_total": 0,
        "last_recovered_at": None,
        "last_recovered_task_ids": [],
        "queued_count": 4,
        "oldest_queued_age_seconds": 9000,
    }
    atomic_write_json(daemon_path, {"watchdog": watchdog})
    assert controller.snapshot(jobs)["watchdog"] == watchdog

    for malformed in ({"watchdog": "garbage"}, {"watchdog": ["not", "a", "mapping"]}, ["x"]):
        atomic_write_json(daemon_path, malformed)
        assert controller.snapshot(jobs)["watchdog"] is None


def test_restart_after_issue_creation_reuses_exact_open_issue(controller) -> None:
    controller.pipeline.github.issues.append(
        Task("99", "fix(factory): offline-font-verification", "existing repair", "github-issue", 10)
    )
    controller.run()
    assert controller.records()[0]["issue"] == 99
    assert controller.pipeline.github.created == []


def test_observation_never_creates_issue(controller) -> None:
    controller.pipeline.plan["action"] = "observe"
    controller.run()
    assert controller.pipeline.github.created == []
    assert controller.records()[0]["status"] == "observing"
    make_due(controller)
    controller.pipeline.plan["affected_task_ids"] = []
    controller.run()
    assert controller.records()[-1]["key"].startswith("throughput-experiment-")


def test_daily_budget_blocks_model_work_but_keeps_reports(controller) -> None:
    atomic_write_json(
        controller.path, {"analysis_day": datetime.now(UTC).date().isoformat(), "analyses_today": 4}
    )
    controller.run()
    assert controller.pipeline.calls == 0
    assert controller.state()["reports"]
    assert controller.pipeline.github.collect_calls == 0


@pytest.mark.parametrize("plan", [{}, {"action": "execute-host-command"}])
def test_invalid_model_plan_is_bounded_and_cannot_create_issues(controller, plan) -> None:
    controller.pipeline.plan = plan
    with pytest.raises(FactoryError, match="Invalid structured maintenance report"):
        controller.run()
    assert not controller.due()
    assert controller.state()["analyses_today"] == 1
    assert controller.pipeline.github.created == []


def test_unobserved_task_identifiers_are_rejected(controller) -> None:
    controller.pipeline.plan["affected_task_ids"] = ["999"]
    with pytest.raises(FactoryError, match="unobserved tasks"):
        controller.run()
    assert controller.pipeline.github.created == []


def test_busy_capacity_does_not_spend_daily_analysis_allowance(controller) -> None:
    def busy(*args, **kwargs):
        raise ProviderCapacityUnavailable("capacity busy", retry_after_seconds=30)

    controller.pipeline._run_agent = busy
    with pytest.raises(ProviderCapacityUnavailable):
        controller.run()
    assert controller.state()["analyses_today"] == 0
    assert not controller.due()
    assert controller.state()["last_error"] == "capacity busy"


def test_inconclusive_incident_can_be_revisited_without_reusing_completed_task_key(
    controller,
) -> None:
    atomic_write_json(
        controller.path,
        {
            "records": [
                {
                    "key": "offline-font-verification",
                    "status": "observing",
                    "created_at": (datetime.now(UTC) - timedelta(hours=7)).isoformat(),
                }
            ]
        },
    )
    controller.run()
    record = controller.records()[-1]
    assert record["episode"] == 2
    assert "recovery 2" in controller.pipeline.github.created[0][0]
    assert (
        "Factory-Task-Key: maintenance:offline-font-verification:2"
        in controller.pipeline.github.created[0][1]
    )


def test_merged_repair_does_not_recover_before_verified_deployment(controller, monkeypatch) -> None:
    controller.run()
    pipeline = controller.pipeline
    pipeline.github.issues.clear()
    pipeline.github.merged = True
    jobs = pipeline.jobs.load()
    jobs["100"] = Job(
        Task("100", "Maintenance", "", "github-issue", 0), state=JobState.DONE, pull_request=200
    )
    pipeline.jobs.save(jobs)
    monkeypatch.setattr(controller, "deployment_ready", lambda: False)
    make_due(controller)
    controller.run()
    assert controller.records()[0]["status"] == "awaiting-deployment"
    assert controller.apply_recoveries(set()) == []
    monkeypatch.setattr(controller, "deployment_ready", lambda: True)
    make_due(controller)
    controller.run()
    assert controller.records()[0]["status"] == "canary-ready"


def test_closed_unmerged_issue_never_authorises_recovery(controller) -> None:
    controller.run()
    controller.pipeline.github.issues.clear()
    make_due(controller)
    controller.pipeline.plan["affected_task_ids"] = []
    controller.run()
    assert controller.records()[0]["status"] == "closed-unverified"
    assert controller.apply_recoveries(set()) == []


def test_recovery_runs_one_canary_before_releasing_remaining_jobs(controller) -> None:
    ready_recovery(controller)
    assert controller.apply_recoveries({"1"}) == ["2"]
    jobs = controller.pipeline.jobs.load()
    assert jobs["1"].next_attempt_at is not None
    assert jobs["2"].attempts == 3
    assert jobs["2"].repair_attempts == 0
    assert jobs["2"].quality_repairs == 0
    assert jobs["2"].last_error is not None
    assert controller.apply_recoveries(set()) == []
    jobs["2"].head_sha = "new-verified-head"
    jobs["2"].latest_verified_sha = "new-verified-head"
    jobs["2"].last_error = None
    controller.pipeline.jobs.save(jobs)
    assert controller.apply_recoveries({"1"}) == ["3"]
    assert controller.apply_recoveries(set()) == ["1"]
    assert controller.apply_recoveries(set()) == []
    assert controller.records()[0]["status"] == "recovered"


def test_failed_canary_never_releases_batch(controller) -> None:
    ready_recovery(controller)
    assert controller.apply_recoveries(set()) == ["1"]
    jobs = controller.pipeline.jobs.load()
    jobs["1"].attempts += 1
    jobs["1"].maintenance_recovery_failures += 1
    controller.pipeline.jobs.save(jobs)
    assert controller.apply_recoveries(set()) == []
    assert controller.records()[0]["status"] == "canary-failed"
    assert controller.pipeline.jobs.load()["2"].next_attempt_at is not None


def test_changed_heads_errors_and_live_jobs_are_not_reset(controller) -> None:
    ready_recovery(controller)
    jobs = controller.pipeline.jobs.load()
    jobs["1"].head_sha = "newer-head"
    jobs["2"].last_error = "different failure"
    controller.pipeline.jobs.save(jobs)
    assert controller.apply_recoveries({"3"}) == []
    assert controller.pipeline.jobs.load()["3"].next_attempt_at is not None
    assert controller.records()[0]["status"] == "canary-ready"
    assert controller.apply_recoveries(set()) == ["3"]


def test_recovery_acknowledgement_crash_cannot_reset_budget_twice(controller) -> None:
    original = ready_recovery(controller)
    assert controller.apply_recoveries(set()) == ["1"]
    jobs = controller.pipeline.jobs.load()
    jobs["1"].repair_attempts = 2
    controller.pipeline.jobs.save(jobs)
    # Simulate a durable job write followed by loss of the ledger acknowledgement.
    atomic_write_json(controller.path, {"records": [original]})
    assert controller.apply_recoveries(set()) == []
    assert controller.pipeline.jobs.load()["1"].repair_attempts == 2
    assert controller.records()[0]["canary_task"] == "1"


def test_issue_only_canary_gets_one_trusted_lane_despite_backlog_pause(controller) -> None:
    jobs = controller.pipeline.jobs.load()
    for job in jobs.values():
        job.task = replace(job.task, source="github-issue")
        job.pull_request = None
    controller.pipeline.jobs.save(jobs)
    ready_recovery(controller)
    assert controller.apply_recoveries(set()) == ["1"]
    jobs = controller.pipeline.jobs.load()
    selected = select_batch(jobs, 3, new_issue_slots=0, review_only=True)
    assert [job.task.identifier for job in selected] == ["1"]
    tagged = controller.tag_tasks([replace(jobs["1"].task, triage_tags=frozenset())])
    assert MAINTENANCE_TAG in tagged[0].triage_tags
    state = controller.state()
    state["records"][0]["status"] = "canary-failed"
    atomic_write_json(controller.path, state)
    assert MAINTENANCE_TAG not in controller.tag_tasks(tagged)[0].triage_tags


def test_corrupt_state_recovers_from_last_valid_generation(controller) -> None:
    atomic_write_json(controller.path, {"records": [], "reports": []})
    atomic_write_json(controller.path, {"reports": ["invalid"]})
    assert controller.state() == {"records": [], "reports": []}


@pytest.mark.parametrize("failsafe", [False, True])
def test_maintenance_lane_is_bounded_and_not_starved_by_backlog(controller, failsafe) -> None:
    now = datetime.now(UTC)
    jobs = {
        str(number): Job(
            Task(
                str(number),
                "Maintenance",
                "",
                "github-issue",
                0,
                triage_tags=frozenset({MAINTENANCE_TAG}),
            )
        )
        for number in range(100, 103)
    }
    jobs["200"] = Job(Task("200", "Ordinary issue", "", "github-issue", 0))
    kwargs = {
        "limit": 3,
        "excluded_task_ids": set(),
        "now": now,
        "new_issue_slots": 0,
        "review_lane_max_concurrent": 3,
        "review_only": True,
    }
    selected = select_batch_failsafe(jobs, **kwargs) if failsafe else select_batch(jobs, **kwargs)
    assert len(selected) == 1
    assert not is_new_github_issue(selected[0])
    kwargs["excluded_task_ids"] = {selected[0].task.identifier}
    selected = select_batch_failsafe(jobs, **kwargs) if failsafe else select_batch(jobs, **kwargs)
    assert selected == []


def test_deployment_requires_green_current_main_and_matching_installed_package(
    controller, monkeypatch
) -> None:
    repository = controller.config.repository
    repository.mkdir(exist_ok=True)
    package = Path(__file__).parents[1] / "openhands_factory"
    shutil.copytree(
        package,
        repository / "automation/openhands_factory",
        ignore=shutil.ignore_patterns("__pycache__"),
        dirs_exist_ok=True,
    )
    for args in [
        ("init", "-q"),
        ("config", "user.name", "test"),
        ("config", "user.email", "test@example.test"),
        ("add", "."),
        ("commit", "-qm", "runtime"),
    ]:
        subprocess.run(["git", *args], cwd=repository, check=True)
    head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=repository, text=True).strip()
    monkeypatch.setattr(
        "openhands_factory.maintenance.MainBranchMergeGate.current_main_ci",
        lambda self: MainCiStatus(head, "COMPLETED", "SUCCESS"),
    )
    assert controller.runtime_signature == runtime_signature()
    assert controller.deployment_ready()
    controller.runtime_signature = "older-runtime"
    assert not controller.deployment_ready()
    monkeypatch.setattr(
        "openhands_factory.maintenance.MainBranchMergeGate.current_main_ci",
        lambda self: MainCiStatus(head, "IN_PROGRESS", ""),
    )
    assert not controller.deployment_ready()


@pytest.mark.parametrize(
    "change",
    [
        "Introduce dead-letter triage",
        "Require explicit triage",
        "Wait for human approval",
        "Require manual intervention",
    ],
)
def test_manual_recovery_proposals_are_rejected(controller, change: str) -> None:
    plan = MaintenancePlan.model_validate({**controller.pipeline.plan, "change": change})
    with pytest.raises(FactoryError, match="automatic bounded recovery"):
        validate_proposal(plan, controller.config.repository)


@pytest.mark.parametrize("action", ["repair", "observe"])
def test_every_assessment_requires_source_access_proof(controller, action) -> None:
    plan = MaintenancePlan.model_validate({**controller.pipeline.plan, "source_evidence": []})
    plan.action = action
    with pytest.raises(FactoryError, match="tracked-source evidence"):
        validate_proposal(plan, controller.config.repository)


def test_analysis_spacing_keeps_checks_running_without_spending_every_slot_at_midnight(controller):
    controller.config.maintenance_analysis_interval_seconds = 14400
    controller.pipeline.plan["action"] = "observe"
    controller.run()
    first_run = controller.state()["last_run_at"]
    make_due(controller)
    controller.run()
    assert controller.pipeline.calls == 1
    assert controller.state()["last_run_at"] != first_run
    assert controller.state()["next_analysis_at"] > controller.state()["next_run_at"]
    assert controller.pipeline.github.collect_calls == 0


def test_busy_capacity_does_not_start_the_analysis_spacing_clock(controller):
    controller.config.maintenance_analysis_interval_seconds = 14400
    original = controller.pipeline._run_agent

    def busy(*args, **kwargs):
        raise ProviderCapacityUnavailable("busy", retry_after_seconds=30)

    controller.pipeline._run_agent = busy
    with pytest.raises(ProviderCapacityUnavailable):
        controller.run()
    assert controller.state().get("last_analysis_at") is None
    assert controller.state()["analyses_today"] == 0
    controller.pipeline._run_agent = original
    make_due(controller)
    controller.run()
    assert controller.pipeline.calls == 1


def test_unchanged_observation_is_not_new_evidence_but_a_changed_head_is(controller):
    controller.pipeline.plan["action"] = "observe"
    controller.run()
    state = controller.state()
    state["records"][0]["created_at"] = (datetime.now(UTC) - timedelta(days=1)).isoformat()
    atomic_write_json(controller.path, state)
    controller.pipeline.plan["affected_task_ids"] = []
    make_due(controller)
    controller.run()
    assert controller.records()[-1]["key"].startswith("throughput-experiment-")
    jobs = controller.pipeline.jobs.load()
    jobs["1"].head_sha = "new-evidence-head"
    controller.pipeline.jobs.save(jobs)
    controller.pipeline.plan["affected_task_ids"] = ["1", "2", "3"]
    make_due(controller)
    controller.run()
    assert controller.records()[-1]["key"] == "offline-font-verification"


def test_last_daily_slot_is_reserved_for_the_improvement_programme(controller):
    atomic_write_json(
        controller.path,
        {"analysis_day": datetime.now(UTC).date().isoformat(), "analyses_today": 3},
    )
    controller.pipeline.plan.update({"action": "observe", "affected_task_ids": []})
    controller.run()
    assert controller.records()[0]["key"].startswith("throughput-experiment-")
    assert controller.state()["analyses_today"] == 4


def test_historical_watchdog_messages_do_not_imply_a_current_crash(controller):
    jobs = controller.pipeline.jobs.load()
    for job in jobs.values():
        job.last_error = "Watchdog recovered abandoned reviewing attempt"
    controller.pipeline.jobs.save(jobs)
    atomic_write_json(
        controller.config.state_dir / "daemon.json", {"watchdog": {"recovered_total": 0}}
    )
    controller.pipeline.plan.update({"action": "observe", "affected_task_ids": []})
    controller.run()
    assert controller.records()[0]["key"].startswith("throughput-experiment-")


def test_a_canonical_claim_alias_is_not_a_recovery_canary(controller):
    record = ready_recovery(controller)
    record["affected"] = {"1": record["affected"]["1"]}
    atomic_write_json(controller.path, {"records": [record]})
    jobs = controller.pipeline.jobs.load()
    jobs["1"].canonical_task_id = "99"
    controller.pipeline.jobs.save(jobs)
    assert controller.apply_recoveries(set()) == []
    assert controller.records()[0]["status"] == "obsolete"
    assert controller.pipeline.jobs.load()["1"].repair_attempts == 5


def test_retired_canary_is_not_counted_as_success_or_left_waiting_six_hours(controller):
    ready_recovery(controller)
    assert controller.apply_recoveries(set()) == ["1"]
    jobs = controller.pipeline.jobs.load()
    jobs["1"].state = JobState.DONE
    jobs["1"].canonical_task_id = "99"
    controller.pipeline.jobs.save(jobs)
    assert controller.apply_recoveries(set()) == []
    assert controller.records()[0]["status"] == "canary-obsolete"
    assert controller.records()[0]["canary_canonical_task"] == "99"
    assert controller.pipeline.jobs.load()["2"].repair_attempts == 5


@pytest.mark.parametrize("path", ["/etc/service-secret.env", "../outside.py", "credentials.env"])
def test_source_references_cannot_escape_or_reference_environment_files(
    controller, path: str
) -> None:
    plan = MaintenancePlan.model_validate(
        {
            **controller.pipeline.plan,
            "source_evidence": [{"path": path, "quote": "Not an actual source excerpt"}],
        }
    )
    with pytest.raises(FactoryError, match="Unsafe maintenance source"):
        validate_proposal(plan, controller.config.repository)


def test_fabricated_source_quotes_and_untracked_files_are_rejected(controller) -> None:
    plan = MaintenancePlan.model_validate(controller.pipeline.plan)
    plan.source_evidence[0].quote = "A fabricated code excerpt that does not exist"
    with pytest.raises(FactoryError, match="does not match tracked code"):
        validate_proposal(plan, controller.config.repository)
    path = controller.config.repository / "untracked.py"
    path.write_text("A real but untracked code excerpt\n")
    plan.source_evidence[0].path = "untracked.py"
    plan.source_evidence[0].quote = "A real but untracked code excerpt"
    with pytest.raises(FactoryError, match="does not match tracked code"):
        validate_proposal(plan, controller.config.repository)
