import unittest
from unittest.mock import patch
from pathlib import Path
from datetime import datetime, UTC

from openhands_factory.agents.base import (
    AgentPhase,
    ProviderStatus,
    ProviderHealth,
    AgentFailure,
    AgentFailureKind,
)
from openhands_factory.agents.router import AgentRouter
from openhands_factory.models import Task, Job


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

        acquired = router.acquire(phase=AgentPhase.IMPLEMENTATION, task=task, job=job, exclude={"dummy"})
        self.assertIsNone(acquired)


class TestHealthTracking(unittest.TestCase):
    def test_circuit_breaker(self):
        from openhands_factory.agents.health import AgentCircuitBreaker, AgentFailureKind
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
    
    @patch("asyncio.create_subprocess_exec")
    async def test_claude_provider(self, mock_exec):
        from unittest.mock import AsyncMock
        from openhands_factory.agents.claude import ClaudeCodeProvider
        from openhands_factory.agents.base import AgentRequest, AgentPhase
        from openhands_factory.models import Task
        
        mock_process = AsyncMock()
        mock_process.communicate.return_value = (b"success output", b"")
        mock_process.returncode = 0
        mock_exec.return_value = mock_process
        
        provider = ClaudeCodeProvider()
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(phase=AgentPhase.IMPLEMENTATION, task=task, prompt="do it", cwd=Path("/tmp"))
        
        # Test async method directly
        result = await provider._run_async(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "success output")
        
    @patch("asyncio.create_subprocess_exec")
    async def test_codex_provider(self, mock_exec):
        from unittest.mock import AsyncMock
        from openhands_factory.agents.codex import CodexProvider
        from openhands_factory.agents.base import AgentRequest, AgentPhase
        from openhands_factory.models import Task
        
        mock_process = AsyncMock()
        mock_process.communicate.return_value = (b"codex success", b"")
        mock_process.returncode = 0
        mock_exec.return_value = mock_process
        
        provider = CodexProvider()
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(phase=AgentPhase.IMPLEMENTATION, task=task, prompt="do it", cwd=Path("/tmp"))
        
        result = await provider._run_async(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "codex success")

    @patch("asyncio.create_subprocess_exec")
    async def test_google_provider(self, mock_exec):
        from unittest.mock import AsyncMock
        from openhands_factory.agents.google import GoogleAgentProvider
        from openhands_factory.agents.base import AgentRequest, AgentPhase
        from openhands_factory.models import Task
        
        mock_process = AsyncMock()
        mock_process.communicate.return_value = (b"google success", b"")
        mock_process.returncode = 0
        mock_exec.return_value = mock_process
        
        provider = GoogleAgentProvider()
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(phase=AgentPhase.IMPLEMENTATION, task=task, prompt="do it", cwd=Path("/tmp"))
        
        result = await provider._run_async(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "google success")

    @patch("asyncio.create_subprocess_exec")
    async def test_opencode_provider(self, mock_exec):
        from unittest.mock import AsyncMock
        from openhands_factory.agents.opencode import OpenCodeProvider
        from openhands_factory.agents.base import AgentRequest, AgentPhase
        from openhands_factory.models import Task
        
        mock_process = AsyncMock()
        mock_process.communicate.return_value = (b"opencode success", b"")
        mock_process.returncode = 0
        mock_exec.return_value = mock_process
        
        provider = OpenCodeProvider()
        task = Task("1", "test", "body", "issue", 1)
        request = AgentRequest(phase=AgentPhase.IMPLEMENTATION, task=task, prompt="do it", cwd=Path("/tmp"))
        
        result = await provider._run_async(request)
        self.assertTrue(result.success)
        self.assertEqual(result.summary, "opencode success")

