from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]
FACTORY_ONLY_PR_PATHS = (
    "      - 'automation/**'",
    "      - 'docs/**'",
    "      - 'config/factory/**'",
    "      - 'config/systemd/**'",
    "      - '.github/dependabot.yml'",
)


def _workflow(name: str) -> str:
    return (REPOSITORY_ROOT / ".github" / "workflows" / name).read_text(encoding="utf-8")


def test_product_contract_workflows_only_run_for_their_inputs() -> None:
    expected_paths = {
        "core-compose-contract.yml": (
            "docker-compose*.yml",
            "scripts/verify-compose-orchestration.test.mjs",
        ),
        "e2e-core-flows-contract.yml": ("e2e/**", "scripts/verify-core-e2e-flows.mjs"),
        "e2e-runner-context.yml": ("e2e/**", ".github/workflows/e2e-runner-context.yml"),
    }
    for workflow_name, paths in expected_paths.items():
        workflow = _workflow(workflow_name)
        assert "    paths:\n" in workflow
        for path in paths:
            assert f"      - '{path}'\n" in workflow


def test_cypress_setup_smoke_only_runs_for_frontend_pull_requests() -> None:
    workflow = _workflow("cypress-setup-smoke.yml")

    assert "    paths:\n      - 'frontend/**'\n" in workflow
    assert "      - '.github/workflows/cypress-setup-smoke.yml'\n" in workflow
