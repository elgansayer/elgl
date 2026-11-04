"""Trusted native-tool preparation and same-job offline verification resumption."""

from __future__ import annotations

import hashlib
import json
import os
import re
import resource
import shutil
import stat
import subprocess
import tarfile
from collections.abc import Callable
from dataclasses import asdict, replace
from pathlib import Path, PurePosixPath
from typing import Any
from uuid import uuid4

from filelock import FileLock, Timeout

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import VerificationFailed
from openhands_factory.host_resource_gate import HostResourceGate
from openhands_factory.preparation_sandbox import run_preparation
from openhands_factory.session_identity import ProcessIdentity
from openhands_factory.state import atomic_write_json
from openhands_factory.verification import VerificationCommand

_MAX_JSON = 1024 * 1024
_MAX_SOURCE = 256 * 1024**2
_LOCK = "tools/godot/toolchain.json"
_INSTALLER_SOURCES = (
    "tools/factory/provision.py",
    "tools/factory/provision_probe.py",
    "tools/godot/install.py",
    _LOCK,
)
_PROBE = r"""
import hashlib,json,os,subprocess,sys
from pathlib import Path
root,binary=map(Path,sys.argv[1:])
lock=json.loads((root/'tools/godot/toolchain.json').read_text())
def sha(path):
 with path.open('rb') as stream:return hashlib.file_digest(stream,'sha256').hexdigest()
assert sha(binary)==lock['binary_sha256'] and os.access(binary,os.X_OK)
for relative,expected in lock['addons'].items():assert sha(root/relative)==expected
version=subprocess.check_output([str(binary),'--headless','--version'],text=True,timeout=20).strip()
assert version==lock['godot_version']
print(json.dumps({'version':version,'binary_sha256':sha(binary),'addon_count':len(lock['addons'])}))
"""


class ToolPreparationUnavailable(VerificationFailed):
    def __init__(self, kind: str) -> None:
        self.kind = kind
        super().__init__("Tool preparation unavailable: " + kind)


def _unique(pairs: list[tuple[str, object]]) -> dict[str, object]:
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate preparation JSON field")
        result[key] = value
    return result


def _document(raw: bytes) -> dict[str, Any]:
    if len(raw) > _MAX_JSON:
        raise ValueError("Preparation JSON exceeds bound")
    value = json.loads(raw, object_pairs_hook=_unique)
    if not isinstance(value, dict):
        raise ValueError("Preparation JSON must be an object")
    return value


def _regular(path: Path) -> bytes:
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, "rb") as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1 or info.st_size > _MAX_JSON:
            raise ValueError("Unsafe preparation receipt")
        raw = source.read(_MAX_JSON + 1)
    if len(raw) > _MAX_JSON:
        raise ValueError("Preparation receipt exceeds bound")
    return raw


def _sha(path: Path) -> str:
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def _relative(value: object) -> str:
    if not isinstance(value, str) or not value or len(value) > 1024:
        raise ValueError("Missing portable preparation path")
    path = PurePosixPath(value)
    if (
        value == "."
        or path.is_absolute()
        or ".." in path.parts
        or path.as_posix() != value
        or "\\" in value
        or ":" in value
        or any(ord(c) < 32 or ord(c) == 127 for c in value)
    ):
        raise ValueError("Unsafe preparation path")
    return value


def _git(repository: Path, *args: str) -> bytes:
    command = ["git", *args]
    if args[0] == "archive":
        inherited = resource.getrlimit(resource.RLIMIT_FSIZE)
        bound = min(
            [_MAX_SOURCE, *(limit for limit in inherited if limit != resource.RLIM_INFINITY)]
        )
        command = ["/usr/bin/prlimit", f"--fsize={bound}", "--", *command]
    result = subprocess.run(
        command,
        cwd=repository,
        capture_output=True,
        timeout=30,
        check=True,
        env={
            "PATH": os.defpath,
            "HOME": "/nonexistent",
            "GIT_CONFIG_NOSYSTEM": "1",
            "GIT_CONFIG_GLOBAL": "/dev/null",
            "GIT_TERMINAL_PROMPT": "0",
        },
    )
    if len(result.stdout) > _MAX_JSON:
        raise ValueError("Preparation Git metadata exceeds bound")
    return result.stdout


