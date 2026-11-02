"""Real owned Git/process contracts; fixture tools are not Godot installation proof."""

import hashlib
import inspect
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

from openhands_factory import neptune_preparation as module
from openhands_factory.host_resource_gate import HostResourceGate
from openhands_factory.neptune_preparation import ToolPreparationUnavailable, prepare_native
from openhands_factory.repository_guard import ProcessResult
from openhands_factory.verification import commands_for

VERSION = "owned-native-fixture"
BINARY = b"#!/bin/sh\nprintf 'owned-native-fixture\\n'\n"
PROVISION = r"""
import argparse,hashlib,json,os,time
from pathlib import Path
root=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser()
for key in ('tool','cache','evidence','timeout'):parser.add_argument('--'+key,required=True)
args=parser.parse_args();cache=Path(args.cache);evidence=Path(args.evidence);evidence.mkdir()
counter=cache/'fixture-installs'
counter.write_text(str(int(counter.read_text())+1 if counter.exists() else 1))
mode=json.loads((root/'tools/factory/scenario.json').read_text())['mode']
if mode=='fail':raise SystemExit(7)
if mode=='partial':print('NEPTUNE_TOOL_READY={}');raise SystemExit(0)
def sha(path):return hashlib.sha256(path.read_bytes()).hexdigest()
paths=('tools/factory/provision.py','tools/factory/provision_probe.py','tools/godot/install.py','tools/godot/toolchain.json')
recipe=json.loads((root/'tools/factory/provision-lock.json').read_text())['tools']['godot']
inputs={'tool':'godot','recipe':recipe,'installer_sources':{p:sha(root/p) for p in paths}}
key=hashlib.sha256(json.dumps(inputs,sort_keys=True).encode()).hexdigest()
target=cache/('godot-'+key)
if target.exists():target.rename(cache/('preserved-'+str(time.time_ns())))
target.mkdir()
lock=json.loads((root/'tools/godot/toolchain.json').read_text())
binary=target/lock['binary_name'];binary.write_bytes((root/'tools/godot/fixture-binary').read_bytes());binary.chmod(0o700)
smoke={'scope':'version and pinned addon identity only','version':lock['godot_version']}
receipt={'schema':'neptune.tool-install.v1','tool':'godot','recipe_sha256':key,'inputs':inputs,'binary_sha256':lock['binary_sha256'],'smoke':smoke,'conclusion':'success'}
if mode=='bad_identity':receipt['recipe_sha256']='0'*64
if mode=='bad_binary':binary.write_text('corrupt')
if mode=='fifo':binary.unlink();os.mkfifo(binary)
receipt_path=target/'receipt.json';receipt_path.write_text(json.dumps(receipt))
if mode=='linked_receipt':
 receipt_path.rename(target/'original-receipt');receipt_path.symlink_to('original-receipt')
report={**receipt,'directory':str(target),'binary':str(binary),'receipt_sha256':sha(receipt_path),'reused':False}
if mode=='wrong_directory':report['directory']=str(cache.parent)
if mode=='wrong_hash':report['receipt_sha256']='0'*64
print('NEPTUNE_TOOL_READY='+json.dumps(report))
if mode=='duplicate':print('NEPTUNE_TOOL_READY='+json.dumps(report))
"""
PLAN = r"""
import json,sys
paths=[p for p in sys.argv if p.startswith('--changed-path=')]
native=any(not p.startswith('--changed-path=docs/') for p in paths)
print('NEPTUNE_FACTORY_REQUIREMENTS='+json.dumps({'schema':'neptune.factory-requirements.v1','native':{'required':native}}))
"""


def git(root, *arguments):
    return subprocess.check_output(["git", *arguments], cwd=root, stderr=subprocess.PIPE, text=True)


