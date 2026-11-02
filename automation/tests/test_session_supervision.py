"""Shared private stores and real benign processes; no vendor/auth calls.

The ordinary verifier cannot unshare. Its fixtures use the real bare guardian;
mandatory runtime_checks separately exercise the unchanged namespace boundary.
"""

import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime

import pytest

from openhands_factory.agents.base import AgentPhase, AgentRequest, ProviderHealth, ProviderStatus
from openhands_factory.agents.cli import CLIProvider
from openhands_factory.agents.process import provider_environment
from openhands_factory.agents.router import AgentRouter
from openhands_factory.exceptions import ConfigurationError, ProviderCapacityUnavailable
from openhands_factory.models import Job, Task
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.session_identity import SessionIdentityJournal
from openhands_factory.session_supervision import SessionSupervisor


@pytest.fixture
def supervisor(tmp_path):
    store = ProviderCapacityStore(tmp_path / "broker", max_lease_seconds=3900)
    store.path.parent.mkdir()
    return SessionSupervisor(store, SessionIdentityJournal(tmp_path / "identities"))


def bare_runner(supervisor, provider="codex", owner="fixture"):
    runner = supervisor.runner(provider, owner)
    assert runner.isolate_processes  # Production entrypoint has no isolation bypass.
    runner.isolate_processes = False  # Benign unit fixture inside the outer verifier.
    return runner


def execute(runner, tmp_path, script="print('owned')", timeout=8):
    return runner.run(
        [sys.executable, "-c", script],
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text=None,
        timeout_seconds=timeout,
        max_output_bytes=16384,
    )


def test_real_process_has_one_independently_counted_slot_and_private_checkpoint(
    supervisor, tmp_path
):
    supervisor.acquire("codex", "fixture", limit=1, wait_seconds=0)
    reader = ProviderCapacityStore(supervisor.store.path.parent, max_lease_seconds=3900)
    assert reader.snapshot()["codex"] == 1
    with pytest.raises(ProviderCapacityUnavailable):
        reader.acquire_renewable("codex", limit=1, owner="other")
    result = execute(bare_runner(supervisor), tmp_path)
    assert result.exit_code == 0 and result.stdout.strip() == "owned" and not result.cancelled
    records = list(supervisor.journal.directory.glob("*.json"))
    assert len(records) == 1
    record = supervisor.journal.load(records[0].stem)
    assert record.lease.owner == "fixture" and not record.guardian.matches_live()
    assert oct(records[0].stat().st_mode & 0o777) == "0o600"
    supervisor.release("codex", "fixture")
    supervisor.release("codex", "fixture")
    assert reader.snapshot()["codex"] == 0


def test_checkpoint_failure_cannot_dispatch_and_preserves_foreign_slot(
    supervisor, tmp_path, monkeypatch
):
    foreign = supervisor.store.acquire_renewable("codex", limit=2, owner="foreign")
    supervisor.acquire("codex", "fixture", limit=2, wait_seconds=0)
    marker = tmp_path / "must-not-start"

    def refuse(_checkpoint):
        raise PermissionError("private journal unavailable")

    monkeypatch.setattr(supervisor.journal, "create", refuse)
    with pytest.raises(PermissionError):
        execute(bare_runner(supervisor), tmp_path, f"open({str(marker)!r},'w').close()")
    assert not marker.exists()
    supervisor.release("codex", "fixture")
    assert supervisor.store.snapshot()["codex"] == 1
    supervisor.store.renew(foreign)
    assert supervisor.store.release_renewable(foreign)


def test_release_and_second_run_refuse_while_first_process_is_alive(supervisor, tmp_path):
    supervisor.acquire("codex", "fixture", limit=1, wait_seconds=0)
    runner = bare_runner(supervisor)
    marker = tmp_path / "ready"
    with ThreadPoolExecutor() as pool:
        future = pool.submit(
            execute,
            runner,
            tmp_path,
            f"import time;open({str(marker)!r},'w').close();time.sleep(1)",
        )
        deadline = time.monotonic() + 5
        while not marker.exists() and time.monotonic() < deadline:
            time.sleep(0.02)
        assert marker.exists()
        with pytest.raises(ValueError, match="before the process runner drains"):
            supervisor.release("codex", "fixture")
        with pytest.raises(ValueError, match="already running"):
            execute(runner, tmp_path)
        assert supervisor.store.snapshot()["codex"] == 1
        assert future.result(timeout=5).exit_code == 0
    supervisor.release("codex", "fixture")
    with pytest.raises(ValueError, match="ownership is absent"):
        execute(runner, tmp_path)


