from pathlib import Path

from openhands_factory.config import FactoryConfig
from openhands_factory.doctor import agent_provider_checks


def _config(tmp_path: Path) -> FactoryConfig:
    repository = tmp_path / "repository"
    repository.mkdir()
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


def test_doctor_reports_openhands_as_the_sole_outer_execution_control_plane(
    tmp_path: Path,
) -> None:
    checks = {check.name: check for check in agent_provider_checks(_config(tmp_path))}

    assert checks["agent-routing"].passed
    assert checks["agent-routing"].detail == "OpenHands single control plane"
    assert checks["agent:openhands"].passed
    assert checks["agent:openhands"].detail == "sole outer execution control plane"

    for name in ("claude", "codex", "google", "opencode"):
        assert checks[f"agent:{name}"].passed
        assert checks[f"agent:{name}"].detail == "disabled direct executor"


def test_doctor_source_does_not_resurrect_direct_provider_health_probes() -> None:
    source = (
        Path(__file__).parents[1] / "openhands_factory" / "doctor.py"
    ).read_text(encoding="utf-8")

    for retired_executor in (
        "ClaudeCodeProvider",
        "CodexProvider",
        "GoogleAgentProvider",
        "OpenCodeProvider",
    ):
        assert retired_executor not in source
