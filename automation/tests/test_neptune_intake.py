"""Owned Git/input fences; actual accepted Neptune algorithm runs in mandatory CI."""

import json
import os
import subprocess
import time
from dataclasses import replace
from pathlib import Path
from types import SimpleNamespace

import pytest

from openhands_factory import neptune_intake as module
from openhands_factory.exceptions import VerificationFailed
from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.jobs import JobStore
from openhands_factory.models import Job, JobState, Task
from openhands_factory.neptune_intake import (
    NeptuneIntakeUnavailable,
    accepted_verification,
    task_revision,
)
from openhands_factory.pipeline import FactoryPipeline
from openhands_factory.repository_guard import ProcessResult
from openhands_factory.retry_policy import classify_failure
from openhands_factory.verification import _validate_neptune_receipt, commands_for


def git(root, *args):
    return subprocess.check_output(
        ["git", *args], cwd=root, text=True, stderr=subprocess.PIPE
    ).strip()


def plain_metadata_process(arguments, *, work, cache, network, timeout, on_start=None):
    assert network is False
    result = subprocess.run(
        arguments,
        cwd=work,
        env={"PATH": os.defpath, "HOME": str(work)},
        timeout=timeout,
        capture_output=True,
        text=True,
    )
    return ProcessResult(result.returncode, result.stdout, result.stderr)


@pytest.fixture
def owned(tmp_path, neptune_config, monkeypatch):
    repository = neptune_config.repository
    files = {
        "tools/godot/toolchain.json": json.dumps({"addons": {"owned/addon": "f" * 64}}),
        "owned/addon": "owned fixture, not a native library",
        "tools/factory/readiness.py": (
            "def evaluate(s,n):\n return {'ready':0<=n-s['captured_at']<=900,'reasons':['stale']}\n"
        ),
        "tools/factory/feature_contracts.py": "def requirements(t):return {}\n",
        ".gitignore": "__pycache__/\n",
        "docs/case.md": "original owned case\n",
    }
    for relative, text in files.items():
        path = repository / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    git(repository, "init", "-qb", "main")
    git(repository, "config", "user.name", "Owned integration")
    git(repository, "config", "user.email", "owned@example.invalid")
    git(repository, "add", ".")
    git(repository, "commit", "-qm", "fixture: accepted parser stub")
    base = git(repository, "rev-parse", "HEAD")
    git(repository, "update-ref", "refs/remotes/origin/main", base)
    workspace = neptune_config.worktree_dir / "657"
    workspace.parent.mkdir(parents=True)
    git(repository, "worktree", "add", "-qb", "factory/657-owned", str(workspace))
    (workspace / "docs/case.md").write_text("candidate owned case\n")
    registry = tmp_path / "accepted-registry"
    registry.mkdir(mode=0o700)
    (registry / "657").mkdir(mode=0o700)
    config = neptune_config.model_copy(update={"neptune_intake_dir": registry})
    job = Job(
        Task("657", "Owned research", "Public fixture acceptance", "github-issue", 0),
        state=JobState.VERIFYING,
    )
    workflow = GitWorkflow(workspace, "main")
    jobs = JobStore(tmp_path / "jobs.json")
    controller = SimpleNamespace(
        config=config, jobs=jobs, verification_slots=None, host_resource_slots=None
    )
    monkeypatch.setattr(module, "run_preparation", plain_metadata_process)
    from openhands_factory import pipeline

    monkeypatch.setattr(
        pipeline, "prepare_native", lambda config, workspace, changed, commands: commands
    )
    return config, workspace, job, workflow, controller


def publish(owned, **updates):
    config, workspace, job, _, _ = owned
    head = git(workspace, "rev-parse", "HEAD")
    task = {
        "repository": config.github_repository,
        "issue": 657,
        "feature_id": "RLAB-003",
        "revision": task_revision(job.task, config.github_repository),
        "kind": "research",
        "state": "open",
        "acceptance": ["Owned metadata fence"],
        "evidence": ["candidate-head:" + head],
        "prerequisites": [],
        "capabilities": [],
        "scope": {"goal": "Owned fixture only", "paths": ["docs/case.md"], "max_files": 1},
    }
    snapshot = {
        "schema": "neptune.factory-intake.v1",
        "captured_at": time.time(),
        "base_sha": git(config.repository, "rev-parse", "refs/remotes/origin/main"),
        "task": task,
        "available_capabilities": [],
        "prerequisite_evidence": {},
        "active_work": [],
    }
    snapshot.update(updates)
    path = config.neptune_intake_dir / "657/intake.json"
    path.write_text(json.dumps(snapshot))
    return path, snapshot


