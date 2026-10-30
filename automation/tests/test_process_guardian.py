"""Real process faults; no provider credentials, vendor requests or paid workers."""

import json
import os
import signal
import subprocess
import sys
import time
import uuid
from contextlib import suppress
from pathlib import Path

import pytest

from openhands_factory.agents.process import (
    AgentProcessRunner,
    agent_process_isolation_probe,
    provider_environment,
)
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.provider_capacity import ProviderCapacityStore


def run_guarded(tmp_path, script, **options):
    runner = AgentProcessRunner(isolate_processes=False, guard_timeout_seconds=1, **options)
    return runner.run(
        [sys.executable, "-c", script],
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text=None,
        timeout_seconds=8,
        max_output_bytes=16384,
    )


def test_real_guard_preserves_input_output_exit_and_hides_control_channel(tmp_path):
    runner = AgentProcessRunner(isolate_processes=False, guard_timeout_seconds=2)
    result = runner.run(
        [
            sys.executable,
            "-c",
            "import sys,os; print(sys.stdin.read()); print('error',file=sys.stderr); sys.exit(7)",
        ],
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text="operator input",
        timeout_seconds=5,
        max_output_bytes=4096,
    )
    assert result.exit_code == 7
    assert result.stdout.strip() == "operator input"
    assert result.stderr.strip() == "error"
    assert not result.cancelled and not result.timed_out


def test_guard_never_leaks_its_control_or_lifetime_socket_to_worker(tmp_path):
    result = run_guarded(
        tmp_path,
        """
import os
sockets=[]
for name in os.listdir('/proc/self/fd'):
    try: target=os.readlink('/proc/self/fd/'+name)
    except OSError: continue
    if target.startswith('socket:'): sockets.append(target)
print(len(sockets))
""",
    )
    assert result.exit_code == 0 and result.stdout.strip() == "0"


def test_lease_refusal_prevents_worker_dispatch(tmp_path):
    marker = tmp_path / "must-not-run"

    def refuse():
        raise ProviderCapacityUnavailable("no owned slot", retry_after_seconds=1)

    with pytest.raises(ProviderCapacityUnavailable):
        run_guarded(
            tmp_path,
            f"from pathlib import Path; Path({str(marker)!r}).touch()",
            heartbeat_check=refuse,
        )
    assert not marker.exists()


def test_lost_private_lease_stops_worker_without_claiming_success(tmp_path):
    store = ProviderCapacityStore(tmp_path / "broker", max_lease_seconds=3900)
    handle = store.acquire_renewable("claude", owner="fixture:manual", limit=2)
    other = store.acquire_renewable("claude", owner="fixture:other", limit=2)
    reader = ProviderCapacityStore(tmp_path / "broker", max_lease_seconds=3900)
    checks = []
    marker = tmp_path / "started"

    def renew():
        assert reader.snapshot() == {"claude": 2}
        with pytest.raises(ProviderCapacityUnavailable):
            reader.acquire_renewable("claude", owner="fixture:third", limit=2)
        if marker.exists():
            raise ProviderCapacityUnavailable("ownership lost", retry_after_seconds=1)
        store.renew(handle)
        checks.append(True)

    result = run_guarded(
        tmp_path,
        f"""
import time,signal,sys
from pathlib import Path
signal.signal(signal.SIGTERM,lambda *args:sys.exit(0))
Path({str(marker)!r}).touch()
time.sleep(20)
""",
        heartbeat_check=renew,
    )
    assert marker.exists() and checks
    assert result.cancelled and result.exit_code != 0
    assert store.snapshot() == {"claude": 2}
    assert store.release_renewable(handle)
    assert reader.snapshot() == {"claude": 1}
    assert store.release_renewable(other)


