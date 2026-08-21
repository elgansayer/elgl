"""Explicitly gated, minimal live subscription CLI smoke tests."""

from __future__ import annotations

import os
from collections.abc import Callable
from pathlib import Path

import pytest

from openhands_factory.agents.base import AgentPhase, AgentRequest, ProviderStatus
from openhands_factory.agents.claude import ClaudeCodeProvider
from openhands_factory.agents.cli import CLIProvider
from openhands_factory.agents.codex import CodexProvider
from openhands_factory.agents.google import GoogleAgentProvider
from openhands_factory.agents.opencode import OpenCodeProvider
from openhands_factory.models import Task


def _smoke(provider: CLIProvider, tmp_path: Path) -> None:
    health = provider.health()
    assert health.status in {ProviderStatus.HEALTHY, ProviderStatus.DEGRADED}, health.detail
    task = Task("provider-smoke", "Provider smoke", "No repository work", "integration", 99)
    result = provider.run(
        AgentRequest(
            phase=AgentPhase.GENERAL_ACTION,
            task=task,
            cwd=tmp_path,
            system_prompt="Do not read or modify files. Do not run tools.",
            prompt="Reply with the single word OK and stop.",
            timeout_seconds=180,
            max_output_bytes=32_000,
        )
    )
    assert result.success, result.failure.message if result.failure else result.summary
    assert not any(tmp_path.iterdir())


@pytest.mark.parametrize(
    ("gate", "factory"),
    [
        ("FACTORY_TEST_CLAUDE", ClaudeCodeProvider),
        ("FACTORY_TEST_CODEX", CodexProvider),
        (
            "FACTORY_TEST_GOOGLE",
            lambda: GoogleAgentProvider(cli_variant="antigravity"),
        ),
        ("FACTORY_TEST_OPENCODE", OpenCodeProvider),
    ],
)
def test_live_subscription_cli_when_explicitly_enabled(
    gate: str,
    factory: Callable[[], CLIProvider],
    tmp_path: Path,
) -> None:
    if os.environ.get(gate) != "1":
        pytest.skip(f"set {gate}=1 to run this subscription smoke test")

    _smoke(factory(), tmp_path)