def plain_owned_process(arguments, *, work, cache, network, timeout, on_start=None):
    """Trusted fixture children only; namespace containment is tested separately."""
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
def fixture(tmp_path, neptune_config, monkeypatch):
    repository = tmp_path / "neptune-trusted"
    repository.mkdir()
    git(repository, "init", "-q")
    git(repository, "config", "user.name", "Owned fixture")
    git(repository, "config", "user.email", "owned@example.invalid")
    data = {
        "tools/factory/provision.py": PROVISION,
        "tools/factory/provision_probe.py": "# owned fixture\n",
        "tools/factory/verify.py": PLAN,
        "tools/factory/provision-lock.json": json.dumps(
            {
                "tools": {
                    "godot": {
                        "kind": "godot-locked",
                        "platform": "linux-x86_64",
                        "minimum_free_bytes": 512 * 1024**2,
                    }
                }
            }
        ),
        "tools/factory/scenario.json": '{"mode":"normal"}',
        "tools/godot/install.py": "# owned fixture\n",
        "tools/godot/fixture-binary": BINARY.decode(),
        "addons/fixture.so": "owned addon",
    }
    data["tools/godot/toolchain.json"] = json.dumps(
        {
            "binary_name": "owned-native",
            "binary_sha256": hashlib.sha256(BINARY).hexdigest(),
            "godot_version": VERSION,
            "addons": {"addons/fixture.so": hashlib.sha256(b"owned addon").hexdigest()},
        }
    )
    for relative, text in data.items():
        path = repository / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text)
    git(repository, "add", ".")
    git(repository, "commit", "-qm", "owned trusted tools")
    base = git(repository, "rev-parse", "HEAD").strip()
    git(repository, "update-ref", "refs/remotes/origin/main", base)
    workspace = tmp_path / "candidate"
    git(repository, "worktree", "add", "-qb", "candidate", str(workspace), base)
    config = neptune_config.model_copy(
        update={
            "repository": repository,
            "state_dir": tmp_path / "neptune-state",
            "provider_capacity_dir": tmp_path / "capacity",
            "minimum_free_disk_gib": 1,
        }
    )
    config.provider_capacity_dir.mkdir()
    gate = HostResourceGate(config.provider_capacity_dir / "host-resource-gate.json", 1)
    monkeypatch.setattr(module, "run_preparation", plain_owned_process)
    yield config, workspace, gate


def prepare(fixture, *, paths=None):
    config, workspace, gate = fixture
    paths = paths or {Path("player.gd")}
    commands = commands_for(workspace, paths, "neptune")
    with gate.exclusive():
        return prepare_native(config, workspace, paths, commands)


def journals(config):
    return [
        json.loads(p.read_text()) for p in (config.state_dir / "tool-preparation").glob("*.json")
    ]


def set_mode(fixture, mode):
    config, _workspace, _ = fixture
    path = config.repository / "tools/factory/scenario.json"
    path.write_text(json.dumps({"mode": mode}))
    git(config.repository, "add", ".")
    git(config.repository, "commit", "-qm", "owned fixture mode")
    git(config.repository, "update-ref", "refs/remotes/origin/main", "HEAD")


def test_missing_tool_installs_then_fresh_observer_revalidates_reuses(fixture):
    config, workspace, _ = fixture
    (workspace / "tools/factory/provision.py").write_text(
        "raise RuntimeError('candidate executed')"
    )
    first = prepare(fixture)
    prepared = Path(first[0].arguments[first[0].arguments.index("--toolchain") + 1])
    assert prepared.is_relative_to(config.repository / ".factory-tools/prepared")
    assert (
        subprocess.check_output([str(prepared / "owned-native"), "--version"], text=True).strip()
        == VERSION
    )
    second = prepare(fixture)
    assert (
        first[0].arguments[first[0].arguments.index("--toolchain") + 1]
        == second[0].arguments[second[0].arguments.index("--toolchain") + 1]
    )
    assert (prepared.parent / "fixture-installs").read_text() == "1"
    assert [row["status"] for row in journals(config)] == ["ready", "ready"]
    assert all(row["model_calls"] == 0 for row in journals(config))
    assert all(not p.exists() for p in (config.state_dir / "tool-preparation").glob("*/source"))


@pytest.mark.parametrize(
    "mode",
    [
        "fail",
        "partial",
        "duplicate",
        "bad_identity",
        "bad_binary",
        "fifo",
        "linked_receipt",
        "wrong_directory",
        "wrong_hash",
    ],
)
def test_failed_or_forged_preparation_never_grants_readiness(fixture, mode):
    set_mode(fixture, mode)
    with pytest.raises(ToolPreparationUnavailable):
        prepare(fixture)
    config, _, _ = fixture
    assert journals(config)[0]["status"] == "failed"


