from pathlib import Path

REPOSITORY = Path(__file__).parents[2]
RUNBOOK = REPOSITORY / "docs" / "factory" / "README.md"
EXECUTION_ARCHITECTURE = REPOSITORY / "docs" / "factory" / "execution-architecture.md"
ACTIVE_ARCHITECTURE = REPOSITORY / "docs" / "factory" / "ACTIVE_ARCHITECTURE.md"
AI_WORKFLOW = REPOSITORY / ".github" / "workflows" / "AI-WORKFLOW.md"
ENV_EXAMPLE = REPOSITORY / "config" / "systemd" / "factory.env.example"
SUBSCRIPTION_AGENTS = REPOSITORY / "docs" / "factory" / "SUBSCRIPTION-AGENTS.md"

OPERATOR_RECOVERY_COMMANDS = (
    "doctor --online",
    "providers check",
    "status",
    "metrics",
    "reconcile",
    "pause",
    "resume",
    "backlog requeue-quarantined",
)


def test_runbook_documents_operator_recovery_commands() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    assert "## Operator recovery" in runbook
    recovery = runbook.split("## Operator recovery", 1)[1].split("\n## ", 1)[0]
    for command in OPERATOR_RECOVERY_COMMANDS:
        assert f"hellotalk-factory {command}" in recovery


def test_execution_architecture_locks_single_factory_owner_and_openhands_boundary() -> None:
    architecture = " ".join(EXECUTION_ARCHITECTURE.read_text(encoding="utf-8").split())

    for marker in (
        "exactly one autonomous orchestration control plane",
        "one production conversation boundary",
        "AgentRouter",
        "OpenHands SDK",
        "OpenAI subscription-backed Codex OAuth",
        "OpenCode Go subscription fallback",
        "Direct Claude, Codex, Google, and OpenCode outer providers are disabled",
        "No-provider capacity defers work",
    ):
        assert marker in architecture


def test_active_architecture_cannot_drift_back_to_competing_owners() -> None:
    architecture = " ".join(ACTIVE_ARCHITECTURE.read_text(encoding="utf-8").split())

    required_contract = (
        "OpenHands Factory with one production conversation boundary",
        "FACTORY_ARCHITECTURE=openhands-agent-canvas-v1",
        "AgentRouter",
        "OpenHands SDK",
        "OpenAI subscription-backed Codex OAuth",
        "OpenCode Go subscription fallback",
        "Google/Gemini is disabled",
        "Direct CLI outer adapters",
        "CI / required",
        "factory/independent-review",
        "Repeated identical task-side failures may open the durable recoverable task circuit",
        "Any change to the production conversation boundary",
    )
    for marker in required_contract:
        assert marker in architecture

    retired_runtime_claims = (
        "caveman claude",
        "separate self-patching meta-agent",
        "Emergency-only OpenHands remains behind",
    )
    for marker in retired_runtime_claims:
        assert marker not in architecture


def test_workflow_and_environment_match_openhands_subscription_boundary() -> None:
    workflow = " ".join(AI_WORKFLOW.read_text(encoding="utf-8").split())
    environment = ENV_EXAMPLE.read_text(encoding="utf-8")

    for marker in (
        "one OpenHands SDK conversation boundary",
        "OpenAI subscription-backed Codex OAuth",
        "OpenCode Go is the fallback",
        "Direct Claude Code, Codex CLI, Google agent, and OpenCode CLI outer adapters",
        "Google/Gemini is disabled",
    ):
        assert marker in workflow
    assert "Claude Code, Codex CLI, Google agent, OpenCode, OpenHands emergency" not in workflow
    assert "FACTORY_ARCHITECTURE=openhands-agent-canvas-v1" in environment
    assert "FACTORY_AGENTS_CONFIG=/etc/hellotalk-factory/agents.json" in environment
    assert "GEMINI_ENABLED=false" in environment
    assert "direct" in environment.lower()


def test_runbook_documents_agent_and_verification_credential_boundaries() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    subscriptions = SUBSCRIPTION_AGENTS.read_text(encoding="utf-8")

    for marker in (
        "inside private user, mount",
        "PID, and proc namespaces",
        "no-network namespace",
        "disposable empty directories",
        "run `gh auth login`",
        "persistent service-home GitHub credentials",
        "one active GitHub ruleset without bypass actors requires pull requests",
    ):
        assert marker in runbook
    assert "Do not authenticate GitHub CLI as `hellotalk-factory`" in subscriptions
    assert "~/.config/gh/hosts.yml" in subscriptions
