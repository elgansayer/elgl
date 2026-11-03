"""Mandatory actual namespaces; no media, credentials, models or external network."""

import hashlib
import json
import os
import select
import signal
import socketserver
import subprocess
import sys
import threading
import time
from pathlib import Path

import pytest

from openhands_factory.preparation_sandbox import run_preparation


@pytest.fixture
def roots(tmp_path):
    work, cache = tmp_path / "work", tmp_path / "cache"
    work.mkdir()
    cache.mkdir()
    (work / "source").mkdir()
    return work, cache


def test_actual_preparation_masks_host_state_env_and_keeps_source_readonly(
    roots, tmp_path, monkeypatch
):
    work, cache = roots
    secret = tmp_path / "host-only-owned-sentinel"
    secret.write_text("owned test content")
    (work / "source/accepted.txt").write_text("accepted")
    monkeypatch.setenv("GITHUB_TOKEN", "owned-github-sentinel")
    monkeypatch.setenv("OPENAI_API_KEY", "owned-api-sentinel")
    script = f"""
import hashlib,json,os
from pathlib import Path
source=Path({str(work / "source/accepted.txt")!r})
readonly=False
try:source.write_text('changed')
except OSError:readonly=True
Path({str(cache / "owned-output")!r}).write_text('prepared')
status=Path('/proc/self/status').read_text()
extra=[]
for name in os.listdir('/proc/self/fd'):
 if int(name)>2:
  try:os.readlink('/proc/self/fd/'+name)
  except OSError:continue
  extra.append(int(name))
print(json.dumps({{'source_readonly':readonly,'host_sentinel_visible':Path({str(secret)!r}).exists(),
'host_parent_visible':Path('/proc/{os.getpid()}/stat').exists(),
'github_present':'GITHUB_TOKEN' in os.environ,'api_present':'OPENAI_API_KEY' in os.environ,
'caps':next(line.split()[1] for line in status.splitlines() if line.startswith('CapEff:')),
'resolv_sha256':hashlib.sha256(Path('/etc/resolv.conf').read_bytes()).hexdigest(),
'extra_descriptors':extra,
'uid_map':Path('/proc/self/uid_map').read_text().split()}}))
"""
    result = run_preparation(
        ("/usr/bin/python3", "-c", script),
        work=work,
        cache=cache,
        network=True,
        timeout=10,
    )
    assert result.returncode == 0, result.stderr
    observed = json.loads(result.stdout)
    assert observed == {
        "source_readonly": True,
        "host_sentinel_visible": False,
        "host_parent_visible": False,
        "github_present": False,
        "api_present": False,
        "caps": "0000000000000000",
        "resolv_sha256": hashlib.sha256(Path("/etc/resolv.conf").read_bytes()).hexdigest(),
        "extra_descriptors": [],
        "uid_map": ["0", str(os.getuid()), "1"],
    }
    assert (cache / "owned-output").read_text() == "prepared"
    assert (work / "source/accepted.txt").read_text() == "accepted"


@pytest.mark.parametrize("network", [False, True])
def test_only_networked_preparation_can_reach_owned_host_socket(roots, network):
    work, cache = roots

    class Reply(socketserver.BaseRequestHandler):
        def handle(self):
            self.request.sendall(b"owned")

    with socketserver.TCPServer(("127.0.0.1", 0), Reply) as server:
        worker = threading.Thread(target=server.serve_forever, kwargs={"poll_interval": 0.05})
        worker.start()
        try:
            script = f"""
import json,socket
reachable=False
try:
 with socket.create_connection(('127.0.0.1',{server.server_address[1]}),timeout=0.3) as channel:
  reachable=channel.recv(5)==b'owned'
except OSError:pass
print(json.dumps({{'reachable':reachable}}))
"""
            result = run_preparation(
                ("/usr/bin/python3", "-c", script),
                work=work,
                cache=cache,
                network=network,
                timeout=10,
            )
            assert result.returncode == 0, result.stderr
            assert json.loads(result.stdout) == {"reachable": network}
        finally:
            server.shutdown()
            worker.join(timeout=2)
            assert not worker.is_alive()


