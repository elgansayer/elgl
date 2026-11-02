"""Fresh coordinator imports must not execute optional agent SDK startup code."""

import json
import os
import subprocess
import sys
from pathlib import Path

import pytest


@pytest.mark.parametrize("block_optional", [True, False])
def test_fresh_cli_doctor_canary_imports_preserve_environment_without_sdk(
    tmp_path: Path, block_optional: bool
) -> None:
    source = Path(__file__).resolve().parents[1]
    (tmp_path / ".env").write_text("PORT=owned-sentinel\nOWNED_IMPORT_SENTINEL=loaded\n")
    home = tmp_path / "home"
    home.mkdir()
    # No real credential, provider/model or control configuration in the child.
    environment = {"HOME": str(home), "PATH": os.defpath, "LANG": "C.UTF-8"}
    script = r"""
import importlib.abc,json,os,sys
sys.path.insert(0,sys.argv[1])
blocked=("openhands", "litellm", "dotenv")
class NoOptionalSDK(importlib.abc.MetaPathFinder):
    def find_spec(self,fullname,path=None,target=None):
        if any(fullname==name or fullname.startswith(name+".") for name in blocked):
            raise AssertionError("CLI readiness attempted optional SDK import: "+fullname)
if sys.argv[2]=="True":sys.meta_path.insert(0,NoOptionalSDK())
before=dict(os.environ)
from openhands_factory import cli, doctor, canary
assert cli.parser().parse_args(["sessions","audit"]).command=="sessions"
assert doctor.leaked_port_environment_check().passed
assert "OWNED_IMPORT_SENTINEL" not in os.environ
assert dict(os.environ)==before, "Coordinator import changed the caller environment"
assert not any(n==p or n.startswith(p+".") for n in sys.modules for p in blocked)
print(json.dumps({"sdk_loaded":False,"environment_unchanged":True,"provider_calls":0}))
"""
    result = subprocess.run(
        [sys.executable, "-I", "-c", script, str(source), str(block_optional)],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        timeout=30,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert json.loads(result.stdout) == {
        "sdk_loaded": False,
        "environment_unchanged": True,
        "provider_calls": 0,
    }


def test_sdk_tools_retain_the_existing_container_helper_api() -> None:
    # Explicit SDK use remains supported; re-exports retain the same helpers.
    from openhands_factory import secure_tools, worker_container

    for name in (
        "podman_run_arguments",
        "podman_configuration_error",
        "resource_limit_error",
        "namespace_error",
    ):
        assert getattr(secure_tools, name) is getattr(worker_container, name)
