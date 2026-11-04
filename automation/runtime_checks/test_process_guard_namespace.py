"""Mandatory host-kernel integration, executed explicitly by the required CI job.

The ordinary Factory verifier is itself capability-restricted; it runs tests/
while this suite needs a host with unprivileged user/PID/mount namespaces.
Unavailable containment is a failure here, never a passing substitute.
"""

import os
import signal
import subprocess
import sys
import time
import uuid
from contextlib import suppress
from pathlib import Path

import pytest

from openhands_factory.agents.process import agent_process_isolation_probe


def _wait_file(path, *, parent=None, timeout=8):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if path.exists():
            return path.read_text()
        if parent is not None and parent.poll() is not None:
            raise AssertionError(f"fixture stopped before registration: {parent.communicate()}")
        time.sleep(0.03)
    raise AssertionError(f"fixture did not register {path.name}")


def _alive(pid):
    try:
        stat = Path(f"/proc/{pid}/stat").read_text()
    except FileNotFoundError:
        return False
    return stat.rsplit(")", 1)[1].split()[0] != "Z"


@pytest.mark.parametrize("fault", ["owner-kill", "guardian-kill", "owner-stop"])
def test_real_namespace_contains_descendants_that_escape_groups_and_clear_pdeathsig(
    tmp_path, fault
):
    supported, reason = agent_process_isolation_probe()
    assert supported, "Mandatory namespace integration cannot run: " + reason
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    token = "np538" + uuid.uuid4().hex[:7]
    names = {token + "p", token + "c"}
    model = workspace / "owned_fixture.py"
    model.write_text(f"""
import ctypes,os,signal,time
from pathlib import Path
lib=ctypes.CDLL(None)
lib.prctl(1,0,0,0,0) # The untrusted participant clears its own parent-death signal.
try:
    os.kill(1,signal.SIGKILL)
except PermissionError:
    pass
# Same-namespace SIGKILL can also succeed as a syscall while being ignored by
# the kernel for PID1. Prove that init survives rather than requiring EPERM.
os.kill(1,0)
Path({str(workspace / "init-protected")!r}).touch()
child=os.fork()
suffix='p'
if child==0:
    os.setsid() # Escape the provider's original process group.
    suffix='c'
lib.prctl(15,({token!r}+suffix).encode(),0,0,0)
index=0
while True:
    Path({str(workspace)!r},suffix+'.counter').write_text(str(index))
    index+=1
    time.sleep(.03)
""")
    driver = """
import sys
from pathlib import Path
from openhands_factory.agents.process import AgentProcessRunner,provider_environment
root=Path(sys.argv[1]);workspace=root/'workspace'
def started(pid): (root/'guardian.pid').write_text(str(pid))
result=AgentProcessRunner(guard_timeout_seconds=1,on_start=started).run(
    ['/usr/bin/python3','-I',str(workspace/'owned_fixture.py')],cwd=workspace,
    env=provider_environment(),stdin_text=None,timeout_seconds=15,max_output_bytes=4096)
(root/'result').write_text(str(result))
"""
    environment = {
        **os.environ,
        "PYTHONPATH": str(Path(__file__).parents[1]),
        "FACTORY_REPOSITORY": str(workspace),
        "FACTORY_STATE_DIR": str(tmp_path / "private-state"),
        "FACTORY_LOG_DIR": str(tmp_path / "private-log"),
    }
    parent = subprocess.Popen(
        [sys.executable, "-c", driver, str(tmp_path)],
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    descriptors = [os.pidfd_open(parent.pid)]
    try:
        guardian = int(_wait_file(tmp_path / "guardian.pid", parent=parent))
        descriptors.append(os.pidfd_open(guardian))
        for suffix in ("p", "c"):
            _wait_file(workspace / (suffix + ".counter"), parent=parent)
        assert (workspace / "init-protected").exists()
        pids = []
        for entry in Path("/proc").iterdir():
            if not entry.name.isdecimal():
                continue
            with suppress(FileNotFoundError, PermissionError, ProcessLookupError):
                if (entry / "comm").read_text().strip() in names:
                    pids.append(int(entry.name))
                    descriptors.append(os.pidfd_open(int(entry.name)))
        assert len(pids) == 2, "Both actual namespace participants must have started"
        before = [(workspace / (suffix + ".counter")).read_text() for suffix in ("p", "c")]
        time.sleep(0.15)
        assert all(
            (workspace / (suffix + ".counter")).read_text() != value
            for suffix, value in zip(("p", "c"), before, strict=True)
        )
        target = parent.pid if fault.startswith("owner") else guardian
        os.kill(target, signal.SIGSTOP if fault.endswith("stop") else signal.SIGKILL)
        deadline = time.monotonic() + 7
        while any(_alive(pid) for pid in pids) and time.monotonic() < deadline:
            time.sleep(0.03)
        assert not any(_alive(pid) for pid in pids), (
            "An escaped participant survived supervision loss"
        )
    finally:
        for descriptor in descriptors:
            with suppress(ProcessLookupError):
                signal.pidfd_send_signal(descriptor, signal.SIGKILL)
            os.close(descriptor)
        parent.communicate(timeout=5)
