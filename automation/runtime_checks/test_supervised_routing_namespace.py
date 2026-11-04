"""Mandatory actual namespace tests for the supervised entrypoint, no models."""

import os
import shutil
import subprocess
import sys
import time
from datetime import UTC, datetime
from pathlib import Path

import pytest

from openhands_factory.agents.process import agent_process_isolation_probe
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.session_identity import SessionIdentityJournal
from openhands_factory.session_supervision import SessionSupervisor


def test_namespace_bootstrap_survives_masking_the_coordinator_python_home(tmp_path, monkeypatch):
    supported, reason = agent_process_isolation_probe()
    assert supported, "Required supervised containment unavailable: " + reason
    home = tmp_path / "home"
    home.mkdir()
    runtime = home / "coordinator-python"
    shutil.copy2("/usr/bin/python3", runtime)
    assert subprocess.run([str(runtime), "-I", "-c", "pass"], timeout=5).returncode == 0
    monkeypatch.setattr(sys, "executable", str(runtime))
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    store = ProviderCapacityStore(tmp_path / "broker", max_lease_seconds=3900)
    store.path.parent.mkdir()
    supervisor = SessionSupervisor(store, SessionIdentityJournal(tmp_path / "identities"))
    supervisor.acquire("codex", "fixture", limit=1, wait_seconds=0)
    try:
        worker = (
            "import os;from pathlib import Path;assert os.getppid()==1;"
            f"assert not Path({str(supervisor.journal.directory)!r}).exists();"
            f"assert not Path({str(store.path)!r}).exists();print('started',end='')"
        )
        result = supervisor.runner("codex", "fixture").run(
            ["/usr/bin/python3", "-c", worker],
            cwd=workspace,
            env={"HOME": str(home), "PATH": os.defpath},
            stdin_text=None,
            timeout_seconds=8,
            max_output_bytes=4096,
        )
        assert result.exit_code == 0 and result.stdout == "started", result.stderr
    finally:
        supervisor.release("codex", "fixture")


def test_owner_death_retains_shared_lease_and_fresh_observer_cannot_adopt_it(tmp_path):
    supported, reason = agent_process_isolation_probe()
    assert supported, "Required supervised containment unavailable: " + reason
    workspace = tmp_path / "workspace"
    workspace.mkdir()
    home = tmp_path / "home"
    home.mkdir()
    marker = workspace / "heartbeat"
    worker_source = (
        "import time\nfrom pathlib import Path\n"
        f"p=Path({str(marker)!r});end=time.monotonic()+20\n"
        "while time.monotonic()<end:p.write_text(str(time.monotonic()));time.sleep(0.02)"
    )
    source = f"""
import os,sys
from pathlib import Path
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.session_identity import SessionIdentityJournal
from openhands_factory.session_supervision import SessionSupervisor
root=Path(sys.argv[1])
store=ProviderCapacityStore(root/'broker',max_lease_seconds=3900)
store.path.parent.mkdir()
s=SessionSupervisor(store,SessionIdentityJournal(root/'identities'),lease_seconds=12,guard_timeout_seconds=0.5)
s.acquire('codex','owned',limit=1,wait_seconds=0)
code={worker_source!r}
s.runner('codex','owned').run(
    ['/usr/bin/python3','-c',code],cwd=root/'workspace',
    env={{'HOME':str(root/'home'),'PATH':os.defpath}},stdin_text=None,
    timeout_seconds=25,max_output_bytes=4096)
"""
    owner = subprocess.Popen(
        [sys.executable, "-c", source, str(tmp_path)],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        env={**os.environ, "PYTHONPATH": str(Path(__file__).parents[1])},
    )
    try:
        deadline = time.monotonic() + 8
        while not marker.exists() and owner.poll() is None and time.monotonic() < deadline:
            time.sleep(0.03)
        assert marker.exists(), owner.communicate(timeout=2)
        reader = ProviderCapacityStore(tmp_path / "broker", max_lease_seconds=3900)
        assert reader.snapshot()["codex"] == 1
        owner.kill()
        owner.communicate(timeout=5)
        journal = SessionIdentityJournal(tmp_path / "identities")
        records = list(journal.directory.glob("*.json"))
        assert len(records) == 1
        before = reader.path.read_bytes()
        checkpoint = journal.load(records[0].stem)
        deadline = time.monotonic() + 4
        while checkpoint.guardian.matches_live() and time.monotonic() < deadline:
            time.sleep(0.03)
        assert not checkpoint.guardian.matches_live()
        assert reader.path.read_bytes() == before
        recovered = SessionSupervisor(reader, journal)
        with pytest.raises(ProviderCapacityUnavailable):
            recovered.acquire("codex", "fresh-owner", limit=1, wait_seconds=0)
        time.sleep(2.5)  # Existing namespace init grace is two seconds.
        stamp = marker.read_text()
        time.sleep(0.15)
        assert marker.read_text() == stamp, "Worker outlived owner containment"
    finally:
        if owner.poll() is None:
            owner.kill()
        owner.communicate(timeout=5)


