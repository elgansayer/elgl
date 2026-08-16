import tempfile
import unittest
from datetime import UTC, datetime
from pathlib import Path
from threading import BoundedSemaphore
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
from openhands_factory.agents.health import AgentCircuitBreaker, AgentHealthStore
from openhands_factory.agents.opencode import OpenCodeProvider
from openhands_factory.agents.process import classify_cli_failure, redact_agent_output
from openhands_factory.agents.router import AgentRouter
from openhands_factory.exceptions import ProviderCapacityUnavailable
from openhands_factory.models import Job, Task
from openhands_factory.pty_wrapper import PTYResult


def result_for(
    provider: str,
    *,
    success: bool,
    kind: AgentFailureKind | None = None,
) -> AgentResult:
    now = datetime.now(UTC)
    return AgentResult(
        provider=provider,
        phase=AgentPhase.IMPLEMENTATION,
        success=success,
        started_at=now,
        finished_at=now,
        exit_code=0 if success else 1,
        summary="ok" if success else "failed",
        output_path=None,
        failure=(
            None
            if success
            else AgentFailure(kind=kind or AgentFailureKind.INVALID_AGENT_OUTPUT, message="failed")
        ),
    )


class ScriptedProvider:
    def __init__(self, name: str, results: list[AgentResult]) -> None:
        self.name = name
        self.results = results
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
        del request
        result = self.results[min(self.calls, len(self.results) - 1)]
        self.calls += 1
        return result


class TestAgentRouter(unittest.TestCase):
    def setUp(self) -> None:
        self.task = Task("1", "test", "body", "issue", 1)
        self.job = Job(task=self.task)
        self.request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=self.task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

    def test_routing_acquire(self):
        provider = ScriptedProvider("dummy", [result_for("dummy", success=True)])
        router = AgentRouter(providers=[provider])
        acquired = router.acquire(
            phase=AgentPhase.IMPLEMENTATION,
            task=self.task,
            job=self.job,
        )
        self.assertIsNotNone(acquired)
        self.assertEqual(acquired.name, "dummy")

    def test_routing_exclude(self):
        provider = ScriptedProvider("dummy", [result_for("dummy", success=True)])
        router = AgentRouter(providers=[provider])
        acquired = router.acquire(
            phase=AgentPhase.IMPLEMENTATION,
            task=self.task,
            job=self.job,
            exclude={"dummy"},
        )
        self.assertIsNone(acquired)

    def test_provider_failure_falls_through_to_next_provider(self):
        first = ScriptedProvider(
            "first",
            [result_for("first", success=False, kind=AgentFailureKind.PROVIDER_RATE_LIMIT)],
        )
        second = ScriptedProvider("second", [result_for("second", success=True)])
        router = AgentRouter(providers=[first, second])
        result = router.run(self.request, self.job)
        self.assertTrue(result.success)
        self.assertEqual(result.provider, "second")
        self.assertEqual(first.calls, 1)
        self.assertEqual(second.calls, 1)
        self.assertEqual(self.job.provider_history[0]["fallback_reason"], "provider_rate_limit")

    def test_task_failure_does_not_rotate_providers(self):
        first = ScriptedProvider(
            "first",
            [result_for("first", success=False, kind=AgentFailureKind.TASK_FAILURE)],
        )
        second = ScriptedProvider("second", [result_for("second", success=True)])
        router = AgentRouter(providers=[first, second])
        result = router.run(self.request, self.job)
        self.assertFalse(result.success)
        self.assertEqual(first.calls, 1)
        self.assertEqual(second.calls, 0)

    def test_all_provider_failures_become_capacity_deferral(self):
        first = ScriptedProvider(
            "first",
            [result_for("first", success=False, kind=AgentFailureKind.PROVIDER_UNAVAILABLE)],
        )
        second = ScriptedProvider(
            "second",
            [result_for("second", success=False, kind=AgentFailureKind.PROVIDER_AUTH)],
        )
        router = AgentRouter(providers=[first, second])
        with self.assertRaises(ProviderCapacityUnavailable):
            router.run(self.request, self.job)

    def test_busy_provider_is_skipped_without_exceeding_capacity(self):
        first = ScriptedProvider("first", [result_for("first", success=True)])
        second = ScriptedProvider("second", [result_for("second", success=True)])
        first_slot = BoundedSemaphore(1)
        self.assertTrue(first_slot.acquire(blocking=False))
        router = AgentRouter(
            providers=[first, second],
            provider_slots={"first": first_slot, "second": BoundedSemaphore(1)},
            skip_busy_providers=True,
        )
        try:
            result = router.run(self.request, self.job)
        finally:
            first_slot.release()
        self.assertEqual(result.provider, "second")
        self.assertEqual(first.calls, 0)
        self.assertEqual(second.calls, 1)

    def test_all_busy_providers_defer_instead_of_consuming_a_task_failure(self):
        provider = ScriptedProvider("only", [result_for("only", success=True)])
        slot = BoundedSemaphore(1)
        self.assertTrue(slot.acquire(blocking=False))
        router = AgentRouter(
            providers=[provider],
            provider_slots={"only": slot},
            skip_busy_providers=True,
        )
        try:
            with self.assertRaisesRegex(ProviderCapacityUnavailable, "busy"):
                router.run(self.request, self.job)
        finally:
            slot.release()
        self.assertEqual(provider.calls, 0)
        self.assertEqual(self.job.provider_history, [])