def test_preparation_timeout_drains_detached_namespace_descendant(roots):
    work, cache = roots
    marker = cache / "heartbeat"
    descendant = (
        "import os,time;from pathlib import Path;os.setsid();"
        f"marker=Path({str(marker)!r})\n"
        "while True:marker.touch();time.sleep(0.02)"
    )
    parent = (
        "import subprocess,time;"
        f"subprocess.Popen(['/usr/bin/python3','-c',{descendant!r}]);time.sleep(30)"
    )
    with pytest.raises(subprocess.TimeoutExpired):
        run_preparation(
            ("/usr/bin/python3", "-c", parent),
            work=work,
            cache=cache,
            network=True,
            timeout=1,
        )
    assert marker.exists(), "Descendant must actually have run before timeout"
    before = marker.stat().st_mtime_ns
    time.sleep(0.2)
    assert marker.stat().st_mtime_ns == before


@pytest.mark.parametrize("fault", ["owner", "guardian"])
def test_actual_owner_or_guardian_death_stops_preparation_before_restart(roots, tmp_path, fault):
    work, cache = roots
    registration, heartbeat = tmp_path / "guardian.pid", cache / "heartbeat"
    descendant = (
        "import ctypes,os,time;from pathlib import Path;os.setsid();"
        "ctypes.CDLL(None).prctl(1,0,0,0,0);"
        f"marker=Path({str(heartbeat)!r})\n"
        "while True:marker.touch();time.sleep(0.02)"
    )
    command = (
        "import subprocess,time;"
        f"subprocess.Popen(['/usr/bin/python3','-c',{descendant!r}]);time.sleep(30)"
    )
    source = f"""
from pathlib import Path
from openhands_factory.preparation_sandbox import run_preparation
def started(pid):Path({str(registration)!r}).write_text(str(pid))
run_preparation(('/usr/bin/python3','-c',{command!r}),work=Path({str(work)!r}),
 cache=Path({str(cache)!r}),network=True,timeout=20,on_start=started)
"""
    owner = subprocess.Popen(
        [sys.executable, "-c", source],
        cwd=Path(__file__).parents[1],
        env={"PATH": os.defpath, "PYTHONPATH": str(Path(__file__).parents[1])},
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        start_new_session=True,
    )
    handles = {}
    try:
        deadline = time.monotonic() + 8
        while not heartbeat.exists() and time.monotonic() < deadline:
            assert owner.poll() is None, owner.communicate()
            time.sleep(0.02)
        assert heartbeat.exists() and registration.exists()
        guardian = int(registration.read_text())
        parents = {}
        for path in Path("/proc").glob("[0-9]*/stat"):
            try:
                fields = path.read_text().rsplit(") ", 1)[1].split()
                parents[int(path.parent.name)] = int(fields[1])
            except (OSError, ValueError, IndexError):
                continue
        owned = {owner.pid}
        while new := {pid for pid, parent in parents.items() if parent in owned} - owned:
            owned |= new
        assert guardian in owned and len(owned) >= 5, "Real namespace tree was not established"
        for pid in owned:
            handles[pid] = os.pidfd_open(pid)
        target = owner.pid if fault == "owner" else guardian
        signal.pidfd_send_signal(handles[target], signal.SIGKILL)
        poller = select.poll()
        for descriptor in handles.values():
            poller.register(descriptor, select.POLLIN)
        remaining = set(handles.values())
        deadline = time.monotonic() + 8
        while remaining and time.monotonic() < deadline:
            for descriptor, event in poller.poll(100):
                if event & select.POLLIN:
                    remaining.discard(descriptor)
                    poller.unregister(descriptor)
        assert not remaining, "An owned preparation process survived owner/guardian loss"
        before = heartbeat.stat().st_mtime_ns
        time.sleep(0.05)
        assert heartbeat.stat().st_mtime_ns == before
        owner.wait(timeout=5)
    finally:
        for descriptor in handles.values():
            os.close(descriptor)
        if owner.poll() is None:
            owner.kill()
        owner.wait(timeout=5)
        owner.communicate(timeout=5)
