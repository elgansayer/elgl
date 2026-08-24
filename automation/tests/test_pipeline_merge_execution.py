from pathlib import Path

from openhands_factory.config import FactoryConfig
from openhands_factory.github import PullRequestStatus
from openhands_factory.models import Job, JobState, Task
from openhands_factory.pipeline import FactoryPipeline


class GitHub:
    def __init__(self) -> None:
        self.statuses = [
            PullRequestStatus(
                77,
                "OPEN",
                False,
                "MERGEABLE",
                "",
                "reviewed-head",
                True,
                False,
                merge_state_status="CLEAN",
            ),
            PullRequestStatus(
                77,
                "MERGED",
                False,
                "UNKNOWN",
                "",
                "reviewed-head",
                True,
                False,
                merge_state_status="UNKNOWN",
            ),
        ]
        self.merges: list[tuple[int, str]] = []

    def pull_request_status(self, pull_request: int) -> PullRequestStatus:
        assert pull_request == 77
        return self.statuses.pop(0)

    def merge_pull_request(self, pull_request: int, expected_head_sha: str) -> None:
        self.merges.append((pull_request, expected_head_sha))


def _config(tmp_path: Path) -> FactoryConfig:
    repository = tmp_path / "repository"
    prompts = repository / "automation/prompts"
    prompts.mkdir(parents=True)
    for name in (
        "system",
        "task",
        "review",
        "repair",
        "security",
        "quality_repair",
        "architect",
    ):
        (prompts / f"{name}.md").write_text(f"{name} instructions", encoding="utf-8")
    return FactoryConfig.from_environment(
        {
            "FACTORY_REPOSITORY": str(repository),
            "FACTORY_STATE_DIR": str(tmp_path / "state"),
            "FACTORY_LOG_DIR": str(tmp_path / "log"),
            "FACTORY_PROFILE_STORE": str(tmp_path / "profiles"),
            "FACTORY_WORKTREE_DIR": str(tmp_path / "worktrees"),
            "FACTORY_RECOVERY_DIR": str(tmp_path / "recovery"),
            "OPENCODE_GO_API_KEY": "key",
            "OPENCODE_GO_MODEL": "deepseek-v4-flash",
            "GITHUB_TOKEN": "token",
            "GEMINI_ENABLED": "false",
        }
    )


def test_merge_queued_job_executes_and_confirms_exact_reviewed_head(tmp_path: Path) -> None:
    github = GitHub()
    pipeline = FactoryPipeline(
        _config(tmp_path),
        github=github,  # type: ignore[arg-type]
        conversations=object(),  # type: ignore[arg-type]
        agent_router=object(),  # type: ignore[arg-type]
    )
    job = Job(
        task=Task(
            "77",
            "Fix merge execution",
            "Body",
            "github-pull-request",
            5,
            pr_branch="fix/merge",
        ),
        state=JobState.MERGE_QUEUED,
        branch="fix/merge",
        pull_request=77,
        head_sha="reviewed-head",
    )
    pipeline.jobs.save({"77": job})

    result = pipeline.run_job("77")

    assert result is not None
    assert result.state is JobState.MERGED
    assert github.merges == [(77, "reviewed-head")]
    events = pipeline.pr_lifecycle.snapshot()
    assert [item["event"] for item in events] == ["merge-queued", "merged"]
    assert {item["head_sha"] for item in events} == {"reviewed-head"}
