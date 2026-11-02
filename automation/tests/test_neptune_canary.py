"""Deterministic bounded-entrypoint contracts; no live provider or deployment."""

from dataclasses import replace
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from openhands_factory import canary, cli
from openhands_factory.canary import SingleIssueCanary, run_canary
from openhands_factory.config import FactoryConfig
from openhands_factory.doctor import Check
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.models import Job, JobState, Task


def make_canary(state: JobState = JobState.IMPLEMENTING) -> SingleIssueCanary:
    daemon = object.__new__(SingleIssueCanary)
    daemon.issue = "521"
    task = Task("521", "Plan requirements", "Trusted task", "github-issue", 5)
    job = Job(task, state=state)
    daemon.pipeline = SimpleNamespace(  # type: ignore[assignment]
        refresh=Mock(),
        tasks=SimpleNamespace(cached=Mock(return_value=[task])),
        jobs=SimpleNamespace(load=Mock(return_value={"521": job})),
        run_job=Mock(return_value=job),
        github=SimpleNamespace(merge_pull_request=Mock()),
        pull_request_capacity=SimpleNamespace(pause_new_dispatch=False),
    )
    daemon._assert_owner = Mock()  # type: ignore[method-assign]
    daemon.paused = Mock(return_value=False)  # type: ignore[method-assign]
    daemon._storage_ready = Mock(return_value=True)  # type: ignore[method-assign]
    daemon.issue_admission = SimpleNamespace(admit=Mock(return_value=True))  # type: ignore[assignment]
    daemon.main_merge_gate = SimpleNamespace(is_green=Mock(return_value=True))  # type: ignore[assignment]
    return daemon


def test_one_transition_only_and_normal_merge_fence(capsys: pytest.CaptureFixture[str]) -> None:
    daemon = make_canary()
    original = daemon.pipeline.github.merge_pull_request

    def step(identifier: str) -> Job:
        assert identifier == "521"
        daemon.pipeline.github.merge_pull_request(10, "exact-head")
        return daemon.pipeline.jobs.load()[identifier]

    daemon.pipeline.run_job.side_effect = step  # type: ignore[attr-defined]
    assert daemon._loop() == 0
    daemon.pipeline.run_job.assert_called_once_with("521")  # type: ignore[attr-defined]
    original.assert_called_once_with(10, "exact-head")  # type: ignore[attr-defined]
    assert daemon.pipeline.github.merge_pull_request is original
    assert '"continuity_enabled": false' in capsys.readouterr().out


def test_canary_merge_cannot_pass_unhealthy_main() -> None:
    daemon = make_canary()
    original = daemon.pipeline.github.merge_pull_request
    daemon.main_merge_gate.is_green.return_value = False  # type: ignore[attr-defined]

    def step(identifier: str) -> Job:
        daemon.pipeline.github.merge_pull_request(10, "exact-head")
        return daemon.pipeline.jobs.load()[identifier]

    daemon.pipeline.run_job.side_effect = step  # type: ignore[attr-defined]
    assert daemon._loop() == 0
    original.assert_not_called()  # type: ignore[attr-defined]


def test_restart_terminal_closed_issue_does_not_reimplement() -> None:
    daemon = make_canary(JobState.DONE)
    daemon.pipeline.tasks.cached.return_value = []  # type: ignore[attr-defined]
    assert daemon._loop() == 0
    daemon.pipeline.run_job.assert_not_called()  # type: ignore[attr-defined]
    daemon.issue_admission.admit.assert_not_called()  # type: ignore[attr-defined]


def test_restart_preserves_failure_backoff() -> None:
    daemon = make_canary()
    job = daemon.pipeline.jobs.load()["521"]
    job.next_attempt_at = datetime.now(UTC) + timedelta(hours=1)
    assert daemon._loop() == 0
    daemon.pipeline.run_job.assert_not_called()  # type: ignore[attr-defined]


@pytest.mark.parametrize("bad", ["unlabelled", "missing", "pr", "paused", "disk"])
def test_canary_fails_closed_without_dispatch(bad: str) -> None:
    daemon = make_canary()
    if bad == "unlabelled":
        daemon.pipeline.tasks.cached.return_value = []  # type: ignore[attr-defined]
    elif bad == "missing":
        daemon.pipeline.jobs.load.return_value = {}  # type: ignore[attr-defined]
    elif bad == "pr":
        job = daemon.pipeline.jobs.load()["521"]
        job.task = replace(job.task, source="github-pull-request")
    elif bad == "paused":
        daemon.paused.return_value = True  # type: ignore[attr-defined]
    else:
        daemon._storage_ready.return_value = False  # type: ignore[attr-defined]
    with pytest.raises(ConfigurationError):
        daemon._loop()
    daemon.pipeline.run_job.assert_not_called()  # type: ignore[attr-defined]


@pytest.mark.parametrize("blocked", ["wip", "admissions"])
def test_canary_honours_existing_new_issue_allowance(blocked: str) -> None:
    daemon = make_canary(JobState.DISCOVERED)
    if blocked == "wip":
        daemon.pipeline.pull_request_capacity.pause_new_dispatch = True
    else:
        daemon.issue_admission.admit.return_value = False  # type: ignore[attr-defined]
    with pytest.raises(ConfigurationError):
        daemon._loop()
    daemon.pipeline.run_job.assert_not_called()  # type: ignore[attr-defined]


@pytest.mark.parametrize("issue", [None, 0, -1, True])
def test_live_entrypoint_requires_explicit_issue(
    neptune_config: FactoryConfig, issue: int | None
) -> None:
    with pytest.raises(ConfigurationError):
        run_canary(neptune_config, issue)