def test_lost_lease_stops_process_and_keeps_the_slot_until_drain(supervisor, tmp_path, monkeypatch):
    import openhands_factory.session_supervision as module

    supervisor.acquire("codex", "fixture", limit=1, wait_seconds=0)
    original_renew = supervisor.store.renew
    calls = 0
    drained = []

    def renew(handle):
        nonlocal calls
        calls += 1
        if calls >= 3:
            raise ProviderCapacityUnavailable("synthetic renewal refusal")
        original_renew(handle)

    # Observe the retention boundary without waiting ten real seconds in units.
    original_sleep = time.sleep

    def observe_sleep(seconds):
        if seconds == module.SHUTDOWN_MARGIN_SECONDS:
            drained.append(supervisor.store.snapshot()["codex"])
        else:
            original_sleep(seconds)

    monkeypatch.setattr(supervisor.store, "renew", renew)
    monkeypatch.setattr(module.time, "sleep", observe_sleep)
    result = execute(bare_runner(supervisor), tmp_path, "import time;time.sleep(20)")
    assert result.cancelled and result.exit_code != 0 and drained == [1]
    supervisor.release("codex", "fixture")
    assert supervisor.store.snapshot()["codex"] == 0


def test_concurrent_reservations_never_share_guardian_callbacks(supervisor, tmp_path):
    for owner in ["left", "right"]:
        supervisor.acquire("codex", owner, limit=2, wait_seconds=0)
    with pytest.raises(ProviderCapacityUnavailable):
        supervisor.acquire("codex", "third", limit=2, wait_seconds=0)
    barrier = threading.Barrier(2)

    def run(owner):
        barrier.wait(timeout=5)
        result = execute(bare_runner(supervisor, owner=owner), tmp_path, f"print({owner!r})")
        assert result.exit_code == 0 and result.stdout.strip() == owner
        supervisor.release("codex", owner)

    with ThreadPoolExecutor() as pool:
        list(pool.map(run, ["left", "right"]))
    records = [supervisor.journal.load(p.stem) for p in supervisor.journal.directory.glob("*.json")]
    assert {r.lease.owner for r in records} == {"left", "right"}
    assert len({r.guardian.pid for r in records}) == 2
    assert supervisor.store.snapshot()["codex"] == 0


class LocalCLI(CLIProvider):
    name = "codex"
    default_command = "/usr/bin/python3"
    script = "print('local fixture')"

    def health(self):
        return ProviderHealth(self.name, ProviderStatus.HEALTHY, datetime.now(UTC))

    def build_command(self, request, model, prompt_path):
        return [sys.executable, "-c", self.script]


def test_router_uses_one_renewable_reservation_without_mutating_health_runner(
    supervisor, tmp_path, monkeypatch
):
    provider = LocalCLI(model="fixture")
    health_runner = provider.process_runner
    original = supervisor.runner

    def local_runner(name, owner):
        runner = original(name, owner)
        runner.isolate_processes = False
        return runner

    monkeypatch.setattr(supervisor, "runner", local_runner)
    router = AgentRouter([provider], capacity_store=supervisor.store, provider_limits={"codex": 1})
    router.session_supervisor = supervisor
    job = Job(task=Task("570", "Supervised fixture", "", "github-issue", 1))
    request = AgentRequest(AgentPhase.IMPLEMENTATION, job.task, "fixture", tmp_path)
    result = router.run(request, job)
    assert result.success and result.model == "fixture"
    assert provider.process_runner is health_runner and request.process_runner is None
    assert len(list(supervisor.journal.directory.glob("*.json"))) == 1
    assert supervisor.store.snapshot()["codex"] == 0


def test_router_refuses_missing_shared_store_before_opting_in(tmp_path):
    router = AgentRouter([LocalCLI()])
    with pytest.raises(ConfigurationError, match="existing shared capacity store"):
        router.supervise_sessions(SessionIdentityJournal(tmp_path / "journal"))


def test_retry_uses_one_reservation_but_distinct_process_checkpoints(
    supervisor, tmp_path, monkeypatch
):
    class RetryCLI(LocalCLI):
        attempts = 0

        def build_command(self, request, model, prompt_path):
            self.attempts += 1
            assert supervisor.store.snapshot()["codex"] == 1
            return [
                sys.executable,
                "-c",
                "raise SystemExit(1)" if self.attempts == 1 else "print('ok')",
            ]

    provider = RetryCLI(model="fixture")
    original = supervisor.runner

    def local_runner(name, owner):
        runner = original(name, owner)
        runner.isolate_processes = False
        return runner

    monkeypatch.setattr(supervisor, "runner", local_runner)
    router = AgentRouter(
        [provider],
        capacity_store=supervisor.store,
        provider_limits={"codex": 1},
        same_provider_retries=1,
    )
    router.session_supervisor = supervisor
    job = Job(task=Task("570", "Retry fixture", "", "github-issue", 1))
    result = router.run(AgentRequest(AgentPhase.IMPLEMENTATION, job.task, "fixture", tmp_path), job)
    assert result.success and result.attempt == 2 and len(job.provider_history) == 2
    records = [supervisor.journal.load(p.stem) for p in supervisor.journal.directory.glob("*.json")]
    assert len(records) == 2 and records[0].lease == records[1].lease
    assert records[0].guardian != records[1].guardian
    assert supervisor.store.snapshot()["codex"] == 0


