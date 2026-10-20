from __future__ import annotations

import json
import subprocess
import sys
import threading
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from openhands_factory.agents.base import (
    AgentFailure,
    AgentFailureKind,
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.cli import classify_process_failure, redact_agent_output
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore
from openhands_factory.agents.policy import ConfigRoutingPolicy
from openhands_factory.agents.process import (
    AgentProcessRunner,
    ProcessResult,
    ProviderHomeMount,
    provider_environment,
)
from openhands_factory.agents.router import AgentRouter
from openhands_factory.config import AgentsConfig
from openhands_factory.exceptions import (
    AgentTaskFailure,
    FactoryError,
    ProviderCapacityUnavailable,
)
from openhands_factory.metrics import MetricsStore
from openhands_factory.models import MAX_PROVIDER_HISTORY, Job, ProviderName, Task
from openhands_factory.provider_capacity import ProviderCapacityStore


class Provider:
    def __init__(self, name: str) -> None:
        self.name = name
        self.calls = 0

    def health(self) -> ProviderHealth:
        return ProviderHealth(self.name, ProviderStatus.HEALTHY, datetime.now(UTC))

    def supports(self, phase: AgentPhase) -> bool:
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        self.calls += 1
        now = datetime.now(UTC)
        return AgentResult(
            self.name,
            request.phase,
            True,
            now,
            now,
            0,
            "done",
            None,
            None,
            "fake",
            "fake-model",
        )


class OrderedPolicy:
    def candidates(self, phase, job, provider_health):
        return ["first", "second"]


class FailingProvider(Provider):
    def __init__(self, name: str, kind: AgentFailureKind) -> None:
        super().__init__(name)
        self.kind = kind

    def run(self, request: AgentRequest) -> AgentResult:
        self.calls += 1
        now = datetime.now(UTC)
        return AgentResult(
            self.name,
            request.phase,
            False,
            now,
            now,
            1,
            None,
            None,
            AgentFailure(self.kind, "provider failed"),
            "fake",
            "fake-model",
        )


class CacheAwareFailingProvider(FailingProvider):
    def __init__(self, name: str, kind: AgentFailureKind) -> None:
        super().__init__(name, kind)
        self.invalidations = 0

    def invalidate_health_cache(self) -> None:
        self.invalidations += 1


def request(tmp_path: Path) -> tuple[AgentRequest, Job]:
    task = Task("42", "Agent runtime", "Body", "github-issue", 0)
    return AgentRequest(AgentPhase.IMPLEMENTATION, task, "do it", tmp_path), Job(task)


def test_provider_environment_excludes_api_keys_and_unrelated_daemon_secrets() -> None:
    environment = provider_environment(
        {
            "HOME": "/safe/home",
            "PATH": "/safe/bin",
            "OPENAI_API_KEY": "secret-openai",
            "ANTHROPIC_API_KEY": "secret-anthropic",
            "GEMINI_API_KEY": "secret-google",
            "OPENCODE_GO_API_KEY": "secret-opencode",
            "GITHUB_TOKEN": "secret-github",
            "TELEGRAM_BOT_TOKEN": "secret-telegram",
            "HTTPS_PROXY": "https://proxy-user:proxy-secret@example.invalid",
        }
    )

    assert environment["HOME"] == "/safe/home"
    assert environment["PATH"] == "/safe/bin"
    assert environment["GIT_OPTIONAL_LOCKS"] == "0"
    assert environment["XDG_CONFIG_HOME"] == "/safe/home/.config"
    assert environment["XDG_DATA_HOME"] == "/safe/home/.local/share"
    assert "HTTPS_PROXY" not in environment
    assert not any("KEY" in key or "TOKEN" in key for key in environment)


def test_provider_sandbox_restores_only_explicit_home_mounts(tmp_path: Path) -> None:
    home = tmp_path / "state" / "home"
    workspace = tmp_path / "worktree"
    repository = tmp_path / "repository"
    for directory in (home / ".claude", home / ".codex", workspace, repository):
        directory.mkdir(parents=True, exist_ok=True)
    environment = provider_environment({"HOME": str(home), "PATH": "/usr/bin:/bin"})

    command = AgentProcessRunner()._launch_command(
        ("/bin/true",),
        cwd=workspace,
        env=environment,
        home_mounts=(ProviderHomeMount(".claude"),),
    )

    assert ".claude" in command
    assert ".codex" not in command
    assert command[command.index(".claude") - 1] == "rw"
    sandbox_script = next(argument for argument in command if "mount --make-rprivate" in argument)
    assert "tmpfs /var/tmp" in sandbox_script
    assert "tmpfs /dev/shm" in sandbox_script
    assert "remount,bind,ro /opt/hellotalk-factory" in sandbox_script


def test_provider_sandbox_rejects_home_mount_escape(tmp_path: Path) -> None:
    home = tmp_path / "home"
    workspace = tmp_path / "worktree"
    home.mkdir()
    workspace.mkdir()

    with pytest.raises(ValueError, match="Unsafe provider home mount"):
        AgentProcessRunner()._launch_command(
            ("/bin/true",),
            cwd=workspace,
            env=provider_environment({"HOME": str(home), "PATH": "/usr/bin:/bin"}),
            home_mounts=(ProviderHomeMount("../other-provider"),),
        )


def test_agent_diagnostics_redact_generic_secret_assignments() -> None:
    output = redact_agent_output(
        'GITHUB_TOKEN=ordinary-value password: hunter2 "access_token":"plain-token"'
    )

    assert "ordinary-value" not in output
    assert "hunter2" not in output
    assert "plain-token" not in output
    assert output.count("[redacted]") == 3


def test_process_runner_uses_stdin_and_real_exit_status(tmp_path: Path) -> None:
    result = AgentProcessRunner(isolate_processes=False).run(
        (
            sys.executable,
            "-c",
            "import sys; data=sys.stdin.read(); print(data); print('diagnostic', file=sys.stderr)",
        ),
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text="private prompt",
        timeout_seconds=10,
        max_output_bytes=10_000,
    )

    assert result.exit_code == 0
    assert result.stdout.strip() == "private prompt"
    assert result.stderr.strip() == "diagnostic"
    assert not result.timed_out


def test_process_runner_bounds_output_and_kills_timeout(tmp_path: Path) -> None:
    runner = AgentProcessRunner(isolate_processes=False)
    bounded = runner.run(
        (sys.executable, "-c", "print('x' * 100000)"),
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text=None,
        timeout_seconds=10,
        max_output_bytes=100,
    )
    timed_out = runner.run(
        (sys.executable, "-c", "import time; time.sleep(30)"),
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text=None,
        timeout_seconds=1,
        max_output_bytes=100,
    )

    assert len(bounded.stdout.encode()) <= 100
    assert bounded.output_truncated
    assert timed_out.timed_out
    assert timed_out.exit_code != 0


def test_large_stdin_cannot_block_process_timeout(tmp_path: Path) -> None:
    result = AgentProcessRunner(isolate_processes=False).run(
        (sys.executable, "-c", "import time; time.sleep(30)"),
        cwd=tmp_path,
        env=provider_environment(),
        stdin_text="x" * 1_000_000,
        timeout_seconds=1,
        max_output_bytes=100,
    )

    assert result.timed_out
    assert result.duration_seconds < 10


def test_shutdown_terminates_registered_agent_processes(tmp_path: Path) -> None:
    results: list[ProcessResult] = []

    def execute() -> None:
        results.append(
            AgentProcessRunner(isolate_processes=False).run(
                (sys.executable, "-c", "import time; time.sleep(30)"),
                cwd=tmp_path,
                env=provider_environment(),
                stdin_text=None,
                timeout_seconds=60,
                max_output_bytes=100,
            )
        )

    worker = threading.Thread(target=execute)
    worker.start()
    deadline = time.monotonic() + 5
    while not AgentProcessRunner._processes and time.monotonic() < deadline:
        time.sleep(0.01)

    AgentProcessRunner.terminate_all()
    worker.join(timeout=10)

    assert not worker.is_alive()
    assert results and results[0].exit_code != 0


def test_shutdown_gate_prevents_a_late_provider_process_start(tmp_path: Path) -> None:
    AgentProcessRunner.request_shutdown()
    try:
        with pytest.raises(RuntimeError, match="cancelled during Factory shutdown"):
            AgentProcessRunner().run(
                (sys.executable, "-c", "print('must not start')"),
                cwd=tmp_path,
                env=provider_environment(),
                stdin_text=None,
                timeout_seconds=10,
                max_output_bytes=100,
            )
    finally:
        AgentProcessRunner.reset_shutdown()

    assert AgentProcessRunner._processes == set()


def test_terminate_reaps_process_after_direct_kill_fallback(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    class StubbornProcess:
        pid = 1234
        returncode: int | None = None

        def __init__(self) -> None:
            self.wait_calls = 0
            self.kill_calls = 0

        def poll(self) -> None:
            return None

        def wait(self, timeout: float) -> int:
            self.wait_calls += 1
            if self.wait_calls < 3:
                raise subprocess.TimeoutExpired(("agent",), timeout)
            self.returncode = -9
            return self.returncode

        def kill(self) -> None:
            self.kill_calls += 1

    process = StubbornProcess()
    monkeypatch.setattr("openhands_factory.agents.process.os.killpg", lambda pid, sig: None)

    AgentProcessRunner._terminate(process, grace_seconds=0.01)  # type: ignore[arg-type]

    assert process.kill_calls == 1
    assert process.wait_calls == 3


@pytest.mark.parametrize(
    ("text", "kind"),
    [
        ("Please log in", AgentFailureKind.PROVIDER_AUTH),
        ("quota exhausted", AgentFailureKind.PROVIDER_QUOTA),
        ("429 rate limit; retry-after: 30", AgentFailureKind.PROVIDER_RATE_LIMIT),
        ("tests failed", AgentFailureKind.TEST_FAILURE),
        ("not a git repository", AgentFailureKind.REPOSITORY_FAILURE),
        ("sandbox denied this command", AgentFailureKind.POLICY_FAILURE),
        ("task cannot be completed", AgentFailureKind.TASK_FAILURE),
    ],
)
def test_process_failure_classification(text: str, kind: AgentFailureKind) -> None:
    failure = classify_process_failure(ProcessResult(("agent",), 1, "", text, False, False, 0.1))

    assert failure.kind is kind
    if kind is AgentFailureKind.PROVIDER_RATE_LIMIT:
        assert failure.retry_after_seconds == 30


@pytest.mark.parametrize(
    ("text", "retry_after_seconds"),
    [
        ("Individual quota reached. Resets in 2h12m46s.", 7966),
        ("Insufficient balance. Manage your billing.", None),
        ("You've hit your monthly spend limit.", None),
    ],
)
def test_provider_quota_messages_are_classified_without_transport_retries(
    text: str,
    retry_after_seconds: int | None,
) -> None:
    failure = classify_process_failure(ProcessResult(("agent",), 1, "", text, False, False, 0.1))

    assert failure.kind is AgentFailureKind.PROVIDER_QUOTA
    assert failure.retry_after_seconds == retry_after_seconds


def test_health_store_allows_only_one_half_open_probe(tmp_path: Path) -> None:
    store = AgentHealthStore(tmp_path / "health.json")
    breaker = AgentCircuitBreaker("first", 1, 1)
    breaker.record_failure(
        AgentFailureKind.PROVIDER_RATE_LIMIT,
        now=datetime.now(UTC) - timedelta(seconds=2),
    )
    defaults = {"first": AgentCircuitBreaker("first", 1, 1)}
    store.save({"first": breaker})

    first, first_breaker = store.permit("first", defaults)
    second, second_breaker = store.permit("first", defaults)

    assert first
    assert first_breaker.state == "half-open"
    assert not second
    assert second_breaker.state == "half-open"


def test_stale_persisted_half_open_probe_is_released_after_daemon_crash(
    tmp_path: Path,
) -> None:
    store = AgentHealthStore(tmp_path / "health.json")
    breaker = AgentCircuitBreaker(
        "first",
        1,
        1,
        state="half-open",
        consecutive_failures=1,
        opened_at=datetime.now(UTC) - timedelta(seconds=61),
        last_failure_kind=AgentFailureKind.PROVIDER_RATE_LIMIT,
    )
    defaults = {"first": AgentCircuitBreaker("first", 1, 1)}
    store.save({"first": breaker})

    recovered, recovered_breaker = AgentHealthStore(tmp_path / "health.json").permit(
        "first",
        defaults,
    )
    concurrent, concurrent_breaker = store.permit("first", defaults)

    assert recovered
    assert recovered_breaker.state == "half-open"
    assert not concurrent
    assert concurrent_breaker.get_health().retry_after is not None


def test_health_store_fails_closed_for_malformed_known_provider_state(
    tmp_path: Path,
) -> None:
    path = tmp_path / "health.json"
    path.write_text(
        json.dumps(
            {
                "breakers": [
                    {"provider": "first", "state": "invalid"},
                    {
                        "provider": "second",
                        "failure_threshold": 99,
                        "cooldown_seconds": 99,
                        "state": "open",
                        "consecutive_failures": 2,
                        "opened_at": datetime.now(UTC).isoformat(),
                        "retry_after_seconds": 10,
                        "last_failure_kind": "provider_rate_limit",
                    },
                ]
            }
        ),
        encoding="utf-8",
    )
    defaults = {
        "first": AgentCircuitBreaker("first", 2, 300),
        "second": AgentCircuitBreaker("second", 3, 600),
    }

    loaded = AgentHealthStore(path).load(defaults)

    assert loaded["first"].state == "open"
    assert not loaded["first"].permits_call()
    assert loaded["first"].last_failure_kind is AgentFailureKind.PROVIDER_UNAVAILABLE
    assert loaded["second"].failure_threshold == 3
    assert loaded["second"].cooldown_seconds == 600


def test_circuit_breaker_clamps_negative_provider_retry_hint() -> None:
    breaker = AgentCircuitBreaker("first", 1, 60)

    breaker.record_failure(
        AgentFailureKind.PROVIDER_RATE_LIMIT,
        retry_after_seconds=-30,
    )

    assert breaker.retry_after_seconds == 0


def test_health_store_clamps_future_opened_timestamp_to_a_bounded_cooldown(
    tmp_path: Path,
) -> None:
    path = tmp_path / "health.json"
    path.write_text(
        json.dumps(
            {
                "breakers": [
                    {
                        "provider": "first",
                        "state": "open",
                        "consecutive_failures": 2,
                        "opened_at": (datetime.now(UTC) + timedelta(days=365)).isoformat(),
                        "retry_after_seconds": 10,
                        "last_failure_kind": "provider_rate_limit",
                    }
                ]
            }
        ),
        encoding="utf-8",
    )
    defaults = {"first": AgentCircuitBreaker("first", 2, 300)}

    loaded = AgentHealthStore(path).load(defaults)["first"]

    assert loaded.opened_at is not None
    assert loaded.opened_at <= datetime.now(UTC)
    assert loaded.get_health().retry_after is not None
    assert loaded.get_health().retry_after <= datetime.now(UTC) + timedelta(seconds=301)


def test_unhealthy_probe_opens_and_persists_auth_circuit(tmp_path: Path) -> None:
    provider = Provider("first")
    provider.health = lambda: ProviderHealth(  # type: ignore[method-assign]
        "first", ProviderStatus.AUTH_REQUIRED, datetime.now(UTC)
    )
    store = AgentHealthStore(tmp_path / "health.json")
    router = AgentRouter(
        [provider],
        health_store=store,
        failure_cooldowns={AgentFailureKind.PROVIDER_AUTH: 900},
    )

    snapshot = router.health_snapshot()
    persisted = store.load(router._default_breakers())

    assert snapshot["first"].status is ProviderStatus.AUTH_REQUIRED
    assert snapshot["first"].retry_after is not None
    assert persisted["first"].state == "open"
    assert persisted["first"].retry_after_seconds == 900


def test_router_skips_cross_process_busy_provider(tmp_path: Path) -> None:
    first = Provider("first")
    second = Provider("second")
    capacity = ProviderCapacityStore(tmp_path)
    capacity.acquire("first", limit=1, owner="other", wait_seconds=0, lease_seconds=60)
    agent_request, job = request(tmp_path)
    router = AgentRouter(
        [first, second],
        policy=OrderedPolicy(),
        capacity_store=capacity,
        provider_limits={"first": 1, "second": 1},
        skip_busy_providers=True,
    )

    result = router.run(agent_request, job)

    assert result.provider == "second"
    assert result.fallback_reason == "first:busy"
    assert first.calls == 0
    assert second.calls == 1
    assert job.provider_failover_count == 1
    assert job.last_provider_failure == "first:busy"


def test_router_reserves_provider_slot_for_pull_request_review(tmp_path: Path) -> None:
    provider = Provider("first")
    capacity = ProviderCapacityStore(tmp_path)
    capacity.acquire("first", limit=2, owner="active-issue", wait_seconds=0, lease_seconds=60)
    router = AgentRouter(
        [provider],
        capacity_store=capacity,
        provider_limits={"first": 2},
        skip_busy_providers=True,
    )
    router.reserve_review_capacity("7348")
    issue_request, issue_job = request(tmp_path)

    with pytest.raises(ProviderCapacityUnavailable, match="busy"):
        router.run(issue_request, issue_job)

    review_task = Task("7348", "Review", "Body", "github-pull-request", 5)
    review_request = AgentRequest(
        AgentPhase.CODE_REVIEW,
        review_task,
        "review it",
        tmp_path,
    )
    review_job = Job(review_task)

    result = router.run(review_request, review_job)

    assert result.provider == "first"
    assert provider.calls == 1
    assert capacity.snapshot()["first"] == 1
    router.release_review_capacity("7348")
    capacity.release("first", owner="active-issue")


def test_router_capacity_lease_covers_every_same_provider_attempt(tmp_path: Path) -> None:
    class RecordingCapacityStore(ProviderCapacityStore):
        def __init__(self, state_dir: Path) -> None:
            super().__init__(state_dir)
            self.lease_seconds = 0

        def acquire(
            self,
            provider: ProviderName | str,
            *,
            limit: int,
            owner: str,
            wait_seconds: int,
            lease_seconds: int,
        ) -> float:
            del provider, limit, owner, wait_seconds
            self.lease_seconds = lease_seconds
            return 0

        def release(self, provider: ProviderName | str, *, owner: str) -> None:
            del provider, owner

    capacity = RecordingCapacityStore(tmp_path)
    agent_request, job = request(tmp_path)
    agent_request.timeout_seconds = 120
    router = AgentRouter(
        [Provider("first")],
        capacity_store=capacity,
        same_provider_retries=1,
    )

    router.run(agent_request, job)

    assert capacity.lease_seconds == 540


def test_router_shutdown_rejects_new_provider_attempts(tmp_path: Path) -> None:
    provider = Provider("first")
    agent_request, job = request(tmp_path)
    router = AgentRouter([provider])
    router.shutdown()

    with pytest.raises(ProviderCapacityUnavailable, match="stopping"):
        router.run(agent_request, job)

    assert provider.calls == 0


def test_provider_failure_invalidates_cached_health_before_half_open_probe(
    tmp_path: Path,
) -> None:
    first = CacheAwareFailingProvider("first", AgentFailureKind.PROVIDER_RATE_LIMIT)
    second = Provider("second")
    agent_request, job = request(tmp_path)
    router = AgentRouter(
        [first, second],
        policy=OrderedPolicy(),
        same_provider_retries=0,
    )

    result = router.run(agent_request, job)

    assert result.provider == "second"
    assert first.invalidations == 1


def test_router_without_a_health_store_keeps_circuit_state_between_runs(
    tmp_path: Path,
) -> None:
    first = FailingProvider("first", AgentFailureKind.PROVIDER_RATE_LIMIT)
    second = Provider("second")
    agent_request, job = request(tmp_path)
    router = AgentRouter(
        [first, second],
        policy=OrderedPolicy(),
        same_provider_retries=0,
        failure_threshold=1,
    )

    assert router.run(agent_request, job).provider == "second"
    assert router.run(agent_request, job).provider == "second"

    assert first.calls == 1
    assert second.calls == 2


def test_task_failure_clears_an_earlier_provider_strike(tmp_path: Path) -> None:
    first = FailingProvider("first", AgentFailureKind.PROVIDER_RATE_LIMIT)
    second = Provider("second")
    agent_request, job = request(tmp_path)
    router = AgentRouter(
        [first, second],
        policy=OrderedPolicy(),
        same_provider_retries=0,
        failure_threshold=2,
    )

    assert router.run(agent_request, job).provider == "second"
    first.kind = AgentFailureKind.TASK_FAILURE

    result = router.run(agent_request, job)

    assert not result.success
    assert result.failure is not None
    assert result.failure.kind is AgentFailureKind.TASK_FAILURE
    assert router._memory_breakers["first"].consecutive_failures == 0


def test_unclassified_provider_failure_is_normalised_and_falls_back(tmp_path: Path) -> None:
    class UnclassifiedProvider(Provider):
        def run(self, request: AgentRequest) -> AgentResult:
            self.calls += 1
            now = datetime.now(UTC)
            return AgentResult(
                self.name,
                request.phase,
                False,
                now,
                now,
                1,
                None,
                None,
                None,
                "fake",
                "fake-model",
            )

    first = UnclassifiedProvider("first")
    second = Provider("second")
    agent_request, job = request(tmp_path)

    result = AgentRouter(
        [first, second],
        policy=OrderedPolicy(),
        same_provider_retries=0,
    ).run(agent_request, job)

    assert result.provider == "second"
    assert job.provider_history[0]["failure_classification"] == "invalid_agent_output"


def test_phase_policy_rotates_a_just_failed_provider_to_the_end() -> None:
    config = AgentsConfig()
    config.providers["opencode"].enabled = True
    job = Job(Task("42", "Policy", "", "github-issue", 0))
    job.provider_history.append(
        {
            "provider": "codex",
            "phase": AgentPhase.QUALITY_REPAIR.value,
            "success": False,
        }
    )
    health = {
        name: ProviderHealth(name, ProviderStatus.HEALTHY, datetime.now(UTC))
        for name in config.providers
    }

    candidates = ConfigRoutingPolicy(config).candidates(
        AgentPhase.QUALITY_REPAIR,
        job,
        health,
    )

    assert candidates[0] == "claude"
    assert candidates[-2:] == ["pi", "codex"]


def test_review_exclusion_prefers_independent_provider(tmp_path: Path) -> None:
    first = Provider("first")
    second = Provider("second")
    agent_request, job = request(tmp_path)
    agent_request.phase = AgentPhase.CODE_REVIEW

    result = AgentRouter([first, second], policy=OrderedPolicy()).run(
        agent_request,
        job,
        exclude={"first"},
    )

    assert result.provider == "second"
    assert first.calls == 0


def test_review_uses_same_provider_only_as_recorded_last_resort(tmp_path: Path) -> None:
    first = Provider("first")
    agent_request, job = request(tmp_path)
    agent_request.phase = AgentPhase.CODE_REVIEW

    result = AgentRouter([first]).run(agent_request, job, exclude={"first"})

    assert result.provider == "first"
    assert result.fallback_reason == "diversity-last-resort"
    assert job.provider_history[-1]["fallback_reason"] == "diversity-last-resort"


def test_router_bounds_per_job_provider_history(tmp_path: Path) -> None:
    provider = Provider("first")
    agent_request, job = request(tmp_path)
    job.provider_history = [{"sequence": sequence} for sequence in range(MAX_PROVIDER_HISTORY)]

    AgentRouter([provider]).run(agent_request, job)

    assert len(job.provider_history) == MAX_PROVIDER_HISTORY
    assert job.provider_history[0]["sequence"] == 1
    assert job.provider_history[-1]["provider"] == "first"


def test_router_records_phase_metrics_for_fallback(tmp_path: Path) -> None:
    first = FailingProvider("first", AgentFailureKind.PROVIDER_RATE_LIMIT)
    second = Provider("second")
    agent_request, job = request(tmp_path)
    metrics = MetricsStore(tmp_path / "metrics.json")
    router = AgentRouter(
        [first, second],
        policy=OrderedPolicy(),
        same_provider_retries=0,
        metrics_store=metrics,
    )

    result = router.run(agent_request, job)
    providers = metrics.snapshot()["providers"]

    assert result.provider == "second"
    assert isinstance(providers, list)
    by_provider = {entry["provider"]: entry for entry in providers}
    assert by_provider["first"]["rate_limits"] == 1
    assert by_provider["first"]["failure_counts"] == {"provider_rate_limit": 1}
    assert by_provider["first"]["phase"] == "implementation"
    assert by_provider["second"]["successes"] == 1
    assert by_provider["second"]["fallbacks"] == 1
    assert by_provider["second"]["failure_counts"] == {}


def test_metrics_restore_legacy_records_without_failure_counts(tmp_path: Path) -> None:
    path = tmp_path / "metrics.json"
    path.write_text(
        json.dumps(
            {
                "providers": [
                    {
                        "provider": "codex",
                        "model": "legacy-model",
                        "phase": "implementation",
                        "calls": 3,
                        "successes": 1,
                        "failures": 2,
                    }
                ]
            }
        ),
        encoding="utf-8",
    )

    providers = MetricsStore(path).snapshot()["providers"]

    assert isinstance(providers, list)
    assert providers[0]["calls"] == 3
    assert providers[0]["successes"] == 1
    assert providers[0]["failures"] == 2
    assert providers[0]["failure_counts"] == {}


def test_capacity_store_discards_malformed_and_expired_entries(tmp_path: Path) -> None:
    now = datetime.now(UTC)
    path = tmp_path / "provider-capacity.json"
    path.write_text(
        json.dumps(
            {
                "providers": {
                    "first": [
                        {"owner": "bad", "expires_at": "not-a-date"},
                        {"owner": "missing"},
                        {
                            "owner": "naive",
                            "acquired_at": now.replace(tzinfo=None).isoformat(),
                            "expires_at": (now + timedelta(minutes=1))
                            .replace(tzinfo=None)
                            .isoformat(),
                        },
                        {
                            "owner": "corrupt-future",
                            "acquired_at": now.isoformat(),
                            "expires_at": (now + timedelta(days=2)).isoformat(),
                        },
                    ],
                    "invalid": "not-a-list",
                }
            }
        ),
        encoding="utf-8",
    )
    store = ProviderCapacityStore(tmp_path)

    store.acquire("first", limit=1, owner="new", wait_seconds=0, lease_seconds=60)

    assert store.snapshot() == {"first": 1}


def test_capacity_store_rejects_a_lease_longer_than_its_configured_bound(
    tmp_path: Path,
) -> None:
    store = ProviderCapacityStore(tmp_path, max_lease_seconds=60)

    with pytest.raises(ValueError, match="max_lease_seconds"):
        store.acquire("first", limit=1, owner="new", wait_seconds=0, lease_seconds=61)


def test_invalid_structured_output_retries_then_falls_back(tmp_path: Path) -> None:
    first = Provider("first")
    second = Provider("second")
    agent_request, job = request(tmp_path)
    validations = 0
    preparations = 0

    def prepare() -> None:
        nonlocal preparations
        preparations += 1

    def validate() -> None:
        nonlocal validations
        validations += 1
        if validations < 3:
            raise FactoryError("Structured review report invalid JSON")

    agent_request.prepare_attempt = prepare
    agent_request.validate_output = validate
    router = AgentRouter(
        [first, second],
        policy=OrderedPolicy(),
        same_provider_retries=1,
    )

    result = router.run(agent_request, job)

    assert result.provider == "second"
    assert first.calls == 2
    assert second.calls == 1
    assert preparations == 3
    assert [entry["failure_classification"] for entry in job.provider_history[:2]] == [
        AgentFailureKind.INVALID_AGENT_OUTPUT.value,
        AgentFailureKind.INVALID_AGENT_OUTPUT.value,
    ]


def test_task_validation_failure_does_not_retry_or_open_provider_circuit(
    tmp_path: Path,
) -> None:
    first = Provider("first")
    second = Provider("second")
    agent_request, job = request(tmp_path)

    def validate() -> None:
        raise AgentTaskFailure("Implementation produced no changes")

    agent_request.validate_output = validate
    router = AgentRouter(
        [first, second],
        policy=OrderedPolicy(),
        same_provider_retries=1,
        failure_threshold=1,
    )

    result = router.run(agent_request, job)

    assert not result.success
    assert result.provider == "first"
    assert result.failure is not None
    assert result.failure.kind is AgentFailureKind.TASK_FAILURE
    assert first.calls == 1
    assert second.calls == 0
    assert router._memory_breakers["first"].state == "closed"
    assert job.provider_history[-1]["failure_classification"] == "task_failure"


def test_no_provider_does_not_mutate_task_attempt_count(tmp_path: Path) -> None:
    provider = Provider("first")
    provider.health = lambda: ProviderHealth(  # type: ignore[method-assign]
        "first", ProviderStatus.AUTH_REQUIRED, datetime.now(UTC)
    )
    agent_request, job = request(tmp_path)

    with pytest.raises(ProviderCapacityUnavailable):
        AgentRouter([provider]).run(agent_request, job)

    assert job.attempts == 0
    assert job.provider_history == []
    assert job.last_provider_failure == (
        "No eligible provider is available for phase implementation"
    )