def checkpoint(owned):
    _config, workspace, job, workflow, controller = owned
    with pytest.raises(NeptuneIntakeUnavailable):
        FactoryPipeline._verify(controller, workflow, job=job)
    assert git(workspace, "status", "--porcelain") == ""
    assert job.verification_candidate_sha == git(workspace, "rev-parse", "HEAD")
    assert job.latest_verified_sha is None
    return controller.jobs.load()[job.task.identifier]


def test_candidate_checkpoint_precedes_missing_intake_and_survives_restart(owned, monkeypatch):
    restored = checkpoint(owned)
    _config, workspace, job, workflow, controller = owned
    head = git(workspace, "rev-parse", "HEAD")
    assert restored.verification_candidate_sha == head
    publish(owned)
    from openhands_factory import pipeline

    seen = []

    def verify(commands):
        if not commands:
            return
        seen.append(commands)
        assert commands[0].read_only_inputs
        assert json.loads(commands[0].neptune_binding_json)["head"] == head

    monkeypatch.setattr(pipeline, "run_verification", verify)
    assert FactoryPipeline._verify(controller, workflow, job=restored) == {Path("docs/case.md")}
    assert git(workspace, "rev-parse", "HEAD") == head
    again = controller.jobs.load()[job.task.identifier]
    assert again.neptune_contract_sha == restored.neptune_contract_sha
    assert again.latest_verified_sha is None  # No publication/checkpoint claims success early.
    assert seen and not seen[0][0].read_only_inputs[0].joinpath("source").exists()


@pytest.mark.parametrize(
    "case",
    [
        "wrong_issue",
        "wrong_revision",
        "wrong_base",
        "wrong_head",
        "stale",
        "duplicate",
        "symlink",
        "writable",
    ],
)
def test_unaccepted_inputs_fail_closed_before_candidate_checks(owned, case):
    checkpoint(owned)
    config, workspace, job, _, _ = owned
    path, snapshot = publish(owned)
    if case == "wrong_issue":
        snapshot["task"]["issue"] = 658
    if case == "wrong_revision":
        snapshot["task"]["revision"] = "0" * 64
    if case == "wrong_base":
        snapshot["base_sha"] = "a" * 40
    if case == "wrong_head":
        snapshot["task"]["evidence"] = ["candidate-head:" + "b" * 40]
    if case == "stale":
        snapshot["captured_at"] -= 901
    path.write_text(json.dumps(snapshot))
    if case == "duplicate":
        path.write_text('{"task":{},"task":{}}')
    if case == "symlink":
        path.rename(path.with_name("original.json"))
        path.symlink_to("original.json")
    if case == "writable":
        config.neptune_intake_dir.chmod(0o755)
    with (
        pytest.raises(NeptuneIntakeUnavailable),
        accepted_verification(config, job, workspace, {Path("docs/case.md")}),
    ):
        pytest.fail("Unaccepted input entered verification")


def test_locked_reference_and_live_intake_mutation_cannot_pass(owned):
    checkpoint(owned)
    config, workspace, job, _, _ = owned
    path, snapshot = publish(owned)
    with accepted_verification(config, job, workspace, {Path("docs/case.md")}):
        pass
    locked = job.neptune_contract_sha
    snapshot["task"]["acceptance"] = ["Weaker target"]
    path.write_text(json.dumps(snapshot))
    with (
        pytest.raises(NeptuneIntakeUnavailable),
        accepted_verification(config, job, workspace, {Path("docs/case.md")}),
    ):
        pass
    assert job.neptune_contract_sha == locked
    path, _ = publish(owned)
    with (
        pytest.raises(NeptuneIntakeUnavailable),
        accepted_verification(config, job, workspace, {Path("docs/case.md")}),
    ):
        path.write_text("{}")