def test_health_probes_do_not_receive_the_request_runner(tmp_path):
    from openhands_factory.agents.process import ProcessResult

    class ProbeRunner:
        calls = 0

        def run(self, *args, **kwargs):
            self.calls += 1
            return ProcessResult(tuple(args[0]), 0, "probe", "", False, False, 0.0)

    class Provider(LocalCLI):
        health = CLIProvider.health

    probe = ProbeRunner()
    execution = ProbeRunner()
    provider = Provider(model="fixture", process_runner=probe)
    job = Job(task=Task("570", "Probe fixture", "", "github-issue", 1))
    request = AgentRequest(
        AgentPhase.IMPLEMENTATION, job.task, "fixture", tmp_path, process_runner=execution
    )
    provider.health()
    assert probe.calls == 1 and execution.calls == 0
    assert provider.run(request).success
    assert execution.calls == 1 and probe.calls == 1 and provider.process_runner is probe


def test_expired_ownership_refuses_dispatch_without_reacquiring(supervisor, tmp_path, monkeypatch):
    import openhands_factory.provider_capacity as capacity

    supervisor.acquire("codex", "fixture", limit=1, wait_seconds=0)
    real_datetime = datetime

    class Future(real_datetime):
        @classmethod
        def now(cls, tz=None):
            from datetime import timedelta

            return real_datetime.now(tz) + timedelta(seconds=31)

    monkeypatch.setattr(capacity, "datetime", Future)
    marker = tmp_path / "expired-must-not-run"
    with pytest.raises(ProviderCapacityUnavailable, match="expired or ownership lost"):
        execute(bare_runner(supervisor), tmp_path, f"open({str(marker)!r},'w').close()")
    assert not marker.exists() and list(supervisor.journal.directory.iterdir()) == []
    supervisor.release("codex", "fixture")
    assert supervisor.store.snapshot()["codex"] == 0


def test_configured_fallback_releases_first_provider_without_a_second_pool(
    supervisor, tmp_path, monkeypatch
):
    unavailable = LocalCLI(model="first-model")
    unavailable.script = "raise SystemExit(127)"
    fallback = LocalCLI(model="second-model")
    fallback.name = "claude"
    original = supervisor.runner

    def local_runner(name, owner):
        runner = original(name, owner)
        runner.isolate_processes = False
        return runner

    monkeypatch.setattr(supervisor, "runner", local_runner)
    router = AgentRouter(
        [unavailable, fallback],
        capacity_store=supervisor.store,
        provider_limits={"codex": 1, "claude": 1},
    )
    router.session_supervisor = supervisor
    job = Job(task=Task("570", "Fallback fixture", "", "github-issue", 1))
    result = router.run(AgentRequest(AgentPhase.IMPLEMENTATION, job.task, "fixture", tmp_path), job)
    assert result.success and result.provider == "claude" and result.model == "second-model"
    assert job.provider_failover_count == 1
    records = [supervisor.journal.load(p.stem) for p in supervisor.journal.directory.glob("*.json")]
    assert {record.lease.provider for record in records} == {"codex", "claude"}
    assert supervisor.store.snapshot() == {"codex": 0, "claude": 0}


def test_unsupported_transport_fails_before_capacity_or_provider_execution(supervisor, tmp_path):
    class SDK:
        name = "sdk"
        calls = 0

        def health(self):
            return ProviderHealth(self.name, ProviderStatus.HEALTHY, datetime.now(UTC))

        def supports(self, phase):
            return True

        def run(self, request):
            self.calls += 1
            raise AssertionError("Unsupported model transport was called")

    provider = SDK()
    router = AgentRouter([provider], capacity_store=supervisor.store)
    router.session_supervisor = supervisor
    job = Job(task=Task("570", "Unsupported fixture", "", "github-issue", 1))
    with pytest.raises(ConfigurationError, match="supported direct CLI"):
        router.run(AgentRequest(AgentPhase.IMPLEMENTATION, job.task, "fixture", tmp_path), job)
    assert provider.calls == 0 and supervisor.store.snapshot() == {}


@pytest.mark.parametrize("lease,guard", [(True, 5), (61, 5), (10, 5), (30, float("nan"))])
def test_bad_lease_or_shutdown_margins_cannot_reserve(supervisor, lease, guard):
    before = supervisor.store.path.read_bytes() if supervisor.store.path.exists() else None
    with pytest.raises(ValueError):
        SessionSupervisor(
            supervisor.store, supervisor.journal, lease_seconds=lease, guard_timeout_seconds=guard
        )
    after = supervisor.store.path.read_bytes() if supervisor.store.path.exists() else None
    assert after == before