def _snapshot(repository: Path, source: Path, base: str, lock: dict[str, Any]) -> None:
    addons = lock.get("addons")
    if not isinstance(addons, dict) or not 0 < len(addons) <= 32:
        raise ValueError("Missing bounded native addon identities")
    paths = ["tools", *(_relative(path) for path in addons)]
    archive = source.parent / "source.tar"
    _git(repository, "archive", "--format=tar", "--output=" + str(archive), base, "--", *paths)
    if archive.stat().st_size > _MAX_SOURCE:
        raise ValueError("Preparation source exceeds bound")
    source.mkdir(mode=0o700)
    total = 0
    with tarfile.open(archive) as incoming:
        for member in incoming:
            relative = _relative(member.name.rstrip("/"))
            destination = source / relative
            if member.isdir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            if not member.isfile() or member.size < 0:
                raise ValueError("Preparation source contains links or special files")
            total += member.size
            if total > _MAX_SOURCE:
                raise ValueError("Preparation extracted source exceeds bound")
            destination.parent.mkdir(parents=True, exist_ok=True)
            stream = incoming.extractfile(member)
            if stream is None:
                raise ValueError("Missing archived preparation source")
            with stream, destination.open("xb") as output:
                shutil.copyfileobj(stream, output)
            destination.chmod(0o600 | (member.mode & 0o111))
    archive.unlink()


def _expected(source: Path, lock: dict[str, Any]) -> tuple[dict[str, Any], str]:
    recipe = _document(_regular(source / "tools/factory/provision-lock.json"))["tools"]["godot"]
    if (
        set(recipe) != {"kind", "platform", "minimum_free_bytes"}
        or recipe["kind"] != "godot-locked"
        or recipe["platform"] != "linux-x86_64"
        or type(recipe["minimum_free_bytes"]) is not int
        or not 512 * 1024**2 <= recipe["minimum_free_bytes"] <= 16 * 1024**3
    ):
        raise ValueError("Unsupported trusted Godot recipe")
    name, digest = lock.get("binary_name"), lock.get("binary_sha256")
    if (
        _relative(name) != name
        or "/" in name
        or not isinstance(digest, str)
        or not re.fullmatch(r"[a-f0-9]{64}", digest)
        or not isinstance(lock.get("godot_version"), str)
    ):
        raise ValueError("Invalid trusted Godot identity")
    record = {
        "tool": "godot",
        "recipe": recipe,
        "installer_sources": {path: _sha(source / path) for path in _INSTALLER_SOURCES},
    }
    key = hashlib.sha256(json.dumps(record, sort_keys=True).encode()).hexdigest()
    return record, key


def _probe(
    work: Path,
    cache: Path,
    binary: Path,
    lock: dict[str, Any],
    on_start: Callable[[int], None],
) -> None:
    result = run_preparation(
        ("/usr/bin/python3", "-I", str(work / "probe.py"), str(work / "source"), str(binary)),
        work=work,
        cache=cache,
        network=False,
        timeout=30,
        on_start=on_start,
    )
    if result.returncode or _document(result.stdout.encode()) != {
        "version": lock["godot_version"],
        "binary_sha256": lock["binary_sha256"],
        "addon_count": len(lock["addons"]),
    }:
        raise ToolPreparationUnavailable("runtime_smoke_failed")


def _validate_target(
    target: Path, inputs: dict[str, Any], key: str, lock: dict[str, Any]
) -> tuple[dict[str, Any], str]:
    if target.is_symlink() or not target.is_dir():
        raise ValueError("Unsafe prepared generation")
    binary = target / str(lock["binary_name"])
    info = binary.lstat()
    if not stat.S_ISREG(info.st_mode) or info.st_nlink != 1:
        raise ValueError("Unsafe prepared executable")
    receipt_raw = _regular(target / "receipt.json")
    receipt = _document(receipt_raw)
    expected = {
        "schema": "neptune.tool-install.v1",
        "tool": "godot",
        "recipe_sha256": key,
        "inputs": inputs,
        "binary_sha256": lock["binary_sha256"],
        "smoke": {
            "scope": "version and pinned addon identity only",
            "version": lock["godot_version"],
        },
        "conclusion": "success",
    }
    if receipt != expected or _sha(binary) != lock["binary_sha256"]:
        raise ValueError("Prepared receipt/binary identity mismatch")
    return expected, hashlib.sha256(receipt_raw).hexdigest()


def _require_host_lane(config: FactoryConfig) -> None:
    gate = HostResourceGate(config.provider_capacity_dir / "host-resource-gate.json", 1)
    with gate.lock:
        state = gate._load_active()
        writer = state["exclusive"]
        if not isinstance(writer, dict) or writer.get("pid") != os.getpid() or state["shared"]:
            raise ToolPreparationUnavailable("exclusive_host_lane_required")