def test_readiness_failure_precedes_generation_or_provider(
    neptune_config: FactoryConfig, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(canary, "run_doctor", lambda *a, **kw: [Check("isolation", False, "bad")])
    monkeypatch.setattr(
        canary, "github_repository_access_check", lambda c: Check("access", True, "ok")
    )
    monkeypatch.setattr(canary, "github_merge_policy_check", lambda c: Check("policy", True, "ok"))
    constructor = Mock()
    monkeypatch.setattr(canary, "SingleIssueCanary", constructor)
    with pytest.raises(ConfigurationError, match="isolation"):
        run_canary(neptune_config, 521)
    constructor.assert_not_called()


def test_cli_live_canary_uses_supported_one_step_runner(
    neptune_config: FactoryConfig, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(cli, "protect_process_credentials", lambda: None)
    monkeypatch.setattr(cli, "_config", lambda: neptune_config)
    run = Mock(return_value=0)
    monkeypatch.setattr(canary, "run_canary", run)
    assert cli.main(["task", "run", "--issue", "521"]) == 0
    run.assert_called_once_with(neptune_config, 521)


def test_existing_profiles_do_not_gain_live_task_execution(neptune_config: FactoryConfig) -> None:
    other = neptune_config.model_copy(update={"repository_profile": "hellotalk"})
    with pytest.raises(ConfigurationError):
        run_canary(other, 521)


def test_cli_supervised_canary_is_explicit_and_dry_run_does_not_dispatch(
    neptune_config: FactoryConfig, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(cli, "protect_process_credentials", lambda: None)
    monkeypatch.setattr(cli, "_config", lambda: neptune_config)
    run = Mock(return_value=0)
    monkeypatch.setattr(canary, "run_canary", run)
    args = ["task", "run", "--issue", "570", "--supervised-session"]
    assert cli.main([*args, "--dry-run"]) == 0
    run.assert_not_called()
    assert cli.main(args) == 0
    run.assert_called_once_with(neptune_config, 570, supervised_session=True)


def test_supervised_canary_refuses_missing_namespaces_before_startup(
    neptune_config: FactoryConfig, monkeypatch: pytest.MonkeyPatch
) -> None:
    from openhands_factory.agents import process

    monkeypatch.setattr(canary, "run_doctor", lambda *a, **kw: [])
    monkeypatch.setattr(
        canary, "github_repository_access_check", lambda c: Check("access", True, "ok")
    )
    monkeypatch.setattr(canary, "github_merge_policy_check", lambda c: Check("policy", True, "ok"))
    monkeypatch.setattr(process, "agent_process_isolation_probe", lambda: (False, "denied"))
    constructor = Mock()
    monkeypatch.setattr(canary, "SingleIssueCanary", constructor)
    with pytest.raises(ConfigurationError, match="manual-session-containment"):
        run_canary(neptune_config, 570, supervised_session=True)
    constructor.assert_not_called()


def test_canary_attaches_supervision_to_its_existing_router_and_store(
    neptune_config: FactoryConfig, monkeypatch: pytest.MonkeyPatch
) -> None:
    from openhands_factory.agents.router import AgentRouter
    from openhands_factory.provider_capacity import ProviderCapacityStore

    router = AgentRouter(
        [], capacity_store=ProviderCapacityStore(neptune_config.provider_capacity_dir)
    )

    def initialise(self, config):
        self.pipeline = SimpleNamespace(router=router)

    monkeypatch.setattr(canary.MainCiGatedFactoryDaemon, "__init__", initialise)
    daemon = SingleIssueCanary(neptune_config, 570, supervised_session=True)
    supervisor = daemon.pipeline.router.session_supervisor
    assert supervisor is not None and supervisor.store is router.capacity_store
    assert supervisor.journal.directory == neptune_config.state_dir / "manual-session-identities"
    assert supervisor.journal.directory.stat().st_mode & 0o077 == 0


@pytest.mark.parametrize("state", [JobState.CI_PENDING, JobState.MERGE_QUEUED, JobState.MERGED])
def test_closed_issue_can_reconcile_a_real_merged_pr(state: JobState) -> None:
    daemon = make_canary(state)
    daemon.pipeline.tasks.cached.return_value = []  # type: ignore[attr-defined]
    daemon.pipeline.jobs.load()["521"].pull_request = 77
    daemon.pipeline.github.pull_request_status = Mock(return_value=SimpleNamespace(state="MERGED"))  # type: ignore[method-assign]
    assert daemon._loop() == 0
    daemon.pipeline.run_job.assert_called_once_with("521")  # type: ignore[attr-defined]


def test_unadmitted_open_pr_cannot_be_advanced() -> None:
    daemon = make_canary(JobState.CI_PENDING)
    daemon.pipeline.tasks.cached.return_value = []  # type: ignore[attr-defined]
    daemon.pipeline.jobs.load()["521"].pull_request = 77
    daemon.pipeline.github.pull_request_status = Mock(return_value=SimpleNamespace(state="OPEN"))  # type: ignore[method-assign]
    with pytest.raises(ConfigurationError):
        daemon._loop()
    daemon.pipeline.run_job.assert_not_called()  # type: ignore[attr-defined]


def test_other_profile_cli_keeps_original_refusal_exit_code(
    neptune_config: FactoryConfig, monkeypatch: pytest.MonkeyPatch
) -> None:
    other = neptune_config.model_copy(update={"repository_profile": "hellotalk"})
    monkeypatch.setattr(cli, "protect_process_credentials", lambda: None)
    monkeypatch.setattr(cli, "_config", lambda: other)
    run = Mock()
    monkeypatch.setattr(canary, "run_canary", run)
    assert cli.main(["task", "run", "--issue", "521"]) == 2
    run.assert_not_called()
