from pathlib import Path


REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _workflow(name: str) -> str:
    return (REPOSITORY_ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8")


def test_e2e_runner_context_skips_factory_only_pull_requests() -> None:
    workflow = _workflow("e2e-runner-context.yml")

    expected_ignored_paths = (
        "      - 'automation/**'",
        "      - 'docs/**'",
        "      - 'config/factory/**'",
        "      - 'config/systemd/**'",
        "      - '.github/dependabot.yml'",
    )
    assert "    paths-ignore:\n" in workflow
    for path in expected_ignored_paths:
        assert path in workflow


def test_cypress_setup_smoke_only_runs_for_frontend_pull_requests() -> None:
    workflow = _workflow("cypress-setup-smoke.yml")

    assert "    paths:\n      - 'frontend/**'\n" in workflow
    assert "      - '.github/workflows/cypress-setup-smoke.yml'\n" in workflow
