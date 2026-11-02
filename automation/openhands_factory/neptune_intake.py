"""Bind an existing accepted task to a committed candidate in the existing verifier."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
import stat
import subprocess
import time
from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict, dataclass, replace
from pathlib import Path
from typing import Any
from uuid import uuid4

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import VerificationFailed
from openhands_factory.models import Job, Task
from openhands_factory.neptune_preparation import _document, _git, _snapshot
from openhands_factory.preparation_sandbox import run_preparation
from openhands_factory.session_identity import ProcessIdentity
from openhands_factory.state import atomic_write_json
from openhands_factory.verification import VerificationCommand

MAX_INTAKE = 256 * 1024
MAX_TRACE = 16 * 1024**2
NAME = "behaviour-trace-exact-v1"
CANDIDATE_MARKER = "candidate-head:"

# Executed with -I from a separate read-only coordinator mount. Candidate imports
# cannot replace the accepted comparator, parser or runner implementation.
ENTRY = r"""
import json,sys
from pathlib import Path
bundle,workspace=map(Path,sys.argv[1:3])
sys.path.insert(0,str(bundle/'source/tools/factory'))
import verify
import feature_contracts
intake=bundle/'inputs/intake.json'
snapshot,_=verify.read_intake(intake)
required=feature_contracts.requirements(snapshot['task'])
args=sys.argv[3:]
parser=__import__('argparse').ArgumentParser()
parser.add_argument('--evidence',type=Path,required=True)
parser.add_argument('--toolchain',type=Path,required=True)
parser.add_argument('--changed-path',action='append',required=True)
options=parser.parse_args(args)
try:
 result=verify.verify(options.changed_path,options.evidence,options.toolchain,
  root=workspace,intake=intake,feature_artifacts=bundle/'inputs/artifacts' if required else None)
 print('NEPTUNE_FACTORY_VERIFICATION='+json.dumps(result,sort_keys=True))
except (ValueError,OSError,KeyError,TypeError) as error:
 raise SystemExit('Accepted Neptune verification failed: '+str(error))
"""


class NeptuneIntakeUnavailable(VerificationFailed):
    def __init__(self, reason: str) -> None:
        super().__init__("Neptune accepted intake unavailable: " + reason)


def canonical(value: object) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), allow_nan=False)


def task_revision(task: Task, repository: str) -> str:
    return hashlib.sha256(
        canonical(
            {
                "repository": repository,
                "issue": int(task.identifier),
                "title": task.title,
                "body": task.body,
            }
        ).encode()
    ).hexdigest()


def _plain(path: Path, maximum: int) -> bytes:
    if any(parent.is_symlink() for parent in (path, *path.parents)):
        raise ValueError("Symlinked accepted input")
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, "rb") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > maximum:
            raise ValueError("Unsafe or oversized accepted input")
        raw = stream.read(maximum + 1)
    if len(raw) > maximum:
        raise ValueError("Accepted input exceeds bound")
    return raw


def _private(directory: Path) -> None:
    if not directory.is_absolute() or any(p.is_symlink() for p in (directory, *directory.parents)):
        raise ValueError("Accepted registry must be an absolute directory without symlinks")
    info = directory.stat()
    if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.geteuid() or info.st_mode & 0o077:
        raise ValueError("Accepted registry must be coordinator-owned and private")


def _target(task: dict[str, Any]) -> str:
    # A new candidate may have newly attested output identities. Reference bytes,
    # comparison rules and the issue revision remain locked across repairs.
    target = dict(task)
    target["evidence"] = [
        item
        for item in task["evidence"]
        if not item.startswith(
            (CANDIDATE_MARKER, "trace-v1:candidate-source:", "trace-v1:candidate-file:")
        )
    ]
    return hashlib.sha256(canonical(target).encode()).hexdigest()


@dataclass(frozen=True)
class AcceptedVerification:
    bundle: Path
    binding_json: str
    features_json: str

    def commands(self, commands: list[VerificationCommand]) -> list[VerificationCommand]:
        result = []
        for command in commands:
            if command.name != "neptune-acceptance" or command.workspace is None:
                raise NeptuneIntakeUnavailable("unexpected verification command")
            # Retain the existing toolchain/evidence/complete selection arguments.
            arguments = (
                "python3",
                "-I",
                str(self.bundle / "entry.py"),
                str(self.bundle),
                str(command.workspace),
                *command.arguments[2:],
            )
            result.append(
                replace(
                    command,
                    arguments=arguments,
                    exclusive=True,
                    read_only_inputs=(self.bundle,),
                    neptune_binding_json=self.binding_json,
                    neptune_features_json=self.features_json,
                )
            )
        return result


@contextmanager
def accepted_verification(
    config: FactoryConfig, job: Job, workspace: Path, changed: set[Path]
) -> Iterator[AcceptedVerification]:
    """Stage selected data only; retain a durable journal, never signing authority."""
    work = config.state_dir / "research-verification" / uuid4().hex
    journal = work / "journal.json"
    report: dict[str, Any] = {
        "schema": "neptune.accepted-verification.v1",
        "status": "staging",
        "job": job.task.identifier,
        "model_calls": 0,
    }
    try:
        if (
            config.repository_profile != "neptune"
            or config.neptune_intake_dir is None
            or job.task.source != "github-issue"
            or not re.fullmatch(r"[1-9][0-9]*", job.task.identifier)
        ):
            raise ValueError("require a configured accepted GitHub issue task")
        registry = config.neptune_intake_dir
        _private(registry)
        issue = registry / job.task.identifier
        _private(issue)
        raw = _plain(issue / "intake.json", MAX_INTAKE)
        snapshot = _document(raw)
        task = snapshot["task"]
        if (
            task["repository"] != config.github_repository
            or task["issue"] != int(job.task.identifier)
            or task["revision"] != task_revision(job.task, config.github_repository)
        ):
            raise ValueError("accepted repository/issue/revision differs from claimed task")
        base = _git(config.repository, "rev-parse", "refs/remotes/origin/main").decode().strip()
        head = _git(workspace, "rev-parse", "HEAD").decode().strip()
        if (
            snapshot["base_sha"] != base
            or job.verification_candidate_sha != head
            or [value for value in task["evidence"] if value.startswith(CANDIDATE_MARKER)]
            != [CANDIDATE_MARKER + head]
        ):
            raise ValueError("accepted base/candidate differs from committed job")
        target = _target(task)
        if job.neptune_contract_sha is not None and job.neptune_contract_sha != target:
            raise ValueError("accepted reference/target contract changed during this job")
        work.mkdir(parents=True, mode=0o700)
        report.update(
            base=base,
            head=head,
            target_sha256=target,
            intake_sha256=hashlib.sha256(raw).hexdigest(),
        )
        atomic_write_json(journal, report)
        lock = _document(_git(config.repository, "show", base + ":tools/godot/toolchain.json"))
        _snapshot(config.repository, work / "source", base, lock)
        inputs = work / "inputs"
        inputs.mkdir(mode=0o700)
        (inputs / "intake.json").write_bytes(raw)
        (work / "entry.py").write_text(ENTRY)
        # Parse using the accepted module in a separate isolated Python process,
        # before executing candidate commands. No issue-supplied shell is run.
        validator = r"""