def test_neptune_daemon_routes_supervised_retries_after_generation_rebuild(neptune_config):
    """Actual daemon/router/namespace path, benign CLI and private broker only."""
    from openhands_factory.agents.base import (
        AgentPhase,
        AgentRequest,
        ProviderHealth,
        ProviderStatus,
    )
    from openhands_factory.agents.cli import CLIProvider
    from openhands_factory.daemon import FactoryDaemon
    from openhands_factory.models import Job, Task

    supported, reason = agent_process_isolation_probe()
    assert supported, "Required daemon containment unavailable: " + reason
    daemon = FactoryDaemon(neptune_config)
    initial = daemon.pipeline.router.session_supervisor
    assert initial is not None
    journal = initial.journal

    class BenignCLI(CLIProvider):
        name = "codex"
        default_command = "/usr/bin/python3"
        attempts = 0

        def health(self):
            return ProviderHealth(self.name, ProviderStatus.HEALTHY, datetime.now(UTC))

        def build_command(self, request, model, prompt_path):
            self.attempts += 1
            reader = ProviderCapacityStore(
                neptune_config.provider_capacity_dir,
                max_lease_seconds=daemon.pipeline.router.capacity_store.max_lease_seconds,
            )
            assert reader.snapshot() == {"codex": 1}
            script = (
                "import os;from pathlib import Path;assert os.getppid()==1;"
                "assert 'GITHUB_TOKEN' not in os.environ;"
                f"assert not Path({str(journal.directory)!r}).exists();"
                f"assert not Path({str(reader.path)!r}).exists();"
            )
            script += "raise SystemExit(1)" if self.attempts == 1 else "print('fixture success')"
            return ["/usr/bin/python3", "-c", script]

    for index in range(2):
        if index:
            daemon._activate_generation()
        router = daemon.pipeline.router
        supervisor = router.session_supervisor
        assert supervisor is not None and supervisor.journal is journal
        provider = BenignCLI(model="fixture")
        router.providers = {"codex": provider}
        task = Task(str(9812 + index), "Namespace transport fixture", "", "github-issue", 1)
        job = Job(task=task)
        result = router.run(
            AgentRequest(
                AgentPhase.IMPLEMENTATION, task, "local fixture", neptune_config.repository
            ),
            job,
        )
        assert result.success and result.attempt == 2 and len(job.provider_history) == 2
        assert supervisor.store.snapshot() == {"codex": 0}
        records = [journal.load(p.stem) for p in journal.directory.glob("*.json")]
        assert len(records) == 2 * (index + 1)
        assert all(not record.guardian.matches_live() for record in records)
        owners = {record.lease.owner for record in records}
        assert len(owners) == index + 1
        for owner in owners:
            attempts = [record for record in records if record.lease.owner == owner]
            assert len(attempts) == 2 and attempts[0].lease == attempts[1].lease
            assert attempts[0].guardian != attempts[1].guardian