def test_guarded_request_timeout_cannot_be_reported_as_success(tmp_path):
    result = AgentProcessRunner(isolate_processes=False, guard_timeout_seconds=2).run(
        [sys.executable, "-c", "import time; time.sleep(20)"],
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text=None,
        timeout_seconds=1,
        max_output_bytes=4096,
    )
    assert result.timed_out and result.exit_code != 0


def test_checkpoint_failure_happens_before_model_start(tmp_path):
    marker = tmp_path / "must-not-run"

    def cannot_persist(pid):
        raise OSError("checkpoint unavailable")

    with pytest.raises(OSError, match="checkpoint"):
        run_guarded(
            tmp_path,
            f"from pathlib import Path; Path({str(marker)!r}).touch()",
            on_start=cannot_persist,
        )
    assert not marker.exists()


@pytest.mark.parametrize("timeout", [0, -1, float("inf"), float("nan"), 31])
def test_invalid_guard_deadlines_cannot_start(timeout):
    with pytest.raises(ValueError):
        AgentProcessRunner(guard_timeout_seconds=timeout)


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


@pytest.mark.parametrize("fault", ["owner-kill", "owner-stop", "guardian-kill", "guardian-stop"])
def test_actual_owner_or_guardian_fault_stops_worker(tmp_path, fault):
    registration = tmp_path / "guardian.pid"
    marker = tmp_path / "worker.pid"
    script = """
import os,sys
from pathlib import Path
from openhands_factory.agents.process import AgentProcessRunner,provider_environment
root=Path(sys.argv[1])
def started(pid): (root/'guardian.pid').write_text(str(pid))
worker=("import os,time; from pathlib import Path; "
        "Path(%r).write_text(str(os.getpid())); time.sleep(30)") % str(root/'worker.pid')
result=AgentProcessRunner(isolate_processes=False,guard_timeout_seconds=1,on_start=started).run(
    [sys.executable,'-c',worker],cwd=root,env=provider_environment(),stdin_text=None,
    timeout_seconds=10,max_output_bytes=4096)
(root/'result.json').write_text(__import__('json').dumps({'exit':result.exit_code,'cancelled':result.cancelled}))
"""
    environment = {**os.environ, "PYTHONPATH": str(Path(__file__).parents[1])}
    parent = subprocess.Popen(
        [sys.executable, "-c", script, str(tmp_path)],
        env=environment,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    descriptors = []
    guardian = worker = None
    try:
        guardian = int(_wait_file(registration, parent=parent))
        worker = int(_wait_file(marker, parent=parent))
        descriptors = [os.pidfd_open(pid) for pid in (worker, guardian, parent.pid)]
        assert _alive(guardian) and _alive(worker)
        target = parent.pid if fault.startswith("owner") else guardian
        os.kill(target, signal.SIGKILL if fault.endswith("kill") else signal.SIGSTOP)
        deadline = time.monotonic() + 7
        while _alive(worker) and time.monotonic() < deadline:
            time.sleep(0.03)
        assert not _alive(worker), f"worker survived {fault}"
        if fault == "guardian-stop":
            receipt = json.loads(_wait_file(tmp_path / "result.json"))
            assert receipt["exit"] != 0 and receipt["cancelled"]
    finally:
        for descriptor in descriptors:
            with suppress(ProcessLookupError):
                signal.pidfd_send_signal(descriptor, signal.SIGKILL)
            os.close(descriptor)
        if not descriptors and parent.poll() is None:
            parent.kill()
        parent.communicate(timeout=5)


@pytest.mark.parametrize("fault", ["owner-kill", "guardian-kill", "owner-stop"])
def test_real_namespace_contains_descendants_that_escape_groups_and_clear_pdeathsig(
    tmp_path, fault
):
    supported, reason = agent_process_isolation_probe()
    if not supported:
        if os.environ.get("FACTORY_REQUIRE_GUARD_NAMESPACE_TESTS") == "1":
            pytest.fail(reason)
        pytest.skip("Target requires unprivileged namespaces: " + reason)
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