import json,sys,time
from pathlib import Path
root,intake=map(Path,sys.argv[1:3]);sys.path.insert(0,str(root/'tools/factory'))
import readiness,feature_contracts
snapshot=json.loads(intake.read_text())
ready=readiness.evaluate(snapshot,time.time())
if not ready['ready']:raise SystemExit('; '.join(ready['reasons']))
print(json.dumps(feature_contracts.requirements(snapshot['task']),sort_keys=True))
"""
        cache = work.with_name(work.name + "-validation-cache")
        cache.mkdir(mode=0o700)

        def started(pid: int) -> None:
            report["guardian"] = asdict(ProcessIdentity.capture(pid))
            atomic_write_json(journal, report)

        result = run_preparation(
            (
                "/usr/bin/python3",
                "-I",
                "-c",
                validator,
                str(work / "source"),
                str(inputs / "intake.json"),
            ),
            work=work,
            cache=cache,
            network=False,
            timeout=20,
            on_start=started,
        )
        if result.returncode:
            raise ValueError("accepted readiness failed: " + result.stderr[-500:])
        if len(result.stdout) > MAX_INTAKE:
            raise ValueError("oversized accepted feature selection")
        features = _document(result.stdout.encode())
        if features:
            if set(features) != {NAME}:
                raise ValueError("unsupported named feature")
            destination = inputs / "artifacts" / NAME
            destination.mkdir(parents=True, mode=0o700)
            for role in ("reference", "candidate"):
                content = _plain(issue / "artifacts" / NAME / (role + ".json"), MAX_TRACE)
                if hashlib.sha256(content).hexdigest() != features[NAME][role + "-file"]:
                    raise ValueError("accepted artifact hash differs")
                (destination / (role + ".json")).write_bytes(content)
        binding = {
            "repository": task["repository"],
            "issue": task["issue"],
            "feature_id": task["feature_id"],
            "revision": task["revision"],
            "task_sha256": hashlib.sha256(canonical(task).encode()).hexdigest(),
            "intake_sha256": hashlib.sha256(raw).hexdigest(),
            "base": base,
            "head": head,
            "changed_paths": sorted(str(path) for path in changed),
        }
        report.update(status="verifying", binding=binding, features=features)
        atomic_write_json(journal, report)
        job.neptune_contract_sha = target
        yield AcceptedVerification(work, canonical(binding), canonical(features))
        if _plain(issue / "intake.json", MAX_INTAKE) != raw:
            raise ValueError("coordinator intake changed while verifying")
        for role in ("reference", "candidate") if features else ():
            if (
                hashlib.sha256(
                    _plain(issue / "artifacts" / NAME / (role + ".json"), MAX_TRACE)
                ).hexdigest()
                != features[NAME][role + "-file"]
            ):
                raise ValueError("coordinator artifacts changed while verifying")
        report["status"] = "verified"
    except (
        ValueError,
        OSError,
        KeyError,
        TypeError,
        subprocess.SubprocessError,
        VerificationFailed,
    ) as error:
        report.update(status="failed", error=type(error).__name__)
        if isinstance(error, VerificationFailed):
            raise
        raise NeptuneIntakeUnavailable(str(error)[:600]) from error
    finally:
        if work.exists():
            report["finished_at"] = time.time()
            atomic_write_json(journal, report)
            for name in ("source", "inputs"):
                shutil.rmtree(work / name, ignore_errors=True)
            shutil.rmtree(work.with_name(work.name + "-validation-cache"), ignore_errors=True)
            (work / "entry.py").unlink(missing_ok=True)
