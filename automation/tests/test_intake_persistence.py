"""Paused intake and committed merges survive restart without model dispatch."""

import json
import os
import subprocess
import sys
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.daemon import queue_snapshot, select_batch, select_batch_failsafe
from openhands_factory.jobs import JobStore
from openhands_factory.maintenance import MAINTENANCE_TAG
from openhands_factory.models import Job, JobState, Task


def test_pause_survives_store_restart_and_readmission_preserves_evidence(tmp_path):
    task = Task("42", "Owned work", "Body", "github-issue", 5)
    job = Job(task, JobState.REVIEWING, intake_blocked=True, intake_block_reason="Open draft")
    job.provider_history = [{"provider": "codex", "success": True}]
    job.failure_counts = {"test-failure": 2}
    job.attempt_started_at = datetime.now(UTC) - timedelta(hours=2)
    store = JobStore(tmp_path / "jobs.json")
    store.save_reconciled_jobs([job])

    restarted = JobStore(store.path)
    assert restarted.begin_attempt("42") is None
    assert restarted.recover_abandoned_attempts(set(), timedelta(minutes=1)) == []
    paused = restarted.load()["42"]
    assert paused.intake_blocked
    assert paused.provider_history == job.provider_history
    assert paused.failure_counts == job.failure_counts
    resumed = restarted.reconcile([task])["42"]
    # Intake alone is not proof of lifecycle/verification. The controller must
    # confirm the remote state before clearing a persisted pause.
    assert resumed.intake_blocked
    assert resumed.intake_block_reason == "Open draft"
    assert resumed.state is JobState.REVIEWING
    assert resumed.provider_history == job.provider_history
    assert resumed.failure_counts == job.failure_counts


@pytest.mark.parametrize(
    "state", [state for state in JobState if state not in (JobState.DONE, JobState.QUARANTINED)]
)
def test_primary_and_failsafe_selection_never_dispatch_paused_work(state):
    now = datetime.now(UTC)
    paused = Job(Task("42", "Owned work", "Body", "github-issue", 0), state, intake_blocked=True)
    ready = Job(Task("43", "Eligible work", "Body", "github-issue", 5))
    jobs = {"42": paused, "43": ready}
    assert [j.task.identifier for j in select_batch(jobs, 2, now=now)] == ["43"]
    assert [j.task.identifier for j in select_batch_failsafe(jobs, 2, set(), now, None, 2)] == [
        "43"
    ]
    snapshot = queue_snapshot(jobs, set(), now=now)
    assert snapshot["runnable_count"] == 1
    assert snapshot["intake_blocked_count"] == 1
    assert snapshot["blocked_count"] == 1
    assert snapshot["oldest_blocked_tasks"][0]["intake_blocked"] is True


def test_paused_maintenance_does_not_bypass_intake_or_starve_ordinary_work():
    now = datetime.now(UTC)
    task = Task(
        "42", "Maintenance", "Body", "github-issue", 0, triage_tags=frozenset({MAINTENANCE_TAG})
    )
    paused = Job(task, intake_blocked=True)
    ready = Job(Task("43", "Eligible work", "Body", "github-issue", 5))
    assert select_batch({"42": paused, "43": ready}, 1, now=now) == [ready]


def test_legacy_state_defaults_to_eligible_but_malformed_pause_fails_closed(tmp_path):
    task = Task("42", "Work", "Body", "github-issue", 5)
    store = JobStore(tmp_path / "jobs.json")
    store.save_reconciled_jobs([Job(task)])
    payload = json.loads(store.path.read_text())
    payload["jobs"][0].pop("intake_blocked")
    payload["jobs"][0].pop("intake_block_reason")
    store.path.write_text(json.dumps(payload))
    assert not store.load()["42"].intake_blocked
    payload["jobs"][0]["intake_blocked"] = "corrupt value"
    store.path.write_text(json.dumps(payload))
    assert store.load()["42"].intake_blocked


def test_verified_merge_reconciles_and_completes_across_fresh_os_processes(
    tmp_path, neptune_config, neptune_environment
):
    head = "a" * 40
    task = Task(
        "42",
        "Recovered native merge",
        "Body",
        "github-pull-request",
        5,
        pr_branch="factory/restart-proof",
    )
    job = Job(task, JobState.CI_PENDING, pull_request=42, head_sha=head, latest_verified_sha=head)
    job.provider_history = [{"phase": "implementation", "provider": "fixture", "success": True}]
    store = JobStore(neptune_config.state_dir / "jobs.json")
    store.save_reconciled_jobs([job])
    settings = tmp_path / "test-environment.json"
    settings.write_text(json.dumps(neptune_environment))
    script = """
import json,sys
from pathlib import Path
from openhands_factory.config import FactoryConfig
from openhands_factory.github import RemoteTaskState
from openhands_factory.pipeline import FactoryPipeline
from test_pipeline import GitHub
config = FactoryConfig.from_environment(json.loads(Path(sys.argv[1]).read_text()))
github = GitHub()
github.tasks = []
github.remote_states[(42,True)] = RemoteTaskState(42,'MERGED','a'*40)
pipeline = FactoryPipeline(config,github=github)
def forbidden(*args,**kwargs):
    raise AssertionError('recovery must not start a model phase')
pipeline._run_agent = forbidden
if sys.argv[2] == 'reconcile':
    pipeline.refresh()
else:
    pipeline.run_job('42')
job = pipeline.jobs.load()['42']
print(json.dumps({'state':job.state.value,'history':job.provider_history,
                  'claims':len(pipeline.tasks.claims()),'error':job.last_error}))
"""
    root = Path(__file__).parents[1]
    environment = {
        "PATH": os.defpath,
        "LANG": "C.UTF-8",
        "HOME": str(tmp_path / "empty-home"),
        "PYTHONPATH": os.pathsep.join((str(root), str(root / "tests"))),
    }
    states = []
    for action in ("reconcile", "cleanup", "terminal"):
        result = subprocess.run(
            [sys.executable, "-c", script, str(settings), action],
            env=environment,
            text=True,
            capture_output=True,
            timeout=30,
            check=True,
        )
        receipt = json.loads(result.stdout)
        states.append(receipt["state"])
        assert receipt["history"] == job.provider_history
        assert receipt["claims"] == 1
        assert receipt["error"] is None
    assert states == ["merged", "done", "done"]
