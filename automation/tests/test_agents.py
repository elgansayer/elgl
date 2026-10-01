import unittest
from datetime import UTC, datetime
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from openhands_factory.agents.base import (
    AgentFailure,
    AgentFailureKind,
    AgentPhase,
    AgentRequest,
    AgentResult,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.claude import ClaudeCodeProvider
from openhands_factory.agents.codex import CodexProvider
from openhands_factory.agents.google import GoogleAgentProvider
from openhands_factory.agents.health import AgentCircuitBreaker
from openhands_factory.agents.opencode import OpenCodeProvider
from openhands_factory.agents.openhands import OpenHandsProvider
from openhands_factory.agents.process import ProcessResult
from openhands_factory.agents.router import AgentRouter
from openhands_factory.conversation_runner import ConversationProviderError, ConversationResult
from openhands_factory.models import FailureKind, Job, Task


class DummyProvider:
    name = "dummy"

    def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.name,
            status=ProviderStatus.HEALTHY,
            checked_at=datetime.now(UTC),
        )

    def supports(self, phase: AgentPhase) -> bool:
        return True


class ResultProvider:
    def __init__(self, name: str, result: AgentResult) -> None:
        self.name = name
        self.result = result
        self.calls = 0

    def health(self) -> ProviderHealth:
        return ProviderHealth(
            provider=self.name,
            status=ProviderStatus.HEALTHY,
            checked_at=datetime.now(UTC),
        )

    def supports(self, phase: AgentPhase) -> bool:
        return True

    def run(self, request: AgentRequest) -> AgentResult:
        self.calls += 1
        return self.result


class OrderedPolicy:
    def candidates(self, phase, job, provider_health):
        return ["first", "second"]


class TestAgentRouter(unittest.TestCase):
    def test_routing_acquire(self):
        provider = DummyProvider()
        router = AgentRouter(providers=[provider])
        task = Task("1", "test", "body", "issue", 1)
        job = Job(task=task)

        acquired = router.acquire(phase=AgentPhase.IMPLEMENTATION, task=task, job=job)
        self.assertIsNotNone(acquired)
        self.assertEqual(acquired.name, "dummy")

    def test_routing_exclude(self):
        provider = DummyProvider()
        router = AgentRouter(providers=[provider])
        task = Task("1", "test", "body", "issue", 1)
        job = Job(task=task)

        acquired = router.acquire(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            job=job,
            exclude={"dummy"},
        )
        self.assertIsNone(acquired)

    def test_provider_failure_falls_back_to_next_provider(self):
        task = Task("1", "test", "body", "issue", 1)
        job = Job(task=task)
        failed = AgentResult(
            provider="first",
            phase=AgentPhase.IMPLEMENTATION,
            success=False,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
            exit_code=1,
            summary=None,
            output_path=None,
            failure=AgentFailure(AgentFailureKind.PROVIDER_TIMEOUT, "timed out"),
        )
        succeeded = AgentResult(
            provider="second",
            phase=AgentPhase.IMPLEMENTATION,
            success=True,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
            exit_code=0,
            summary="done",
            output_path=None,
            failure=None,
        )
        first = ResultProvider("first", failed)
        second = ResultProvider("second", succeeded)
        router = AgentRouter([first, second], policy=OrderedPolicy(), same_provider_retries=0)

        with TemporaryDirectory() as directory:
            request = AgentRequest(
                phase=AgentPhase.IMPLEMENTATION,
                task=task,
                prompt="do it",
                cwd=Path(directory),
            )
            result = router.run(request, job)

        self.assertTrue(result.success)
        self.assertEqual(result.provider, "second")
        self.assertEqual(first.calls, 1)
        self.assertEqual(second.calls, 1)

    def test_task_failure_is_not_rotated_to_another_provider(self):
        task = Task("1", "test", "body", "issue", 1)
        job = Job(task=task)
        failed = AgentResult(
            provider="first",
            phase=AgentPhase.IMPLEMENTATION,
            success=False,
            started_at=datetime.now(UTC),
            finished_at=datetime.now(UTC),
            exit_code=1,
            summary=None,
            output_path=None,
            failure=AgentFailure(AgentFailureKind.TASK_FAILURE, "tests failed"),
        )
        first = ResultProvider("first", failed)
        second = ResultProvider(
            "second",
            AgentResult(
                provider="second",
                phase=AgentPhase.IMPLEMENTATION,
                success=True,
                started_at=datetime.now(UTC),
                finished_at=datetime.now(UTC),
                exit_code=0,
                summary="should not run",
                output_path=None,
                failure=None,
            ),
        )
        router = AgentRouter([first, second], policy=OrderedPolicy())

        with TemporaryDirectory() as directory:
            result = router.run(
                AgentRequest(AgentPhase.IMPLEMENTATION, task, "do it", Path(directory)),
                job,
            )

        self.assertFalse(result.success)
        self.assertEqual(first.calls, 1)
        self.assertEqual(second.calls, 0)