class TestHealthTracking(unittest.TestCase):
    def test_circuit_breaker(self):
        breaker = AgentCircuitBreaker(provider="test", failure_threshold=2, cooldown_seconds=60)
        self.assertTrue(breaker.permits_call())
        breaker.record_failure(AgentFailureKind.PROVIDER_UNAVAILABLE)
        self.assertTrue(breaker.permits_call())
        breaker.record_failure(AgentFailureKind.PROVIDER_UNAVAILABLE)
        self.assertFalse(breaker.permits_call())
        self.assertEqual(breaker.get_health().status, ProviderStatus.UNAVAILABLE)
        breaker.record_success()
        self.assertTrue(breaker.permits_call())
        self.assertEqual(breaker.state, "closed")

    def test_auth_failure_opens_typed_breaker_immediately(self):
        breaker = AgentCircuitBreaker(provider="test", failure_threshold=5, cooldown_seconds=60)
        breaker.record_failure(AgentFailureKind.PROVIDER_AUTH)
        self.assertFalse(breaker.permits_call())
        self.assertEqual(breaker.get_health().status, ProviderStatus.AUTH_REQUIRED)

    def test_health_store_round_trip_preserves_blocked_status(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "health.json"
            store = AgentHealthStore(path)
            breaker = AgentCircuitBreaker(provider="test", failure_threshold=2, cooldown_seconds=60)
            breaker.record_failure(AgentFailureKind.PROVIDER_QUOTA)
            store.save({"test": breaker})
            loaded = store.load()
            self.assertEqual(loaded["test"].blocked_status, ProviderStatus.QUOTA_EXHAUSTED)


class TestProcessClassification(unittest.TestCase):
    def test_timeout_is_typed(self):
        self.assertEqual(
            classify_cli_failure("", 124, timed_out=True),
            AgentFailureKind.PROVIDER_TIMEOUT,
        )

    def test_quota_is_not_collapsed_into_rate_limit(self):
        self.assertEqual(
            classify_cli_failure("quota exceeded", 1, timed_out=False),
            AgentFailureKind.PROVIDER_QUOTA,
        )

    def test_redacts_common_secret_shapes(self):
        text = "Authorization: Bearer super-secret-token api_key=abc123"
        redacted = redact_agent_output(text)
        self.assertNotIn("super-secret-token", redacted)
        self.assertNotIn("abc123", redacted)


class TestAgentProviders(unittest.IsolatedAsyncioTestCase):
    def setUp(self) -> None:
        task = Task("1", "test", "body", "issue", 1)
        self.request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

    async def _assert_provider(self, provider, output: str) -> None:
        with patch(
            "openhands_factory.agents.process.PTYWrapper.execute_result",
            return_value=PTYResult(output=output, exit_code=0),
        ):
            result = await provider._run_async(self.request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, output)
        self.assertEqual(result.exit_code, 0)

    async def test_claude_provider(self):
        await self._assert_provider(ClaudeCodeProvider(), "success output")

    async def test_codex_provider(self):
        await self._assert_provider(CodexProvider(), "codex success")

    async def test_google_provider(self):
        await self._assert_provider(GoogleAgentProvider(), "google success")

    async def test_opencode_provider(self):
        await self._assert_provider(OpenCodeProvider(), "opencode success")

    async def test_real_nonzero_exit_is_failure_even_without_error_word(self):
        with patch(
            "openhands_factory.agents.process.PTYWrapper.execute_result",
            return_value=PTYResult(output="plain failure", exit_code=7),
        ):
            result = await CodexProvider()._run_async(self.request)
        self.assertFalse(result.success)
        self.assertEqual(result.exit_code, 7)
