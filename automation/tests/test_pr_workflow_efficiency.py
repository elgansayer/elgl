from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
FACTORY_ONLY_PR_PATHS = (
    "      - 'automation/**'",
    "      - 'factory-dashboard/**'",
    "      - 'docs/**'",
    "      - 'config/factory/**'",
    "      - 'config/systemd/**'",
    "      - '.github/dependabot.yml'",
)


def _workflow(name: str) -> str:
    return (REPOSITORY_ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8")


def test_product_impact_workflows_skip_factory_only_pull_requests() -> None:
    for workflow_name in (
        "core-compose-contract.yml",
        "e2e-core-flows-contract.yml",
        "e2e-runner-context.yml",
    ):
        workflow = _workflow(workflow_name)
        assert "    paths-ignore:\n" in workflow
        for path in FACTORY_ONLY_PR_PATHS:
            assert path in workflow


def test_cypress_setup_smoke_only_runs_for_frontend_pull_requests() -> None:
    workflow = _workflow("cypress-setup-smoke.yml")

    assert "    paths:\n      - 'frontend/**'\n" in workflow
    assert "      - '.github/workflows/cypress-setup-smoke.yml'\n" in workflow
