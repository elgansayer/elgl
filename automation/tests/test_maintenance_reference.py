from __future__ import annotations

import shutil
import subprocess
import sys

import pytest

from openhands_factory.agents.base import AgentPhase, AgentRequest
from openhands_factory.agents.claude import ClaudeCodeProvider
from openhands_factory.agents.google import GoogleAgentProvider
from openhands_factory.agents.process import AgentProcessRunner, provider_environment
from openhands_factory.models import Task


@pytest.mark.parametrize(
    "provider,flag",
    [
        (GoogleAgentProvider(), "--add-dir"),
        (GoogleAgentProvider(cli_variant="gemini"), "--include-directories"),
        (ClaudeCodeProvider(), "--add-dir"),
    ],
)
def test_planner_source_reference_is_explicit_and_canonical(tmp_path, provider, flag):
    source = tmp_path / "source"
    source.mkdir()
    alias = tmp_path / "repository-alias"
    alias.symlink_to(source, target_is_directory=True)
    request = AgentRequest(
        AgentPhase.GENERAL_ACTION,
        Task("maintenance", "Inspect source", "", "factory-internal", 0),
        "Inspect only the source reference",
        tmp_path / "scratch",
        read_only_reference=alias,
    )
    command = provider.build_command(request, provider.model, None)
    assert any(
        command[index] == flag and command[index + 1] == str(source)
        for index in range(len(command) - 1)
    )
    request.read_only_reference = None
    assert str(source) not in provider.build_command(request, provider.model, None)


def test_source_reference_survives_home_mask_but_cannot_be_written(tmp_path, monkeypatch):
    if shutil.which("unshare") is None:
        pytest.skip("Linux user namespace isolation is unavailable")
    probe = subprocess.run(
        ["unshare", "--user", "--map-root-user", "--mount", "/bin/true"],
        capture_output=True,
        timeout=10,
        check=False,
    )
    if probe.returncode:
        pytest.skip("Runner does not allow unprivileged mount namespaces")
    home = tmp_path / "home"
    source = home / "repository"
    source.mkdir(parents=True)
    reference = source / "reference.py"
    reference.write_text("tracked source evidence\n")
    (home / ".swarm_sudo").write_text("test fixture, not a credential")
    alias = tmp_path / "repository-alias"
    alias.symlink_to(source, target_is_directory=True)
    state = tmp_path / "state"
    workspace = state / "worktrees/analysis"
    workspace.mkdir(parents=True)
    logs = tmp_path / "logs"
    logs.mkdir()
    monkeypatch.setenv("FACTORY_REPOSITORY", str(alias))
    monkeypatch.setenv("FACTORY_STATE_DIR", str(state))
    monkeypatch.setenv("FACTORY_LOG_DIR", str(logs))
    script = """
import errno, os, sys
from pathlib import Path
source = Path(sys.argv[1])
assert source.read_text() == 'tracked source evidence\\n'
assert not (Path.home() / '.swarm_sudo').exists()
try:
    descriptor = os.open(source, os.O_WRONLY)
except OSError as error:
    assert error.errno == errno.EROFS, error.errno
else:
    os.close(descriptor)
    raise AssertionError('Source reference is writable')
print('source-readable-read-only')
"""
    result = AgentProcessRunner().run(
        [sys.executable, "-c", script, str(reference)],
        cwd=workspace,
        env=provider_environment({"HOME": str(home), "PATH": "/usr/bin:/bin"}),
        stdin_text=None,
        timeout_seconds=20,
        max_output_bytes=4000,
    )
    assert result.exit_code == 0, result.stderr
    assert "source-readable-read-only" in result.stdout
    assert reference.read_text() == "tracked source evidence\n"
