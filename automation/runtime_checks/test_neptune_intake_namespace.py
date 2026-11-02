"""Actual accepted parser/comparer and namespaces; role-labelled synthetic traces only."""

import hashlib
import json
import os
import shutil
import subprocess
import time
from pathlib import Path

import pytest

from openhands_factory.git_workflow import GitWorkflow
from openhands_factory.models import Job, JobState, Task
from openhands_factory.neptune_intake import accepted_verification, canonical, task_revision
from openhands_factory.verification import (
    commands_for,
    run_isolated_verification_process,
    run_verification,
)

PIN = "8e94003417435ef396192dbf25ee6882fc3567a2"
NAME = "behaviour-trace-exact-v1"


def git(root, *arguments):
    return subprocess.check_output(
        ["git", *arguments], cwd=root, text=True, stderr=subprocess.PIPE
    ).strip()


def digest(value):
    return hashlib.sha256(canonical(value).encode()).hexdigest()


@pytest.fixture
def research(tmp_path, neptune_config, monkeypatch):
    source = Path(os.environ["NEPTUNE_ACCEPTED_SOURCE"])
    assert git(source, "rev-parse", "HEAD") == PIN
    repository = neptune_config.repository
    # Metadata fixture, not a game checkout. All parser/comparer/gate source blobs
    # are unchanged from the accepted pin; a non-native addon keeps snapshots small.
    for directory in ("tools", "docs/restart"):
        shutil.copytree(
            source / directory, repository / directory, ignore=shutil.ignore_patterns("__pycache__")
        )
    shutil.copy2(source / ".gitignore", repository / ".gitignore")
    lock_path = repository / "tools/godot/toolchain.json"
    lock = json.loads(lock_path.read_text())
    addon = repository / "fixtures/metadata-addon"
    addon.parent.mkdir()
    addon.write_text("owned non-native metadata fixture")
    lock["addons"] = {"fixtures/metadata-addon": hashlib.sha256(addon.read_bytes()).hexdigest()}
    lock_path.write_text(json.dumps(lock))
    algorithms = (
        "tools/factory/verify.py",
        "tools/factory/readiness.py",
        "tools/factory/feature_contracts.py",
        "tools/saturn_lab/compare_trace.py",
        "tools/merge_gate/run.py",
    )
    for relative in algorithms:
        assert (repository / relative).read_bytes() == (source / relative).read_bytes()
    git(repository, "init", "-qb", "main")
    git(repository, "config", "user.name", "Owned real integration")
    git(repository, "config", "user.email", "owned@example.invalid")
    git(repository, "add", ".")
    git(repository, "commit", "-qm", "fixture: pin real Neptune algorithms")
    base = git(repository, "rev-parse", "HEAD")
    git(repository, "update-ref", "refs/remotes/origin/main", base)
    workspace = neptune_config.worktree_dir / "657"
    workspace.parent.mkdir(parents=True)
    git(repository, "worktree", "add", "-qb", "factory/657-real", str(workspace))
    (workspace / "docs/case657.md").write_text("Synthetic supplied-trace integration only\n")
    workflow = GitWorkflow(workspace, "main")
    workflow.stage_all()
    workflow.commit("test: owned candidate checkpoint")
    registry = tmp_path / "private-accepted"
    registry.mkdir(mode=0o700)
    issue = registry / "657"
    issue.mkdir(mode=0o700)
    (issue / "signing-authority-not-for-verifier").write_text("owned sentinel, never a real key")
    config = neptune_config.model_copy(update={"neptune_intake_dir": registry})
    job = Job(
        Task("657", "Owned trace integration", "Synthetic fixture only", "github-issue", 0),
        state=JobState.VERIFYING,
        verification_candidate_sha=git(workspace, "rev-parse", "HEAD"),
    )
    for key, value in (
        ("FACTORY_REPOSITORY", repository),
        ("FACTORY_STATE_DIR", config.state_dir),
        ("FACTORY_LOG_DIR", config.log_dir),
    ):
        monkeypatch.setenv(key, str(value))
    monkeypatch.setenv("GITHUB_TOKEN", "owned-secret-sentinel")
    return source, config, workspace, job


