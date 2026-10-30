from __future__ import annotations

from pathlib import Path
from typing import Any, cast

import pytest

from openhands_factory.agents.base import AgentPhase, AgentRequest
from openhands_factory.agents.router import run_preserving_git_link
from openhands_factory.models import Task

LINK = b"gitdir: /state/repository/.git/worktrees/issue-1436\n"


class RewritingProvider:
    name = "codex"

    def __init__(self, action: str) -> None:
        self.action = action

    def run(self, request: AgentRequest) -> Any:
        link = request.cwd / ".git"
        if self.action == "repoint":
            link.write_text("gitdir: /tmp/git-issue-1436\n")
        elif self.action == "delete":
            link.unlink()
        elif self.action == "crash":
            link.write_text("gitdir: /tmp/git-issue-1436\n")
            raise RuntimeError("provider crashed")
        return "result"


def _request(cwd: Path) -> AgentRequest:
    return AgentRequest(
        AgentPhase.QUALITY_REPAIR, Task("1436", "Issue", "Body", "github-issue", 1), "fix", cwd
    )


@pytest.mark.parametrize("action", ["repoint", "delete", "keep"])
def test_agent_cannot_leave_the_worktree_pointing_at_another_gitdir(
    tmp_path: Path, action: str
) -> None:
    (tmp_path / ".git").write_bytes(LINK)

    result = run_preserving_git_link(cast(Any, RewritingProvider(action)), _request(tmp_path))

    assert result == "result"
    assert (tmp_path / ".git").read_bytes() == LINK


def test_git_link_is_restored_even_when_the_provider_crashes(tmp_path: Path) -> None:
    (tmp_path / ".git").write_bytes(LINK)

    with pytest.raises(RuntimeError):
        run_preserving_git_link(cast(Any, RewritingProvider("crash")), _request(tmp_path))

    assert (tmp_path / ".git").read_bytes() == LINK


def test_a_workspace_without_a_git_link_is_left_alone(tmp_path: Path) -> None:
    run_preserving_git_link(cast(Any, RewritingProvider("keep")), _request(tmp_path))

    assert not (tmp_path / ".git").exists()