def test_corrupt_generation_is_preserved_and_repaired_once(fixture):
    first = prepare(fixture)
    directory = Path(first[0].arguments[first[0].arguments.index("--toolchain") + 1])
    (directory / "owned-native").write_text("corrupt")
    prepare(fixture)
    assert (directory.parent / "fixture-installs").read_text() == "2"
    preserved = list(directory.parent.glob("preserved-*"))
    assert len(preserved) == 1 and (preserved[0] / "owned-native").read_text() == "corrupt"


def test_valid_legacy_cache_is_copied_smoked_and_never_rewritten(fixture):
    config, _, _ = fixture
    legacy = config.repository / ".factory-tools/godot"
    legacy.mkdir(parents=True)
    binary = legacy / "owned-native"
    binary.write_bytes(BINARY)
    binary.chmod(0o700)
    before = binary.stat()
    first = prepare(fixture)
    second = prepare(fixture)
    assert binary.read_bytes() == BINARY and binary.stat().st_ino == before.st_ino
    assert (
        first[0].arguments[first[0].arguments.index("--toolchain") + 1]
        == second[0].arguments[second[0].arguments.index("--toolchain") + 1]
    )
    assert not list((legacy.parent / "prepared").glob("fixture-installs"))
    assert all(row["reused_legacy"] for row in journals(config))


def test_metadata_does_not_install_or_change_command(fixture):
    config, workspace, _ = fixture
    paths = {Path("docs/plan.md")}
    commands = commands_for(workspace, paths, "neptune")
    _, _, gate = fixture
    with gate.exclusive():
        assert prepare_native(config, workspace, paths, commands) == commands
    assert journals(config)[0]["status"] == "not_required"


def test_absent_host_admission_and_changed_candidate_lock_are_refused(fixture):
    config, workspace, _ = fixture
    with pytest.raises(ToolPreparationUnavailable, match="exclusive_host_lane_required"):
        prepare_native(config, workspace, {Path("player.gd")}, [])
    (workspace / "tools/godot/toolchain.json").write_text("{}")
    with pytest.raises(ToolPreparationUnavailable, match="candidate_toolchain_differs"):
        prepare(fixture)


def test_interruption_preserves_diagnostic_then_retry_completes(fixture, monkeypatch):
    original = module.run_preparation

    def interrupt(arguments, **kwargs):
        if kwargs["network"]:
            raise KeyboardInterrupt()
        return original(arguments, **kwargs)

    monkeypatch.setattr(module, "run_preparation", interrupt)
    with pytest.raises(KeyboardInterrupt):
        prepare(fixture)
    config, _, _ = fixture
    assert journals(config)[0]["status"] == "interrupted"
    monkeypatch.setattr(module, "run_preparation", original)
    prepare(fixture)
    assert {row["status"] for row in journals(config)} == {"interrupted", "ready"}