def test_unexpected_feature_failure_stays_a_verification_failure(owned):
    checkpoint(owned)
    config, workspace, job, _, _ = owned
    publish(owned)
    with (
        pytest.raises(VerificationFailed, match="deliberate divergence") as caught,
        accepted_verification(config, job, workspace, {Path("docs/case.md")}),
    ):
        raise VerificationFailed("deliberate divergence")
    assert not isinstance(caught.value, NeptuneIntakeUnavailable)


def test_missing_snapshot_is_infrastructure_not_paid_quality_repair():
    assert classify_failure(str(NeptuneIntakeUnavailable("missing snapshot"))) == "infrastructure"


def test_bound_receipt_requires_task_and_every_named_comparison(tmp_path):
    command = commands_for(tmp_path, {Path("docs/case.md")}, "neptune")[0]
    names = [
        "input-tooling",
        "film-contracts",
        "catalogue-tests",
        "catalogue-validation",
        "factory-contracts",
        "gate-contracts",
    ]
    binding = {"head": "a" * 40, "base": "b" * 40, "issue": 657}
    feature = {"behaviour-trace-exact-v1": {"contract": "c" * 64}}
    command = replace(
        command, neptune_binding_json=json.dumps(binding), neptune_features_json=json.dumps(feature)
    )
    report = {
        "schema": "neptune.factory-verification.v1",
        "conclusion": "success",
        "task_binding": binding,
        "identity": {"head": "a" * 40, "base": "b" * 40, "selected_contents_sha256": "d" * 64},
        "plan": {"paths": ["docs/case.md"], "mode": "metadata", "required": names},
        "checks": {
            name: {"status": "success", "exit": 0, "command": ["owned-check"]} for name in names
        },
        "feature_requirements": feature,
        "feature_checks": {
            "behaviour-trace-exact-v1": {
                "status": "success",
                "artifacts": feature["behaviour-trace-exact-v1"],
                "comparison": {"match": True},
            }
        },
    }
    _validate_neptune_receipt("NEPTUNE_FACTORY_VERIFICATION=" + json.dumps(report), command)
    for key in ("task_binding", "feature_checks", "feature_requirements"):
        changed = dict(report)
        changed.pop(key)
        with pytest.raises(VerificationFailed):
            _validate_neptune_receipt(
                "NEPTUNE_FACTORY_VERIFICATION=" + json.dumps(changed), command
            )
    report["feature_checks"]["behaviour-trace-exact-v1"]["comparison"]["match"] = False
    with pytest.raises(VerificationFailed):
        _validate_neptune_receipt("NEPTUNE_FACTORY_VERIFICATION=" + json.dumps(report), command)


def test_private_registry_configuration_cannot_select_a_source_tree(neptune_environment):
    from openhands_factory.config import FactoryConfig
    from openhands_factory.exceptions import ConfigurationError

    for path in ("relative", neptune_environment["FACTORY_REPOSITORY"] + "/accepted"):
        neptune_environment["FACTORY_NEPTUNE_INTAKE_DIR"] = path
        with pytest.raises(ConfigurationError):
            FactoryConfig.from_environment(neptune_environment)


def test_missing_input_keeps_same_job_out_of_paid_repair(owned):
    from types import MethodType

    _, _, job, workflow, controller = owned
    controller._verify = MethodType(FactoryPipeline._verify, controller)
    controller._restart_stale_unpublished = lambda *args: False
    with pytest.raises(NeptuneIntakeUnavailable):
        FactoryPipeline._verify_or_schedule_quality_repair(controller, job, workflow)
    assert job.state is JobState.VERIFYING
    assert job.quality_repairs == job.repair_attempts == 0
    assert controller.jobs.load()[job.task.identifier].verification_candidate_sha


@pytest.mark.parametrize("change", ["stale", "registry", "head"])
def test_coordinator_or_identity_changes_take_precedence_over_paid_repair(
    owned, monkeypatch, change
):
    checkpoint(owned)
    config, workspace, job, _, _ = owned
    path, snapshot = publish(owned)
    with (
        pytest.raises(NeptuneIntakeUnavailable),
        accepted_verification(config, job, workspace, {Path("docs/case.md")}),
    ):
        if change == "stale":
            monkeypatch.setattr(module.time, "time", lambda: snapshot["captured_at"] + 901)
        elif change == "registry":
            path.write_text("{}")
        else:
            git(workspace, "commit", "--allow-empty", "-qm", "fixture: concurrent candidate")
        raise VerificationFailed("child failed while acceptance inputs changed")