class TestHealthTracking(unittest.TestCase):
    def test_circuit_breaker(self):
        breaker = AgentCircuitBreaker(provider="test", failure_threshold=2, cooldown_seconds=60)
        self.assertTrue(breaker.permits_call())

        breaker.record_failure(AgentFailureKind.PROVIDER_UNAVAILABLE)
        self.assertTrue(breaker.permits_call())
        self.assertEqual(breaker.state, "closed")

        breaker.record_failure(AgentFailureKind.PROVIDER_UNAVAILABLE)
        self.assertFalse(breaker.permits_call())
        self.assertEqual(breaker.state, "open")

        breaker.record_success()
        self.assertTrue(breaker.permits_call())
        self.assertEqual(breaker.state, "closed")


class FakeProcessRunner:
    def __init__(self, output: str) -> None:
        self.output = output
        self.commands: list[tuple[str, ...]] = []
        self.cwds: list[Path] = []
        self.stdin: list[str | None] = []
        self.attached_prompt: str | None = None

    def run(
        self,
        command,
        *,
        cwd,
        env,
        stdin_text,
        timeout_seconds,
        max_output_bytes,
        home_mounts=(),
    ):
        del env, timeout_seconds, max_output_bytes, home_mounts
        self.commands.append(tuple(command))
        self.cwds.append(cwd)
        self.stdin.append(stdin_text)
        if "--file" in command:
            prompt_path = Path(command[command.index("--file") + 1])
            self.attached_prompt = prompt_path.read_text(encoding="utf-8")
        return ProcessResult(
            tuple(command),
            0,
            self.output,
            "",
            False,
            False,
            0.1,
        )


class FakeOpenHandsRunner:
    def __init__(self) -> None:
        self.timeout_seconds: float | None = None

    def run(
        self,
        task: Task,
        workspace: Path,
        prompt: str,
        *,
        timeout_seconds: float | None = None,
    ) -> ConversationResult:
        del workspace, prompt
        self.timeout_seconds = timeout_seconds
        return ConversationResult(task.identifier, 0.1, True)


class TimedOutOpenHandsRunner:
    def run(
        self,
        task: Task,
        workspace: Path,
        prompt: str,
        *,
        timeout_seconds: float | None = None,
    ) -> ConversationResult:
        del task, workspace, prompt, timeout_seconds
        from openhands_factory.exceptions import FactoryError

        raise FactoryError("Conversation exceeded the maximum task duration")


class FailedOpenHandsRunner:
    def __init__(self, failure_kind: FailureKind) -> None:
        self.failure_kind = failure_kind

    def run(
        self,
        task: Task,
        workspace: Path,
        prompt: str,
        *,
        timeout_seconds: float | None = None,
    ) -> ConversationResult:
        del task, workspace, prompt, timeout_seconds
        raise ConversationProviderError(
            "typed SDK provider failure",
            self.failure_kind,
            retry_after_seconds=45,
        )