def test_fresh_coordinator_process_revalidates_existing_generation(fixture, tmp_path):
    config, workspace, _ = fixture
    selected = prepare(fixture)
    config_path = tmp_path / "owned-config.json"
    # Test-only credentials are masked by Pydantic; no provider/API call occurs.
    config_path.write_text(config.model_dump_json())
    script = (
        "import json,os,resource,subprocess,sys;from pathlib import Path\n"
        "from openhands_factory.config import FactoryConfig\n"
        "from openhands_factory.repository_guard import ProcessResult\n"
        "from openhands_factory.host_resource_gate import HostResourceGate\n"
        "from openhands_factory.verification import commands_for\n"
        "from openhands_factory import neptune_preparation as module\n"
        + inspect.getsource(plain_owned_process)
        + "\nmodule.run_preparation=plain_owned_process\n"
        "resource.setrlimit(resource.RLIMIT_FSIZE,(64*1024**2,64*1024**2))\n"
        "before_limit=resource.getrlimit(resource.RLIMIT_FSIZE)\n"
        "config=FactoryConfig.model_validate_json(Path(sys.argv[1]).read_text())\n"
        "workspace=Path(sys.argv[2]);paths={Path('player.gd')}\n"
        "gate=HostResourceGate(config.provider_capacity_dir/'host-resource-gate.json',1)\n"
        "commands=commands_for(workspace,paths,'neptune')\n"
        "with gate.exclusive():\n"
        " result=module.prepare_native(config,workspace,paths,commands)\n"
        "print(json.dumps({'arguments':list(result[0].arguments),'pid':os.getpid(),"
        "'limits_preserved':before_limit==resource.getrlimit(resource.RLIMIT_FSIZE)}))\n"
    )
    output = subprocess.check_output(
        [sys.executable, "-c", script, str(config_path), str(workspace)],
        cwd=Path(__file__).parents[1],
        timeout=20,
        env={"PATH": os.defpath, "PYTHONPATH": str(Path(__file__).parents[1])},
        text=True,
    )
    observed = json.loads(output)
    assert observed["pid"] != os.getpid()
    assert observed["limits_preserved"]
    assert (
        observed["arguments"][observed["arguments"].index("--toolchain") + 1]
        == selected[0].arguments[selected[0].arguments.index("--toolchain") + 1]
    )
    cache = config.repository / ".factory-tools/prepared"
    assert (cache / "fixture-installs").read_text() == "1"
    assert {row["coordinator_pid"] for row in journals(config)} == {os.getpid(), observed["pid"]}


def test_busy_preparation_does_not_duplicate_install(fixture):
    from filelock import FileLock

    config, _, _ = fixture
    cache = config.repository / ".factory-tools/prepared"
    cache.mkdir(parents=True, mode=0o700)
    with (
        FileLock(str(cache / "coordinator.lock")),
        pytest.raises(ToolPreparationUnavailable, match="busy"),
    ):
        prepare(fixture)
    assert not (cache / "fixture-installs").exists()


@pytest.mark.parametrize("redirect_parent", [False, True])
def test_candidate_symlink_cannot_redirect_toolchain_read(fixture, tmp_path, redirect_parent):
    _, workspace, _ = fixture
    original = workspace / "tools/godot/toolchain.json"
    if redirect_parent:
        source = workspace / "tools/godot"
        source.rename(tmp_path / "redirected")
        source.symlink_to(tmp_path / "redirected", target_is_directory=True)
    else:
        original.unlink()
        original.symlink_to(tmp_path / "unread-owned-secret")
    with pytest.raises(ToolPreparationUnavailable):
        prepare(fixture)


def test_disk_reserve_blocks_before_install(fixture, monkeypatch):
    from types import SimpleNamespace

    monkeypatch.setattr(module.shutil, "disk_usage", lambda _path: SimpleNamespace(free=0))
    with pytest.raises(ToolPreparationUnavailable, match="snapshot_disk_budget"):
        prepare(fixture)
    config, _, _ = fixture
    assert journals(config)[0]["status"] == "failed"
    assert not (config.repository / ".factory-tools/prepared/fixture-installs").exists()


def test_recipe_timeout_is_infrastructure_and_retry_can_reuse_job(fixture, monkeypatch):
    original = module.run_preparation

    def timeout(arguments, **kwargs):
        if kwargs["network"]:
            raise subprocess.TimeoutExpired(["owned fixture"], 1)
        return original(arguments, **kwargs)

    monkeypatch.setattr(module, "run_preparation", timeout)
    with pytest.raises(ToolPreparationUnavailable, match="timed_out"):
        prepare(fixture)
    monkeypatch.setattr(module, "run_preparation", original)
    prepare(fixture)
    config, _, _ = fixture
    assert {row["status"] for row in journals(config)} == {"failed", "ready"}


@pytest.mark.parametrize("required", [None, "false", 0])
def test_unknown_native_requirement_never_becomes_not_required(fixture, monkeypatch, required):
    original = module.run_preparation

    def invalid(arguments, **kwargs):
        if "--plan" in arguments:
            data = {"schema": "neptune.factory-requirements.v1", "native": {"required": required}}
            return ProcessResult(0, "NEPTUNE_FACTORY_REQUIREMENTS=" + json.dumps(data), "")
        return original(arguments, **kwargs)

    monkeypatch.setattr(module, "run_preparation", invalid)
    with pytest.raises(ToolPreparationUnavailable):
        prepare(fixture)
