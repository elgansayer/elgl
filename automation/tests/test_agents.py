import unittest
from datetime import UTC, datetime
from pathlib import Path
from unittest.mock import patch

from openhands_factory.agents.base import (
    AgentPhase,
    AgentRequest,
    ProviderHealth,
    ProviderStatus,
)
from openhands_factory.agents.claude import ClaudeCodeProvider
from openhands_factory.agents.codex import CodexProvider
from openhands_factory.agents.google import GoogleAgentProvider
from openhands_factory.agents.health import AgentCircuitBreaker, AgentFailureKind
from openhands_factory.agents.opencode import OpenCodeProvider
from openhands_factory.agents.router import AgentRouter
from openhands_factory.models import Job, Task


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


class TestAgentProviders(unittest.IsolatedAsyncioTestCase):
    @patch("openhands_factory.agents.claude.PTYWrapper.execute", return_value="success output")
    async def test_claude_provider(self, _mock_execute):
        provider = ClaudeCodeProvider()
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = await provider._run_async(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "success output")

    @patch("openhands_factory.agents.codex.PTYWrapper.execute", return_value="codex success")
    async def test_codex_provider(self, _mock_execute):
        provider = CodexProvider()
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = await provider._run_async(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "codex success")

    @patch("openhands_factory.agents.google.PTYWrapper.execute", return_value="google success")
    async def test_google_provider(self, _mock_execute):
        provider = GoogleAgentProvider()
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = await provider._run_async(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "google success")

    @patch("openhands_factory.agents.opencode.PTYWrapper.execute", return_value="opencode success")
    async def test_opencode_provider(self, _mock_execute):
        provider = OpenCodeProvider()
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(
            phase=AgentPhase.IMPLEMENTATION,
            task=task,
            prompt="do it",
            cwd=Path("/tmp"),
        )

        result = await provider._run_async(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "opencode success")