class TestAgentProviders(unittest.TestCase):
    def test_openhands_provider_honours_the_routed_phase_timeout(self):
        runner = FakeOpenHandsRunner()
        provider = OpenHandsProvider(runner)  # type: ignore[arg-type]
        task = Task("1", "test", "body", "issue", 1)

        result = provider.run(
            AgentRequest(
                phase=AgentPhase.CODE_REVIEW,
                task=task,
                prompt="review it",
                cwd=Path("/tmp"),
                timeout_seconds=123,
            )
        )

        self.assertTrue(result.success)
        self.assertEqual(runner.timeout_seconds, 123)

    def test_openhands_timeout_is_eligible_for_provider_fallback(self):
        provider = OpenHandsProvider(TimedOutOpenHandsRunner())  # type: ignore[arg-type]
        task = Task("1", "test", "body", "issue", 1)

        result = provider.run(
            AgentRequest(
                phase=AgentPhase.CODE_REVIEW,
                task=task,
                prompt="review it",
                cwd=Path("/tmp"),
                timeout_seconds=123,
            )
        )

        self.assertFalse(result.success)
        self.assertIsNotNone(result.failure)
        self.assertEqual(result.failure.kind, AgentFailureKind.PROVIDER_TIMEOUT)

    def test_openhands_preserves_inner_provider_failure_for_outer_fallback(self):
        expected = {
            FailureKind.AUTHENTICATION: AgentFailureKind.PROVIDER_AUTH,
            FailureKind.CONFIGURATION: AgentFailureKind.PROVIDER_UNAVAILABLE,
            FailureKind.BUDGET: AgentFailureKind.PROVIDER_QUOTA,
            FailureKind.RATE_LIMIT: AgentFailureKind.PROVIDER_RATE_LIMIT,
            FailureKind.MALFORMED_RESPONSE: AgentFailureKind.INVALID_AGENT_OUTPUT,
            FailureKind.TRANSIENT: AgentFailureKind.PROVIDER_TRANSPORT,
        }
        task = Task("1", "test", "body", "issue", 1)

        for failure_kind, agent_kind in expected.items():
            provider = OpenHandsProvider(FailedOpenHandsRunner(failure_kind))  # type: ignore[arg-type]
            result = provider.run(
                AgentRequest(
                    phase=AgentPhase.IMPLEMENTATION,
                    task=task,
                    prompt="implement",
                    cwd=Path("/tmp"),
                )
            )

            self.assertFalse(result.success)
            self.assertIsNotNone(result.failure)
            self.assertEqual(result.failure.kind, agent_kind)
            self.assertEqual(result.failure.retry_after_seconds, 45)

    def test_wrapper_is_used_for_health_probes(self):
        self.assertEqual(
            ClaudeCodeProvider(wrapper_command="agent-wrapper").auth_probe()[0][:2],
            ["agent-wrapper", "claude"],
        )
        self.assertEqual(
            CodexProvider(wrapper_command="agent-wrapper").auth_probe()[0][:2],
            ["agent-wrapper", "codex"],
        )
        self.assertEqual(
            OpenCodeProvider(wrapper_command="agent-wrapper").auth_probe()[0][:2],
            ["agent-wrapper", "opencode"],
        )
        self.assertEqual(
            GoogleAgentProvider(wrapper_command="agent-wrapper").auth_probe()[0][:2],
            ["agent-wrapper", "agy"],
        )

    def test_health_cache_can_be_invalidated_before_circuit_probe(self):
        runner = FakeProcessRunner('{"loggedIn": true, "authMethod": "claude.ai"}')
        provider = ClaudeCodeProvider(process_runner=runner)

        with patch("openhands_factory.agents.cli.shutil.which", return_value="/usr/bin/claude"):
            first = provider.health()
            cached = provider.health()
            provider.invalidate_health_cache()
            refreshed = provider.health()

        self.assertEqual(first.status, ProviderStatus.HEALTHY)
        self.assertEqual(cached.status, ProviderStatus.HEALTHY)
        self.assertEqual(refreshed.status, ProviderStatus.HEALTHY)
        self.assertEqual(len(runner.commands), 2)

    def test_claude_rejects_malformed_authentication_probe(self):
        runner = FakeProcessRunner("not-json")
        provider = ClaudeCodeProvider(process_runner=runner)

        with patch("openhands_factory.agents.cli.shutil.which", return_value="/usr/bin/claude"):
            health = provider.health()

        self.assertEqual(health.status, ProviderStatus.AUTH_REQUIRED)
        self.assertIn("could not be verified", health.detail or "")

    def test_health_probe_uses_a_disposable_empty_workspace(self):
        runner = FakeProcessRunner('{"loggedIn": true, "authMethod": "claude.ai"}')
        provider = ClaudeCodeProvider(process_runner=runner)

        with patch("openhands_factory.agents.cli.shutil.which", return_value="/usr/bin/claude"):
            health = provider.health()

        self.assertEqual(health.status, ProviderStatus.HEALTHY)
        self.assertEqual(len(runner.cwds), 1)
        self.assertNotEqual(runner.cwds[0], Path.cwd())
        self.assertFalse(runner.cwds[0].exists())

    def test_claude_provider(self):
        runner = FakeProcessRunner("success output")
        provider = ClaudeCodeProvider(process_runner=runner)
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = provider.run(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "success output")
        self.assertIn("fable", runner.commands[0])
        self.assertNotIn("--max-turns", runner.commands[0])
        self.assertIn("--safe-mode", runner.commands[0])
        self.assertEqual(runner.stdin, ["do it"])

    def test_claude_separates_factory_policy_from_untrusted_task_prompt(self):
        runner = FakeProcessRunner("success output")
        provider = ClaudeCodeProvider(process_runner=runner)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=Task("1", "test", "body", "issue", 1),
            prompt="untrusted issue text",
            cwd=Path("/tmp"),
            system_prompt="trusted factory policy",
        )

        provider.run(request)

        command = runner.commands[0]
        self.assertEqual(
            command[command.index("--append-system-prompt") + 1],
            "trusted factory policy",
        )
        self.assertEqual(runner.stdin, ["untrusted issue text"])

    def test_claude_uses_max_effort_for_build_critical_phases(self):
        runner = FakeProcessRunner("success output")
        provider = ClaudeCodeProvider(process_runner=runner)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=Task("1", "test", "body", "issue", 1),
            prompt="do it",
            cwd=Path("/tmp"),
        )

        provider.run(request)

        command = runner.commands[0]
        self.assertEqual(command[command.index("--effort") + 1], "max")

    def test_claude_uses_low_effort_for_repair_class_phases(self):
        # quality_repair/code_review/ci_repair are the fast/haiku-tier phases -
        # attempt_mechanical_repair() already resolves the purely mechanical CI
        # failures before an agent is invoked, so what reaches here rarely
        # needs "max" reasoning.
        for phase in (AgentPhase.QUALITY_REPAIR, AgentPhase.CODE_REVIEW, AgentPhase.CI_REPAIR):
            runner = FakeProcessRunner("success output")
            provider = ClaudeCodeProvider(process_runner=runner)
            request = AgentRequest(
                phase=phase,
                task=Task("1", "test", "body", "issue", 1),
                prompt="do it",
                cwd=Path("/tmp"),
            )

            provider.run(request)

            command = runner.commands[0]
            self.assertEqual(
                command[command.index("--effort") + 1],
                "low",
                msg=f"expected low effort for {phase}",
            )

    def test_claude_uses_medium_effort_for_security_review(self):
        # Security-review is the same bounded-checklist shape as code-review
        # (already "low"), but higher-stakes, so it sits a tier above the
        # repair-class floor instead of matching "max" build-critical work.
        runner = FakeProcessRunner("success output")
        provider = ClaudeCodeProvider(process_runner=runner)
        request = AgentRequest(
            phase=AgentPhase.SECURITY_REVIEW,
            task=Task("1", "test", "body", "issue", 1),
            prompt="do it",
            cwd=Path("/tmp"),
        )

        provider.run(request)

        command = runner.commands[0]
        self.assertEqual(command[command.index("--effort") + 1], "medium")

    def test_codex_provider(self):
        runner = FakeProcessRunner("codex success")
        provider = CodexProvider(process_runner=runner)
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = provider.run(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "codex success")
        self.assertIn("--approve-for-me", runner.commands[0])
        self.assertNotIn("--sandbox", runner.commands[0])
        self.assertNotIn("-s", runner.commands[0])
        self.assertIn('model_reasoning_effort="max"', runner.commands[0])
        self.assertIn("gpt-5.6-sol", runner.commands[0])
        self.assertIn("--ignore-user-config", runner.commands[0])
        self.assertIn("--ignore-rules", runner.commands[0])
        self.assertNotIn("-a", runner.commands[0])
        self.assertEqual(runner.commands[0][-1], "-")

    def test_codex_separates_factory_policy_from_untrusted_task_prompt(self):
        runner = FakeProcessRunner("codex success")
        provider = CodexProvider(process_runner=runner)
        request = AgentRequest(
            phase=AgentPhase.CODE_REVIEW,
            task=Task("1", "test", "body", "issue", 1),
            prompt="untrusted issue text",
            cwd=Path("/tmp"),
            system_prompt="trusted factory policy",
        )

        provider.run(request)

        command = runner.commands[0]
        self.assertIn('developer_instructions="trusted factory policy"', command)
        self.assertEqual(runner.stdin, ["untrusted issue text"])

    def test_antigravity_provider_uses_secure_headless_mode(self):
        runner = FakeProcessRunner("google success")
        provider = GoogleAgentProvider(process_runner=runner)
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = provider.run(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "google success")
        self.assertIn("--dangerously-skip-permissions", runner.commands[0])
        self.assertIn("--disable-slash-commands", runner.commands[0])
        self.assertIn("gemini-3.1-pro-high", runner.commands[0])
        self.assertNotIn("auto", runner.commands[0])
        # gemini-3.1-pro-high already bakes its effort tier into the model
        # name; a separately-passed --effort is what breaks flash-tier
        # models below, so it must not be added when the model supplies its
        # own tier suffix.
        self.assertNotIn("--effort", runner.commands[0])
        # --sandbox silently breaks stdin as a prompt channel for agy (verified
        # directly on a real host), so the prompt must travel in argv instead.
        self.assertIsNone(runner.stdin[0])
        self.assertEqual(
            runner.commands[0][runner.commands[0].index("-p") + 1],
            "do it",
        )
        self.assertIn("--add-dir", runner.commands[0])
        self.assertEqual(
            runner.commands[0][runner.commands[0].index("--add-dir") + 1],
            "/tmp",
        )

    def test_antigravity_does_not_pass_a_conflicting_effort_for_a_tiered_model(self):
        # agy hard-errors ("--model X conflicts with --effort=Y") when a
        # model whose name already encodes an effort tier is combined with
        # a disagreeing --effort flag - this broke every phase routed to
        # gemini-3.7-flash-low until --effort stopped being forced to
        # "high" unconditionally.
        runner = FakeProcessRunner("google success")
        provider = GoogleAgentProvider(
            model="gemini-3.7-flash-low",
            process_runner=runner,
        )
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.QUALITY_REPAIR,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = provider.run(request)
        self.assertTrue(result.success)
        self.assertIn("gemini-3.7-flash-low", runner.commands[0])
        self.assertNotIn("--effort", runner.commands[0])

    def test_antigravity_passes_effort_high_for_an_untiered_model(self):
        runner = FakeProcessRunner("google success")
        provider = GoogleAgentProvider(
            model="gemini-experimental",
            process_runner=runner,
        )
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = provider.run(request)
        self.assertTrue(result.success)
        self.assertIn("gemini-experimental", runner.commands[0])
        self.assertEqual(
            runner.commands[0][runner.commands[0].index("--effort") + 1],
            "high",
        )

    def test_gemini_provider_remains_configurable(self):
        runner = FakeProcessRunner("google success")
        provider = GoogleAgentProvider(
            command="gemini",
            cli_variant="gemini",
            process_runner=runner,
        )
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = provider.run(request)

        self.assertTrue(result.success)
        self.assertIn("yolo", runner.commands[0])
        self.assertIn("auto", runner.commands[0])
        self.assertIn(
            "Apply the complete Factory instructions provided on standard input.",
            runner.commands[0],
        )
        self.assertEqual(runner.stdin, ["do it"])

    def test_old_antigravity_release_is_unavailable(self):
        runner = FakeProcessRunner("1.0.9")
        provider = GoogleAgentProvider(process_runner=runner)

        with patch("openhands_factory.agents.cli.shutil.which", return_value="/usr/bin/agy"):
            health = provider.health()

        self.assertEqual(health.status, ProviderStatus.UNAVAILABLE)
        self.assertIn("1.1.1", health.detail or "")
        self.assertEqual(runner.commands, [("agy", "--version")])

    def test_current_antigravity_release_probes_account_models(self):
        runner = FakeProcessRunner("1.1.13\ngemini-3.1-pro-high")
        provider = GoogleAgentProvider(process_runner=runner)

        with patch("openhands_factory.agents.cli.shutil.which", return_value="/usr/bin/agy"):
            health = provider.health()

        self.assertEqual(health.status, ProviderStatus.HEALTHY)
        self.assertEqual(runner.commands, [("agy", "--version"), ("agy", "models")])

    def test_antigravity_rejects_an_empty_model_catalogue(self):
        runner = FakeProcessRunner("")
        provider = GoogleAgentProvider(process_runner=runner)

        with (
            patch("openhands_factory.agents.cli.shutil.which", return_value="/usr/bin/agy"),
            patch.object(provider, "preflight_health", return_value=None),
        ):
            health = provider.health()

        self.assertEqual(health.status, ProviderStatus.UNAVAILABLE)
        self.assertIn("no models", health.detail or "")

    def test_antigravity_rejects_a_model_absent_from_the_account_catalogue(self):
        runner = FakeProcessRunner("1.1.13\ngemini-3.6-flash")
        provider = GoogleAgentProvider(process_runner=runner)

        with patch("openhands_factory.agents.cli.shutil.which", return_value="/usr/bin/agy"):
            health = provider.health()

        self.assertEqual(health.status, ProviderStatus.UNAVAILABLE)
        self.assertIn("gemini-3.1-pro-high", health.detail or "")

    def test_opencode_health_verifies_authentication_and_configured_model(self):
        runner = FakeProcessRunner("OpenCode Go\nopencode-go/kimi-k3")
        provider = OpenCodeProvider(process_runner=runner)

        with patch("openhands_factory.agents.cli.shutil.which", return_value="/usr/bin/opencode"):
            health = provider.health()

        self.assertEqual(health.status, ProviderStatus.HEALTHY)
        self.assertEqual(
            runner.commands,
            [("opencode", "models", "opencode-go"), ("opencode", "auth", "list")],
        )

    def test_opencode_rejects_a_model_absent_from_the_account_catalogue(self):
        runner = FakeProcessRunner("OpenCode Go\nopencode-go/kimi-k2.7-code")
        provider = OpenCodeProvider(process_runner=runner)

        with patch("openhands_factory.agents.cli.shutil.which", return_value="/usr/bin/opencode"):
            health = provider.health()

        self.assertEqual(health.status, ProviderStatus.UNAVAILABLE)
        self.assertIn("opencode-go/kimi-k3", health.detail or "")
        self.assertEqual(runner.commands, [("opencode", "models", "opencode-go")])

    def test_opencode_provider(self):
        runner = FakeProcessRunner("opencode success")
        provider = OpenCodeProvider(process_runner=runner)
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = provider.run(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "opencode success")
        self.assertEqual(runner.stdin, [None])
        self.assertEqual(runner.attached_prompt, "do it")