def publish(research, divergent):
    _, config, _, job = research
    contract = {
        "scenario": "synthetic/factory-intake657",
        "ruleset": "owned-v1",
        "observation_schema": "owned-fixed-v1",
        "input_sha256": "a" * 64,
        "timebase": {"numerator": 60, "denominator": 1},
    }
    evidence = []
    target = config.neptune_intake_dir / "657/artifacts" / NAME
    target.mkdir(parents=True, exist_ok=True)
    for role, kind in (("reference", "reference"), ("candidate", "implementation")):
        value = {
            "schema": "neptune.behaviour-trace.v1",
            "contract": contract,
            "source": {
                "kind": kind,
                "build_sha256": "b" * 64,
                "input_lock_sha256": "c" * 64,
                "capture_sha256": "d" * 64,
                "adapter_sha256": "e" * 64,
            },
            "samples": [{"frame": i, "observations": {"x_fixed": i * 256}} for i in range(4)],
        }
        if role == "candidate" and divergent:
            value["samples"][1]["observations"]["x_fixed"] += 1
        path = target / (role + ".json")
        path.write_text(json.dumps(value))
        evidence.extend(
            [
                f"trace-v1:{role}-file:" + hashlib.sha256(path.read_bytes()).hexdigest(),
                f"trace-v1:{role}-source:" + digest(value["source"]),
            ]
        )
    evidence += [
        "trace-v1:contract:" + digest(contract),
        "candidate-head:" + job.verification_candidate_sha,
    ]
    task = {
        "repository": config.github_repository,
        "issue": 657,
        "feature_id": "RLAB-003",
        "revision": task_revision(job.task, config.github_repository),
        "kind": "research",
        "state": "open",
        "acceptance": ["check:" + NAME],
        "evidence": evidence,
        "prerequisites": [],
        "capabilities": [],
        "scope": {
            "goal": "Synthetic trace integration, no authenticity claim",
            "paths": ["docs/case657.md"],
            "max_files": 1,
        },
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
    (config.neptune_intake_dir / "657/intake.json").write_text(json.dumps(snapshot))


@pytest.mark.parametrize("divergent", [False, True])
def test_actual_accepted_algorithm_and_readonly_inputs(research, divergent, tmp_path):
    source, config, workspace, job = research
    publish(research, divergent)
    caught = None
    from openhands_factory.exceptions import VerificationFailed

    commands = commands_for(workspace, {Path("docs/case657.md")}, "neptune")
    try:
        with accepted_verification(config, job, workspace, {Path("docs/case657.md")}) as accepted:
            selected = accepted.commands(commands)
            if not divergent:
                sentinel = config.neptune_intake_dir / "657/signing-authority-not-for-verifier"
                probe = f"""
import json,os
from pathlib import Path
p=Path({str(accepted.bundle / "inputs/intake.json")!r})
readonly=False
try:p.write_text('changed')
except OSError:readonly=True
print(json.dumps({{'readonly':readonly,'authority_visible':Path({str(sentinel)!r}).exists(),
'credential_present':'GITHUB_TOKEN' in os.environ}}))
"""
                result = run_isolated_verification_process(
                    ("python3", "-c", probe),
                    workspace,
                    15,
                    workspace=workspace,
                    read_only_inputs=(accepted.bundle,),
                )
                assert result.returncode == 0, result.stderr
                assert json.loads(result.stdout) == {
                    "readonly": True,
                    "authority_visible": False,
                    "credential_present": False,
                }
            run_verification(selected)
    except VerificationFailed as error:
        caught = error
    evidence = Path(commands[0].arguments[commands[0].arguments.index("--evidence") + 1])
    report = json.loads((evidence / "report.json").read_text())
    feature = report["feature_checks"][NAME]
    assert (
        feature["comparer_sha256"]
        == hashlib.sha256((source / "tools/saturn_lab/compare_trace.py").read_bytes()).hexdigest()
    )
    assert feature["comparison"]["match"] is not divergent
    assert report["task_binding"]["head"] == job.verification_candidate_sha
    assert all(item["status"] == "success" for item in report["checks"].values())
    assert (caught is not None) is divergent
    if caught:
        assert "Required named feature comparison diverged" in str(caught)
    output = Path(os.environ.get("NEPTUNE_INTAKE_EVIDENCE", str(tmp_path / "evidence")))
    output.mkdir(parents=True, exist_ok=True)
    (output / ("divergent.json" if divergent else "matching.json")).write_text(
        json.dumps(report, indent=2)
    )
    journals = list((config.state_dir / "research-verification").glob("*/journal.json"))
    journal = json.loads(journals[0].read_text())
    assert journal["guardian"]["pid"] > 0
    assert journal["status"] == ("failed" if divergent else "verified")
    assert git(workspace, "status", "--porcelain") == ""
