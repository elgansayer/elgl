from pathlib import Path

REPOSITORY = Path(__file__).parents[2]
RUNBOOK = REPOSITORY / "docs" / "factory" / "README.md"
EXECUTION_ARCHITECTURE = REPOSITORY / "docs" / "factory" / "execution-architecture.md"
ACTIVE_ARCHITECTURE = REPOSITORY / "docs" / "factory" / "ACTIVE_ARCHITECTURE.md"
AI_WORKFLOW = REPOSITORY / ".github" / "workflows" / "AI-WORKFLOW.md"
ENV_EXAMPLE = REPOSITORY / "config" / "systemd" / "factory.env.example"
SUBSCRIPTION_AGENTS = REPOSITORY / "docs" / "factory" / "SUBSCRIPTION-AGENTS.md"
CURRENT_AUDIT = REPOSITORY / "docs" / "factory" / "AUDIT-2026-08-17.md"
CONTROL_PANEL = REPOSITORY / "docs" / "factory" / "CONTROL-PANEL.md"
MANUAL_MERGE = REPOSITORY / "docs" / "factory" / "MANUAL-MERGE.md"
TASK_OWNERSHIP = REPOSITORY / "docs" / "factory" / "TASK-OWNERSHIP.md"

OPERATOR_RECOVERY_COMMANDS = (
    "doctor --online",
    "providers check",
    "status",
    "metrics",
    "dashboard sync --force",
    "reconcile",
    "pause",
    "resume",
    "backlog requeue-quarantined",
)


def test_runbook_documents_operator_recovery_commands() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    assert "## Operator recovery" in runbook
    recovery = runbook.split("## Operator recovery", 1)[1].split("\n## ", 1)[0]
    assert '/opt/hellotalk-factory/venv/bin/hellotalk-factory "$@"' in recovery
    assert 'PATH="$FACTORY_PATH"' in recovery
    for command in OPERATOR_RECOVERY_COMMANDS:
        assert f"factory_cli {command}" in recovery


def test_execution_architecture_locks_single_factory_owner_and_multiple_providers() -> None:
    architecture = EXECUTION_ARCHITECTURE.read_text(encoding="utf-8")

    for marker in (
        "exactly one autonomous orchestration control plane",
        "AgentRouter",
        "Claude Code CLI",
        "Codex CLI",
        "Google agent CLI",
        "OpenCode CLI",
        "OpenHands SDK",
        "No-provider capacity defers work",
        "bounded pull-request review lane",
    ):
        assert marker in architecture


def test_task_ownership_documents_atomic_claim_and_rollback_contract() -> None:
    ownership = TASK_OWNERSHIP.read_text(encoding="utf-8")
    architecture = EXECUTION_ARCHITECTURE.read_text(encoding="utf-8")
    active = ACTIVE_ARCHITECTURE.read_text(encoding="utf-8")
    workflow = AI_WORKFLOW.read_text(encoding="utf-8")

    for marker in (
        "one canonical implementation branch",
        "worker-distinct token",
        "compare-and-swap",
        "Before branch creation",
        "changed-path fingerprint",
        "explicitly supersedes",
        "crash-after-claim",
        "Upgrade and rollback",
        "additive state expansion",
    ):
        assert marker in ownership
    assert "TASK-OWNERSHIP.md" in architecture
    assert "TASK-OWNERSHIP.md" in active
    assert "equivalent-PR reconciliation" in workflow


def test_active_architecture_cannot_drift_back_to_competing_owners() -> None:
    architecture = ACTIVE_ARCHITECTURE.read_text(encoding="utf-8")

    required_contract = (
        "OpenHands Factory with interchangeable agents",
        "FACTORY_ARCHITECTURE=openhands-agent-canvas-v1",
        "AgentRouter",
        "Claude CLI",
        "Codex CLI",
        "OpenCode CLI",
        "OpenHands SDK adapter",
        "CI / required",
        "factory/independent-review",
        "A repeated identical task-side failure opens a durable, recoverable quarantine",
        "Any change to provider order",
    )
    for marker in required_contract:
        assert marker in architecture

    retired_runtime_claims = (
        "caveman claude",
        "separate self-patching meta-agent",
    )
    for marker in retired_runtime_claims:
        assert marker not in architecture


def test_workflow_and_environment_match_subscription_first_routing() -> None:
    workflow = AI_WORKFLOW.read_text(encoding="utf-8")
    environment = ENV_EXAMPLE.read_text(encoding="utf-8")

    assert "phase-specific AgentRouter selection" in workflow
    assert "Claude Code, Codex CLI, Google agent, OpenCode, OpenHands emergency" in workflow
    assert "provider-rotated repair" in workflow
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
        "one baseline GitHub ruleset requires pull requests",
    ):
        assert marker in runbook
    assert "Do not authenticate GitHub CLI as `hellotalk-factory`" in subscriptions
    assert "~/.config/gh/hosts.yml" in subscriptions


def test_current_audit_separates_source_quality_from_live_readiness() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    audit = CURRENT_AUDIT.read_text(encoding="utf-8")

    assert "AUDIT-2026-08-17.md" in runbook
    for marker in (
        "not working flawlessly",
        "remained active since",
        "GitHub enforces Factory review",
        "service-account provider capacity is constrained",
        "August 2026 model policy",
        "Codex option incompatibility",
        "live router selected Claude",
        "PR #7348 advanced remotely",
        "Required activation sequence",
    ):
        assert marker in audit


def test_control_panel_documents_remote_visibility_and_fixed_command_boundary() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    panel = CONTROL_PANEL.read_text(encoding="utf-8")

    assert "CONTROL-PANEL.md" in runbook
    for marker in (
        "factory-status",
        "factory-skip",
        "/factory pause",
        "/factory resume",
        "/factory restart",
        "never executed",
        "single-use",
        "stale panel timestamp",
        "no new inbound network exposure",
    ):
        assert marker in panel


def test_manual_merge_is_owner_only_and_can_bypass_all_checks() -> None:
    runbook = RUNBOOK.read_text(encoding="utf-8")
    workflow = AI_WORKFLOW.read_text(encoding="utf-8")
    manual_merge = MANUAL_MERGE.read_text(encoding="utf-8")

    assert "MANUAL-MERGE.md" in runbook
    assert "MANUAL-MERGE.md" in workflow
    for marker in (
        "Both rulesets have one bypass actor: the exact repository-owner `User`",
        "bypass_mode=pull_request",
        "push directly to `main`",
        "pull-request boundary",
        "Prefer waiting for `CI / required`",
        "Factory automation never invokes it",
    ):
        assert marker in manual_merge