def prepare_native(
    config: FactoryConfig,
    workspace: Path,
    changed: set[Path],
    commands: list[VerificationCommand],
) -> list[VerificationCommand]:
    """Called inside the existing exclusive host lane, never a new scheduler.

    Journal each operation before execution. Retry/restart repeats validation and
    the existing recipe's fenced install/reuse, preserving incomplete evidence.
    No candidate source or issue command is executed with network access.
    """
    _require_host_lane(config)
    workspace = workspace.resolve()
    repository = config.repository.resolve()
    records = config.state_dir.resolve() / "tool-preparation"
    records.mkdir(mode=0o700, parents=True, exist_ok=True)
    operation = uuid4().hex
    work = records / operation
    work.mkdir(mode=0o700)
    journal = records / (operation + ".json")
    report: dict[str, object] = {
        "schema": "repo-factory.native-preparation.v1",
        "tool": "godot",
        "workspace_sha256": hashlib.sha256(str(workspace).encode()).hexdigest(),
        "status": "planning",
        "model_calls": 0,
        "coordinator_pid": os.getpid(),
    }
    guardians: list[dict[str, object]] = []
    report["guardians"] = guardians

    def started(pid: int) -> None:
        # Fsync exact process identity before the guardian's first dispatch pulse.
        guardians.append(asdict(ProcessIdentity.capture(pid)))
        atomic_write_json(journal, report)

    atomic_write_json(journal, report)
    cache = repository / ".factory-tools" / "prepared"
    try:
        base = (
            _git(repository, "rev-parse", "refs/remotes/origin/" + config.base_branch)
            .decode()
            .strip()
        )
        if not re.fullmatch(r"[a-f0-9]{40}", base):
            raise ValueError("Missing trusted main identity")
        if not 0 < int(_git(repository, "cat-file", "-s", base + ":" + _LOCK)) <= _MAX_JSON:
            raise ValueError("Trusted toolchain metadata exceeds bound")
        lock_bytes = _git(repository, "show", base + ":" + _LOCK)
        lock = _document(lock_bytes)
        report["trusted_base"] = base
        if shutil.disk_usage(work).free < int(config.minimum_free_disk_gib * 1024**3) + _MAX_SOURCE:
            raise ToolPreparationUnavailable("snapshot_disk_budget")
        _snapshot(repository, work / "source", base, lock)
        cache.mkdir(mode=0o700, parents=True, exist_ok=True)
        if (
            cache.is_symlink()
            or cache.stat().st_uid != os.geteuid()
            or cache.stat().st_mode & 0o022
        ):
            raise ValueError("Unsafe coordinator cache")
        (work / "probe.py").write_text(_PROBE)
        with FileLock(str(cache / "coordinator.lock"), timeout=0):
            # Plan from the accepted snapshot, not the branch that asks for tools.
            plan_result = run_preparation(
                (
                    "/usr/bin/python3",
                    str(work / "source/tools/factory/verify.py"),
                    "--plan",
                    *("--changed-path=" + str(path) for path in sorted(changed)),
                ),
                work=work,
                cache=cache,
                network=False,
                timeout=30,
                on_start=started,
            )
            prefix = "NEPTUNE_FACTORY_REQUIREMENTS="
            markers = [
                line[len(prefix) :]
                for line in plan_result.stdout.splitlines()
                if line.startswith(prefix)
            ]
            if plan_result.returncode or len(markers) != 1:
                raise ToolPreparationUnavailable("requirements_unavailable")
            requirements = _document(markers[0].encode())
            if requirements.get("schema") != "neptune.factory-requirements.v1":
                raise ValueError("Incompatible trusted requirements")
            if requirements["native"]["required"] is False:
                report.update(status="not_required", requirements=requirements)
                atomic_write_json(journal, report)
                return commands
            if requirements["native"]["required"] is not True:
                raise ValueError("Unknown native requirement")
            candidate_lock = workspace / _LOCK
            if any(
                parent.is_symlink()
                for parent in candidate_lock.parents
                if parent.is_relative_to(workspace)
            ):
                raise ToolPreparationUnavailable("unsafe_candidate_toolchain")
            if _regular(candidate_lock) != lock_bytes:
                raise ToolPreparationUnavailable("candidate_toolchain_differs_from_trusted_recipe")
            inputs, key = _expected(work / "source", lock)
            target = cache / ("godot-" + key)
            binary = target / str(lock["binary_name"])
            try:
                _, receipt_sha = _validate_target(target, inputs, key, lock)
            except (OSError, ValueError):
                pass
            else:
                _probe(work, cache, binary, lock, started)
                report.update(
                    status="ready",
                    directory=str(target),
                    reused=True,
                    recipe_sha256=key,
                    receipt_sha256=receipt_sha,
                )
                atomic_write_json(journal, report)
                return _toolchain(commands, target)
            # The approved legacy cache remains untouched. Copy a valid binary
            # into this operation for an isolated smoke, avoiding a mutable alias.
            legacy = repository / ".factory-tools/godot" / str(lock["binary_name"])
            if (
                not target.exists()
                and legacy.is_file()
                and not legacy.is_symlink()
                and _sha(legacy) == lock["binary_sha256"]
            ):
                legacy_copy = cache / ("godot-legacy-" + str(lock["binary_sha256"]))
                created = not legacy_copy.exists()
                if created:
                    if (
                        shutil.disk_usage(cache).free
                        < int(config.minimum_free_disk_gib * 1024**3) + legacy.stat().st_size
                    ):
                        raise ToolPreparationUnavailable("legacy_copy_disk_budget")
                    legacy_copy.mkdir(mode=0o700)
                try:
                    local_binary = legacy_copy / str(lock["binary_name"])
                    if created:
                        shutil.copy2(legacy, local_binary)
                    _probe(work, cache, local_binary, lock, started)
                    report.update(
                        status="ready",
                        directory=str(legacy_copy),
                        reused_legacy=True,
                        binary_sha256=lock["binary_sha256"],
                    )
                    atomic_write_json(journal, report)
                    return _toolchain(commands, legacy_copy)
                except BaseException:
                    # Preserve existing generations; clean only this failed new
                    # copy, which has never been published to a verifier.
                    if created:
                        shutil.rmtree(legacy_copy)
                    raise
            reserve = int(config.minimum_free_disk_gib * 1024**3)
            if shutil.disk_usage(cache).free < reserve + inputs["recipe"]["minimum_free_bytes"]:
                raise ToolPreparationUnavailable("disk_budget")
            report.update(status="preparing", recipe_sha256=key, directory=str(target))
            atomic_write_json(journal, report)
            result = run_preparation(
                (
                    "/usr/bin/python3",
                    str(work / "source/tools/factory/provision.py"),
                    "--tool",
                    "godot",
                    "--cache",
                    str(cache),
                    "--evidence",
                    str(work / "install"),
                    "--timeout",
                    "300",
                ),
                work=work,
                cache=cache,
                network=True,
                timeout=330,
                on_start=started,
            )
            (work / "command.stdout").write_text(result.stdout[:_MAX_JSON])
            (work / "command.stderr").write_text(result.stderr[:_MAX_JSON])
            ready_prefix = "NEPTUNE_TOOL_READY="
            rows = [
                line[len(ready_prefix) :]
                for line in result.stdout.splitlines()
                if line.startswith(ready_prefix)
            ]
            if result.returncode or len(rows) != 1:
                raise ToolPreparationUnavailable("recipe_failed")
            ready = _document(rows[0].encode())
            expected, receipt_sha = _validate_target(target, inputs, key, lock)
            if (
                any(ready.get(k) != v for k, v in expected.items())
                or ready.get("directory") != str(target)
                or ready.get("binary") != str(binary)
                or ready.get("receipt_sha256") != receipt_sha
            ):
                raise ToolPreparationUnavailable("invalid_receipt")
            _probe(work, cache, binary, lock, started)
            report.update(
                status="ready", receipt_sha256=ready["receipt_sha256"], reused=ready.get("reused")
            )
            atomic_write_json(journal, report)
            return _toolchain(commands, target)
    except BaseException as error:
        report.update(
            status="interrupted" if not isinstance(error, Exception) else "failed",
            error_type=type(error).__name__,
            error_kind=getattr(error, "kind", None),
        )
        atomic_write_json(journal, report)
        if isinstance(error, ToolPreparationUnavailable) or not isinstance(error, Exception):
            raise
        if isinstance(error, Timeout):
            raise ToolPreparationUnavailable("busy") from error
        if isinstance(error, subprocess.TimeoutExpired):
            raise ToolPreparationUnavailable("timed_out") from error
        if isinstance(
            error,
            (
                OSError,
                ValueError,
                KeyError,
                TypeError,
                subprocess.SubprocessError,
                Timeout,
                tarfile.TarError,
            ),
        ):
            raise ToolPreparationUnavailable("preparation_or_validation_failed") from error
        raise
    finally:
        # These are reconstructible accepted Git files, never unique research or
        # candidate work. Preserve journals, installer logs and all cache outputs.
        shutil.rmtree(work / "source", ignore_errors=True)
        (work / "source.tar").unlink(missing_ok=True)


def _toolchain(commands: list[VerificationCommand], directory: Path) -> list[VerificationCommand]:
    result = []
    for command in commands:
        if command.name != "neptune-acceptance":
            result.append(command)
            continue
        arguments = list(command.arguments)
        if arguments.count("--toolchain") != 1:
            raise ToolPreparationUnavailable("missing_toolchain_argument")
        arguments[arguments.index("--toolchain") + 1] = str(directory)
        result.append(replace(command, arguments=tuple(arguments)))
    return result
