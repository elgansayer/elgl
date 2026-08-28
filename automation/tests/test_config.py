import os
from pathlib import Path

import pytest

from openhands_factory import cli
from openhands_factory.architecture_guard import EXPECTED_FACTORY_ARCHITECTURE
from openhands_factory.cli import _config
from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError

RETIRED_SYSTEMD_UNITS = {
    "hellotalk-swarm.service",
    "hellotalk-aider.service",
    "hellotalk-swarm-watchdog.service",
    "hellotalk-guardian.service",
    "hellotalk-resolver.service",
    "hellotalk-reviewer.service",
    "hellotalk-meta-agent.service",
}

RETIRED_EXECUTOR_FILENAMES = {
    "architect.py",
    "auto_dispatcher.py",
    "swarm.py",
    "aider.py",
    "guardian.py",
    "resolver.py",
    "reviewer.py",
    "pr_reviewer.py",
}


def test_worker_image_reuses_the_node_base_image_user() -> None:
    containerfile = (Path(__file__).parents[1] / "Containerfile").read_text(encoding="utf-8")

    assert "usermod --login worker" in containerfile
    assert "useradd --create-home --uid 1000 worker" not in containerfile


def test_quarantine_recovery_cli_is_targetable_and_quiet_by_default() -> None:
    defaults = cli.parser().parse_args(["backlog", "requeue-quarantined"])
    selected = cli.parser().parse_args(
        [
            "backlog",
            "requeue-quarantined",
            "--issue",
            "42",
            "--issue",
            "43",
            "--announce",
        ]
    )

    assert defaults.issue is None
    assert defaults.announce is False
    assert selected.issue == [42, 43]
    assert selected.announce is True


def test_active_label_reconciliation_batch_is_typed_and_bounded() -> None:
    configured = FactoryConfig.from_environment(
        environment(FACTORY_LABEL_RECONCILIATION_BATCH_SIZE="17")
    )

    assert configured.label_reconciliation_batch_size == 17
    with pytest.raises(ConfigurationError, match="batch size must be between 1 and 100"):
        FactoryConfig.from_environment(environment(FACTORY_LABEL_RECONCILIATION_BATCH_SIZE="0"))
    with pytest.raises(ConfigurationError, match="batch size must be between 1 and 100"):
        FactoryConfig.from_environment(environment(FACTORY_LABEL_RECONCILIATION_BATCH_SIZE="101"))


def test_bootstrap_installs_a_self_contained_factory_package() -> None:
    setup = (Path(__file__).parents[2] / "setup-debian.sh").read_text(encoding="utf-8")

    assert "--no-editable" in setup
    assert "-- cypress install" in setup
    assert "merge --ff-only origin/main" in setup
    assert "hellotalk-factory@users.noreply.github.com" in setup
    assert "hellotalk-factory-watchdog.sh" in setup
    assert '"$FACTORY_STATE/recovery"' in setup
    assert "uv==0.12.5" in setup
    assert "--inexact" in setup
    assert "bash -c \\" in setup
    assert 'cd "$1" && exec podman build' in setup
    assert '"$1/Containerfile" "$1"' in setup


def test_deployment_is_pinned_to_clean_main() -> None:
    deploy = (Path(__file__).parents[2] / "scripts/deploy-and-start-factory.sh").read_text(
        encoding="utf-8"
    )

    assert "DEPLOY_REF=main" in deploy
    assert "FACTORY_DEPLOY_REF must be main" in deploy
    assert 'git -C "$FACTORY_CHECKOUT" switch main' in deploy
    assert 'git -C "$FACTORY_CHECKOUT" merge --ff-only origin/main' in deploy
    assert "status --porcelain" in deploy


def test_failed_deployment_restores_previously_active_factory_units() -> None:
    deploy = (Path(__file__).parents[2] / "scripts/deploy-and-start-factory.sh").read_text(
        encoding="utf-8"
    )

    trap = deploy.index("trap cleanup EXIT")
    stop_timer = deploy.index("systemctl stop hellotalk-factory-health.timer")
    stop_watchdog = deploy.index("systemctl stop hellotalk-factory-health.service")
    stop_daemon = deploy.index("systemctl stop hellotalk-factory.service")
    start = deploy.index('"$WORKTREE/scripts/start-factory.sh"')
    completed = deploy.index("DEPLOYMENT_SUCCEEDED=true", start)

    assert trap < stop_timer < stop_watchdog < stop_daemon < start < completed
    assert "FACTORY_MAINTENANCE_STARTED=true" in deploy
    assert "Factory supervision units did not stop cleanly" in deploy
    assert 'if [ "$FACTORY_SERVICE_WAS_ACTIVE" = true ]; then' in deploy
    assert "systemctl start hellotalk-factory.service" in deploy
    assert 'if [ "$FACTORY_HEALTH_TIMER_WAS_ACTIVE" = true ]; then' in deploy
    assert "systemctl start hellotalk-factory-health.timer" in deploy
    assert "Factory deployment failed; restoring the previously active supervision units." in deploy


def test_deployment_preserves_operator_agent_routing_configuration() -> None:
    deploy = (Path(__file__).parents[2] / "scripts/deploy-and-start-factory.sh").read_text(
        encoding="utf-8"
    )

    assert "if [ ! -f /etc/hellotalk-factory/agents.json ]; then" in deploy
    assert "/etc/hellotalk-factory/agents.previous.json" not in deploy
    assert "/etc/hellotalk-factory/agents.example.json" in deploy


def test_deployment_refreshes_all_runtime_dependencies_and_worker_image() -> None:
    deploy = (Path(__file__).parents[2] / "scripts/deploy-and-start-factory.sh").read_text(
        encoding="utf-8"
    )

    assert '"$FACTORY_UV" sync' in deploy
    assert "--active --frozen --inexact --no-editable --extra development" in deploy
    assert "FACTORY_UV_VERSION=0.12.5" in deploy
    assert '"$FACTORY_VIRTUAL_ENV/bin/python" -m pip install' in deploy
    assert '"uv==$FACTORY_UV_VERSION"' in deploy
    assert "Factory dependency refresh removed the pinned uv executable" in deploy
    assert '"$FACTORY_CHECKOUT/admin-portal"' in deploy
    assert 'npm ci --prefix "$directory"' in deploy
    assert "npm exec -- cypress install" in deploy
    assert "podman build --cgroup-manager=cgroupfs" in deploy
    assert 'bash -c \'cd "$1" && exec podman build' in deploy
    assert '"$1/Containerfile" "$1"' in deploy
    assert "localhost/hellotalk-factory-worker:current" in deploy


def test_deployment_repairs_and_preserves_the_pinned_uv_bootstrap() -> None:
    deploy = (Path(__file__).parents[2] / "scripts/deploy-and-start-factory.sh").read_text(
        encoding="utf-8"
    )

    repair = deploy.index('"$FACTORY_VIRTUAL_ENV/bin/python" -m pip install')
    refresh = deploy.index('"$FACTORY_UV" sync')
    survival_check = deploy.index("Factory dependency refresh removed the pinned uv executable")

    assert repair < refresh < survival_check
    assert "--active --frozen --inexact --no-editable --extra development" in deploy
    assert '"uv==$FACTORY_UV_VERSION"' in deploy


def test_fast_deployment_reuses_only_verified_dependencies_and_worker_image() -> None:
    deploy = (Path(__file__).parents[2] / "scripts/deploy-and-start-factory.sh").read_text(
        encoding="utf-8"
    )

    assert "--fast) FAST_DEPLOY=true" in deploy
    assert "npm_input_fingerprint" in deploy
    assert 'sha256sum "$directory/package.json" "$directory/package-lock.json"' in deploy
    assert "sha256sum node_modules/.package-lock.json" in deploy
    assert "find node_modules -type f -name package.json" in deploy
    assert "find node_modules/.bin" in deploy
    assert 'git -C "$WORKTREE" ls-files -s -- automation' in deploy
    assert "podman image inspect --format '{{.Id}}'" in deploy
    assert "npm_cache_is_current" in deploy
    assert "worker_cache_is_current" in deploy
    assert deploy.index('npm ci --prefix "$directory"') < deploy.index(
        'record_npm_cache "$directory" "$cache_file"'
    )
    assert deploy.index("podman build --cgroup-manager=cgroupfs") < deploy.index(
        'record_worker_cache "$worker_cache_file"'
    )


def test_deployment_serialises_runs_and_drains_the_active_watchdog() -> None:
    deploy = (Path(__file__).parents[2] / "scripts/deploy-and-start-factory.sh").read_text(
        encoding="utf-8"
    )

    assert "hellotalk-factory-deploy.lock" in deploy
    assert 'flock -n "$deploy_lock_fd"' in deploy
    stop_timer = deploy.index("systemctl stop hellotalk-factory-health.timer")
    stop_watchdog = deploy.index("systemctl stop hellotalk-factory-health.service")
    stop_daemon = deploy.index("systemctl stop hellotalk-factory.service")
    dependency_refresh = deploy.index('npm ci --prefix "$directory"')
    assert stop_timer < stop_watchdog < stop_daemon < dependency_refresh


def test_deployment_installs_bounded_host_storage_policy() -> None:
    repository_root = Path(__file__).parents[2]
    deploy = (repository_root / "scripts/deploy-and-start-factory.sh").read_text(encoding="utf-8")
    maintenance = (repository_root / "scripts/maintain-factory-host-storage.sh").read_text(
        encoding="utf-8"
    )
    journal_policy = (
        repository_root / "config/systemd/99-hellotalk-factory-storage.conf"
    ).read_text(encoding="utf-8")

    maintenance_call = '"$SCRIPT_DIRECTORY/maintain-factory-host-storage.sh" --apply'
    assert maintenance_call in deploy
    assert deploy.index(maintenance_call) < deploy.index('fetch origin "$DEPLOY_REF"')
    assert "SystemMaxUse=512M" in journal_policy
    assert "SystemKeepFree=5G" in journal_policy
    assert "MaxRetentionSec=14day" in journal_policy
    assert "docker image prune" in maintenance
    assert "docker builder prune" in maintenance
    assert "docker system prune" not in maintenance
    assert "docker volume prune" not in maintenance
    assert "docker container prune" not in maintenance
    assert "--prune-docker requires --apply" in maintenance


def test_legacy_github_agent_workflows_stay_retired() -> None:
    workflows = Path(__file__).parents[2] / ".github" / "workflows"

    for name in ("architect.yml", "auto-dispatcher.yml", "openhands.yml", "pr-reviewer.yml"):
        assert not (workflows / name).exists()


def test_final_merge_gate_respects_human_requested_changes() -> None:
    workflow = (
        Path(__file__).parents[2] / ".github" / "workflows" / "factory-merge.yml"
    ).read_text(encoding="utf-8")

    assert "reviewDecision" in workflow
    assert '.reviewDecision != "CHANGES_REQUESTED"' in workflow
    assert "headRefOid" in workflow
    assert '--match-head-commit "$head_sha"' in workflow
    assert '== "factory/independent-review")] | length) >= 1' in workflow
    assert '== "CI / required")] | length) >= 1' in workflow
    assert workflow.count("| not))] | length) == 0") == 2
    assert "--auto" not in workflow
    assert "--admin" not in workflow


def test_retired_autonomous_entrypoints_cannot_reappear() -> None:
    repository_root = Path(__file__).parents[2]
    systemd = repository_root / "config" / "systemd"
    factory_sources = repository_root / "automation" / "openhands_factory"
    scripts = repository_root / "scripts"

    offenders: list[str] = []

    for name in RETIRED_SYSTEMD_UNITS:
        if (systemd / name).exists():
            offenders.append(str((systemd / name).relative_to(repository_root)))

    for root in (factory_sources, scripts):
        if not root.exists():
            continue
        for path in root.rglob("*"):
            if path.is_file() and path.name in RETIRED_EXECUTOR_FILENAMES:
                offenders.append(str(path.relative_to(repository_root)))

    assert offenders == [], f"retired autonomous executor entrypoints reappeared: {offenders}"


def test_service_allows_rootless_podman_user_namespace_helpers() -> None:
    unit = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory.service"
    ).read_text(encoding="utf-8")

    assert "NoNewPrivileges=true" not in unit
    assert "RestrictSUIDSGID=true" not in unit
    assert "ProtectProc=ptraceable" in unit
    assert "ProtectKernelLogs=true" not in unit
    assert "/opt/hellotalk-factory/venv/bin" in unit


def test_factory_secret_environment_is_installed_root_only() -> None:
    repository_root = Path(__file__).parents[2]
    scripts = "\n".join(
        path.read_text(encoding="utf-8")
        for path in (
            repository_root / "scripts/install-factory-env.sh",
            repository_root / "scripts/repair-factory-host.sh",
            repository_root / "setup-debian.sh",
        )
    )

    assert "chown root:root" in scripts
    assert "chmod 0600" in scripts
    assert "install -o root -g root -m 0600" in scripts


def test_factory_git_auth_is_scoped_and_does_not_require_service_user_login() -> None:
    repository_root = Path(__file__).parents[2]
    setup = (repository_root / "setup-debian.sh").read_text(encoding="utf-8")
    deploy = (repository_root / "scripts/deploy-and-start-factory.sh").read_text(encoding="utf-8")

    assert setup.index("factory.env") < setup.index("git -c credential.helper")
    for script in (setup, deploy):
        assert 'GH_TOKEN="$factory_github_token"' in script
        assert "config --add credential.helper ''" in script
        assert "config --add credential.helper" in script
        assert "gh auth login" not in script


def test_factory_environment_installer_does_not_copy_legacy_gemini_secrets() -> None:
    installer = (Path(__file__).parents[2] / "scripts" / "install-factory-env.sh").read_text(
        encoding="utf-8"
    )

    assert "GEMINI_ENABLED$" not in installer
    assert "|GEMINI_|" not in installer
    assert 'key == "GEMINI_ENABLED"' in installer
    assert 'print "GEMINI_ENABLED=false"' in installer


def test_service_delegates_only_its_cgroup_beneath_the_parent_resource_cap() -> None:
    unit = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory.service"
    ).read_text(encoding="utf-8")

    assert "Delegate=yes" in unit
    assert "ProtectControlGroups=false" in unit
    assert "MemoryHigh=6G" in unit
    assert "MemoryMax=7G" in unit
    assert "TasksMax=1024" in unit


def test_service_runs_bounded_startup_preflight_before_daemon() -> None:
    unit_lines = (
        (Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory.service")
        .read_text(encoding="utf-8")
        .splitlines()
    )
    preflight = "ExecStartPre=/opt/hellotalk-factory/venv/bin/hellotalk-factory providers check"
    daemon = "ExecStart=/opt/hellotalk-factory/venv/bin/hellotalk-factory daemon"

    assert preflight in unit_lines
    assert unit_lines.index(preflight) < unit_lines.index(daemon)


def test_health_service_is_a_root_daemon_recovery_watchdog() -> None:
    unit = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory-health.service"
    ).read_text(encoding="utf-8")
    timer = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory-health.timer"
    ).read_text(encoding="utf-8")
    watchdog = (
        Path(__file__).parents[2] / "config" / "systemd" / "hellotalk-factory-watchdog.sh"
    ).read_text(encoding="utf-8")

    assert "User=hellotalk-factory" not in unit
    assert "ExecStart=/bin/bash /opt/hellotalk-factory/hellotalk-factory-watchdog.sh" in unit
    assert "Delegate=yes" not in unit
    assert "OnUnitActiveSec=2min" in timer
    assert 'systemctl restart "$SERVICE"' in watchdog
    assert "FACTORY_WATCHDOG_RESTART_GRACE_SECONDS:-30" in watchdog
    assert 'sleep "$RESTART_GRACE_SECONDS"' in watchdog
    assert "sleep 20" not in watchdog
    assert "for attempt in 1 2 3" in watchdog
    assert "alert-daemon-failed" in watchdog
    assert "active_started_at" in watchdog
    assert "FACTORY_MAX_TASK_MINUTES" in watchdog
    assert "dashboard sync" in watchdog
    assert "restart_request_is_safe" in watchdog
    assert "control_request.json" in watchdog
    assert "jobs-quarantined" not in watchdog
    assert "jobs-stalled" not in watchdog
    for directive in (
        "PrivateTmp=true",
        "ProtectHome=false",
        "BindPaths=/run/user",
        "ProtectKernelModules=true",
        "ProtectKernelLogs=true",
        "ProtectClock=true",
        "LockPersonality=true",
        "RestrictRealtime=true",
        "SystemCallArchitectures=native",
    ):
        assert directive in unit


def environment(**overrides: str) -> dict[str, str]:
    values = {
        "OPENCODE_GO_API_KEY": "not-a-real-key",
        "OPENCODE_GO_MODEL": "deepseek-v4-flash",
        "GITHUB_TOKEN": "not-a-real-token",
        "GEMINI_ENABLED": "false",
    }
    values.update(overrides)
    return values


def test_missing_required_environment_is_rejected() -> None:
    with pytest.raises(ConfigurationError, match="GITHUB_TOKEN"):
        FactoryConfig.from_environment({})


def test_gemini_cannot_be_enabled_in_the_production_factory() -> None:
    with pytest.raises(ConfigurationError, match="GEMINI_ENABLED is retired"):
        FactoryConfig.from_environment(
            environment(GEMINI_ENABLED="true", GEMINI_API_KEY="not-a-real-key")
        )


def test_retired_factory_architecture_is_rejected() -> None:
    with pytest.raises(ConfigurationError, match="FACTORY_ARCHITECTURE must be"):
        FactoryConfig.from_environment(environment(FACTORY_ARCHITECTURE="old-swarm"))


def test_default_repository_is_production_clone() -> None:
    config = FactoryConfig.from_environment(environment())
    assert config.repository == Path("/var/lib/hellotalk-factory/repository")
    assert config.minimum_free_disk_gib == 5
    assert config.recovery_retention_hours == 72
    assert config.stall_alert_minutes == 20
    assert config.max_parallel_jobs == 5
    assert config.factory_architecture == EXPECTED_FACTORY_ARCHITECTURE
    assert config.factory_generation == "unknown"
    assert config.repository_profile == "hellotalk"
    assert config.prompt_dir == config.repository / "automation" / "prompts"
    assert config.system_prompt_path == config.prompt_dir / "system.md"
    assert config.provider_capacity_dir == config.state_dir
    assert config.require_trusted_intake is False
    assert config.trusted_github_actors == frozenset({"elgansayer"})
    assert config.control_github_actors == frozenset({"elgansayer"})
    assert config.agents.routing_enabled is False
    assert config.agents.providers["openhands"].enabled is True
    assert config.agents.providers["claude"].enabled is False
    assert config.agents.routing.implementation[0] == "claude"


def test_repository_profile_paths_and_shared_capacity_are_configurable(tmp_path: Path) -> None:
    repository = tmp_path / "workout-agent"
    prompt_dir = tmp_path / "trusted-prompts"
    configured = FactoryConfig.from_environment(
        environment(
            FACTORY_REPOSITORY=str(repository),
            FACTORY_STATE_DIR=str(tmp_path / "state"),
            FACTORY_REPOSITORY_PROFILE="workout-agent",
            FACTORY_PROMPT_DIR=str(prompt_dir),
            FACTORY_SYSTEM_PROMPT_PATH=str(prompt_dir / "workout-agent-system.md"),
            FACTORY_PROVIDER_CAPACITY_DIR=str(tmp_path / "shared"),
            GITHUB_REPOSITORY="elgansayer/workout-agent",
        )
    )

    assert configured.repository_profile == "workout-agent"
    assert configured.prompt_dir == prompt_dir
    assert configured.system_prompt_path == prompt_dir / "workout-agent-system.md"
    assert configured.provider_capacity_dir == tmp_path / "shared"


def test_unknown_repository_profile_is_rejected() -> None:
    with pytest.raises(ConfigurationError, match="repository_profile"):
        FactoryConfig.from_environment(environment(FACTORY_REPOSITORY_PROFILE="unknown"))


def test_agent_routing_rejects_unknown_provider_names(tmp_path: Path) -> None:
    config_path = tmp_path / "agents.json"
    config_path.write_text(
        '{"routing_enabled": true, "providers": {"openhands": {"enabled": true}}, '
        '"routing": {"implementation": ["missing"]}}',
        encoding="utf-8",
    )
    with pytest.raises(ConfigurationError, match="Unknown agent provider"):
        FactoryConfig.from_environment(
            environment(
                FACTORY_AGENTS_CONFIG=str(config_path),
            )
        )


def test_agent_routing_rejects_misspelled_configuration_fields(tmp_path: Path) -> None:
    config_path = tmp_path / "agents.json"
    config_path.write_text(
        '{"routing_enabled": true, "providers": {'
        '"codex": {"enabled": true, "max_concurency": 9}}, '
        '"routing": {"implementation": ["codex"]}}',
        encoding="utf-8",
    )

    with pytest.raises(ConfigurationError, match="max_concurency"):
        FactoryConfig.from_environment(environment(FACTORY_AGENTS_CONFIG=str(config_path)))


def test_agent_routing_rejects_a_phase_without_an_enabled_provider(tmp_path: Path) -> None:
    config_path = tmp_path / "agents.json"
    config_path.write_text(
        '{"routing_enabled": true, "providers": {'
        '"codex": {"enabled": false}, "pi": {"enabled": true}}, '
        '"routing": {"implementation": ["codex"]}}',
        encoding="utf-8",
    )

    with pytest.raises(ConfigurationError, match=r"implementation.*no enabled provider"):
        FactoryConfig.from_environment(environment(FACTORY_AGENTS_CONFIG=str(config_path)))


def test_production_agent_configuration_loads() -> None:
    config_path = Path(__file__).parents[2] / "config/factory/agents.production.json"

    factory_config = FactoryConfig.from_environment(
        environment(FACTORY_AGENTS_CONFIG=str(config_path))
    )

    assert factory_config.agents.routing_enabled
    assert factory_config.agents.providers["claude"].enabled
    assert factory_config.agents.providers["claude"].model == "fable"
    assert factory_config.agents.providers["claude"].credential_paths == [
        ".claude",
        ".claude.json",
    ]
    assert factory_config.agents.providers["codex"].model == "gpt-5.6-sol"
    assert factory_config.agents.providers["codex"].enabled
    assert factory_config.agents.providers["codex"].credential_paths == [".codex"]
    assert factory_config.agents.providers["google"].enabled is True
    assert factory_config.agents.providers["google"].command == "agy"
    assert factory_config.agents.providers["google"].cli_variant == "antigravity"
    assert factory_config.agents.providers["google"].model == "gemini-3.1-pro-high"
    assert factory_config.agents.providers["opencode"].model == "opencode-go/deepseek-v4-flash"
    assert factory_config.agents.providers["opencode"].enabled
    assert factory_config.agents.providers["opencode"].credential_paths == [
        ".config/opencode",
        ".local/share/opencode",
    ]
    assert factory_config.agents.providers["openhands"].emergency_only
    assert not factory_config.agents.providers["openhands"].enabled
    assert factory_config.agents.providers["pi"].enabled
    assert factory_config.agents.providers["pi"].model == "github-copilot/claude-sonnet-5"
    assert factory_config.agents.providers["pi"].credential_paths == [".pi"]
    assert factory_config.agents.routing.implementation == [
        "claude",
        "codex",
        "google",
        "opencode",
        "pi",
    ]
    assert factory_config.agents.routing.code_review == [
        "codex",
        "claude",
        "google",
        "opencode",
        "pi",
    ]
    assert factory_config.agents.routing.general_action == [
        "opencode",
        "google",
        "codex",
        "claude",
        "pi",
    ]


@pytest.mark.parametrize(
    "credential_path",
    ("/tmp/provider", "../other-provider", ".", "safe|unsafe"),
)
def test_agent_routing_rejects_unsafe_provider_home_mounts(
    tmp_path: Path,
    credential_path: str,
) -> None:
    config_path = tmp_path / "agents.json"
    config_path.write_text(
        '{"routing_enabled": true, "providers": {'
        f'"codex": {{"enabled": true, "credential_paths": ["{credential_path}"]}}}}, '
        '"routing": {"implementation": ["codex"]}}',
        encoding="utf-8",
    )

    with pytest.raises(ConfigurationError, match="Unsafe provider home mount"):
        FactoryConfig.from_environment(environment(FACTORY_AGENTS_CONFIG=str(config_path)))


def test_agent_routing_rejects_google_variant_on_another_provider(tmp_path: Path) -> None:
    config_path = tmp_path / "agents.json"
    config_path.write_text(
        '{"routing_enabled": true, "providers": {'
        '"codex": {"enabled": true, "cli_variant": "gemini"}}, '
        '"routing": {"implementation": ["codex"]}}',
        encoding="utf-8",
    )

    with pytest.raises(ConfigurationError, match=r"cli_variant.*google"):
        FactoryConfig.from_environment(environment(FACTORY_AGENTS_CONFIG=str(config_path)))


def test_agent_routing_rejects_a_transport_the_adapter_would_ignore(tmp_path: Path) -> None:
    config_path = tmp_path / "agents.json"
    config_path.write_text(
        '{"routing_enabled": true, "providers": {'
        '"codex": {"enabled": true, "transport": "openhands-sdk"}}, '
        '"routing": {"implementation": ["codex"]}}',
        encoding="utf-8",
    )

    with pytest.raises(ConfigurationError, match=r"codex.*requires transport.*cli"):
        FactoryConfig.from_environment(environment(FACTORY_AGENTS_CONFIG=str(config_path)))


def test_openhands_transport_defaults_to_the_sdk_and_rejects_an_explicit_cli(
    tmp_path: Path,
) -> None:
    config_path = tmp_path / "agents.json"
    config_path.write_text(
        '{"routing_enabled": false, "providers": {'
        '"openhands": {"enabled": true, "transport": "cli"}}}',
        encoding="utf-8",
    )

    with pytest.raises(ConfigurationError, match=r"openhands.*requires transport.*openhands-sdk"):
        FactoryConfig.from_environment(environment(FACTORY_AGENTS_CONFIG=str(config_path)))


def test_subscription_provider_rejects_api_auth_mode(tmp_path: Path) -> None:
    config_path = tmp_path / "agents.json"
    config_path.write_text(
        '{"routing_enabled": true, "providers": {'
        '"codex": {"enabled": true, "auth_mode": "api"}}, '
        '"routing": {"implementation": ["codex"]}}',
        encoding="utf-8",
    )

    with pytest.raises(ConfigurationError, match=r"codex.*requires auth_mode.*subscription"):
        FactoryConfig.from_environment(environment(FACTORY_AGENTS_CONFIG=str(config_path)))


def test_factory_environment_template_contains_runtime_path_settings() -> None:
    template = (Path(__file__).parents[2] / "config/systemd/factory.env.example").read_text(
        encoding="utf-8"
    )

    assert "FACTORY_PODMAN_PATH=/usr/bin/podman" in template
    assert "FACTORY_TASK_IMAGE=localhost/hellotalk-factory-worker:current" in template
    assert "FACTORY_RECOVERY_DIR=/var/lib/hellotalk-factory/recovery" in template
    assert "FACTORY_AGENTS_CONFIG=/etc/hellotalk-factory/agents.json" in template
    assert "FACTORY_REQUIRE_READY_LABEL=false" in template
    assert "FACTORY_MAX_PARALLEL_JOBS=3" in template
    assert "FACTORY_LABEL_RECONCILIATION_BATCH_SIZE=25" in template
    assert "FACTORY_REQUIRE_TRUSTED_INTAKE=true" in template
    assert "FACTORY_TRUSTED_GITHUB_ACTORS=elgansayer,app/github-actions" in template
    assert "FACTORY_CONTROL_GITHUB_ACTORS=elgansayer" in template
    assert f"FACTORY_ARCHITECTURE={EXPECTED_FACTORY_ARCHITECTURE}" in template
    assert "GEMINI_ENABLED=false" in template


def test_start_script_uses_the_systemd_service_path_for_online_doctor() -> None:
    root = Path(__file__).parents[2]
    start_script = (root / "scripts/start-factory.sh").read_text(encoding="utf-8")
    service = (root / "config/systemd/hellotalk-factory.service").read_text(encoding="utf-8")
    service_path = next(
        line.removeprefix("Environment=PATH=")
        for line in service.splitlines()
        if line.startswith("Environment=PATH=")
    )

    assert "FACTORY_HOME=/home/dev" in start_script
    service_path_expression = service_path.replace("/home/dev", "$FACTORY_HOME")
    assert f'FACTORY_SERVICE_PATH="{service_path_expression}"' in start_script
    assert 'export HOME="$FACTORY_HOME"' in start_script
    path_export = 'export PATH="$FACTORY_SERVICE_PATH"'
    assert path_export in start_script
    assert start_script.index(path_export) < start_script.index("doctor --online")


def test_host_repair_preserves_the_production_parallelism_limit() -> None:
    repair = (Path(__file__).parents[2] / "scripts/repair-factory-host.sh").read_text(
        encoding="utf-8"
    )

    assert "FACTORY_MAX_PARALLEL_JOBS=3" in repair
    assert "FACTORY_MAX_PARALLEL_JOBS=5" not in repair
    assert "FACTORY_REQUIRE_TRUSTED_INTAKE=true" in repair
    assert "FACTORY_TRUSTED_GITHUB_ACTORS=elgansayer,app/github-actions" in repair
    assert "FACTORY_CONTROL_GITHUB_ACTORS=elgansayer" in repair


def test_cli_keeps_parsed_secrets_out_of_provider_child_environments(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    expected = FactoryConfig.from_environment(environment())
    monkeypatch.setattr(FactoryConfig, "from_environment", lambda: expected)
    monkeypatch.setenv("GITHUB_TOKEN", "github-secret")
    monkeypatch.setenv("OPENAI_API_KEY", "openai-secret")
    monkeypatch.setenv("TELEGRAM_BOT_TOKEN", "telegram-secret")
    monkeypatch.setenv("FACTORY_VISIBLE_SETTING", "retained")

    loaded = _config()

    assert loaded is expected
    assert "GITHUB_TOKEN" not in os.environ
    assert "OPENAI_API_KEY" not in os.environ
    assert "TELEGRAM_BOT_TOKEN" not in os.environ
    assert os.environ["FACTORY_VISIBLE_SETTING"] == "retained"


def test_cli_protects_process_before_loading_secret_configuration(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    events: list[str] = []
    expected = FactoryConfig.from_environment(environment())
    monkeypatch.setattr(
        cli,
        "protect_process_credentials",
        lambda: events.append("process-protected"),
    )

    def load_config() -> FactoryConfig:
        events.append("configuration-loaded")
        return expected

    monkeypatch.setattr(cli, "_config", load_config)

    assert cli.main(["task", "run", "--dry-run"]) == 0
    assert events == ["process-protected", "configuration-loaded"]


def test_parallel_job_limit_must_be_positive() -> None:
    with pytest.raises(ConfigurationError, match="factory limits must be positive"):
        FactoryConfig.from_environment(environment(FACTORY_MAX_PARALLEL_JOBS="0"))


def test_disk_reserve_cannot_be_disabled() -> None:
    with pytest.raises(ConfigurationError, match="at least 1 GiB"):
        FactoryConfig.from_environment(environment(FACTORY_MINIMUM_FREE_DISK_GIB="0"))


def test_recovery_retention_must_be_positive() -> None:
    with pytest.raises(ConfigurationError, match="recovery retention must be positive"):
        FactoryConfig.from_environment(environment(FACTORY_RECOVERY_RETENTION_HOURS="0"))


def test_stall_alert_threshold_must_be_positive() -> None:
    with pytest.raises(ConfigurationError, match="stall alert threshold must be positive"):
        FactoryConfig.from_environment(environment(FACTORY_STALL_ALERT_MINUTES="0"))


def test_repo_factory_service_is_instance_scoped_and_resource_bounded() -> None:
    root = Path(__file__).parents[2]
    unit = (root / "config/systemd/repo-factory@.service").read_text(encoding="utf-8")
    slice_unit = (root / "config/systemd/repo-factory.slice").read_text(encoding="utf-8")

    assert "EnvironmentFile=/etc/repo-factory/instances/%i.env" in unit
    assert "WorkingDirectory=/var/lib/repo-factory/%i/repository" in unit
    assert "Slice=repo-factory.slice" in unit
    assert "ExecStart=/opt/hellotalk-factory/venv/bin/repo-factory daemon" in unit
    assert "MemoryMax=7G" in slice_unit


def test_workout_instance_is_hourly_single_job_and_uses_shared_capacity() -> None:
    root = Path(__file__).parents[2]
    profile = (root / "config/factory/instances/workout-agent.env").read_text(encoding="utf-8")

    assert "FACTORY_REPOSITORY_PROFILE=workout-agent" in profile
    assert "FACTORY_MAX_PARALLEL_JOBS=1" in profile
    assert "FACTORY_NEW_ISSUE_INTERVAL_SECONDS=3600" in profile
    assert "FACTORY_REQUIRE_READY_LABEL=true" in profile
    assert "FACTORY_PROVIDER_CAPACITY_DIR=/var/lib/repo-factory/shared" in profile
    assert "GITHUB_REPOSITORY=elgansayer/workout-agent" in profile


def test_instance_installer_preserves_legacy_rollback_path() -> None:
    installer = (Path(__file__).parents[2] / "scripts/install-repo-factory-instance.sh").read_text(
        encoding="utf-8"
    )

    assert "SECONDARY_MOUNT=/mnt/HC_Volume_106574422" in installer
    assert "--reference-if-able" in installer
    assert "hellotalk-factory-update.timer" in installer
    assert "repo-factory-update.timer" in installer
    assert "localhost/repo-factory-worker:current" in installer
    assert "rm -rf" not in installer


def test_repo_factory_update_coordinates_both_instances() -> None:
    root = Path(__file__).parents[2]
    script = (root / "config/systemd/hellotalk-factory-update.sh").read_text(encoding="utf-8")
    unit = (root / "config/systemd/repo-factory-update.service").read_text(encoding="utf-8")

    assert "all_factories_idle" in script
    assert "restore_services_on_failure" in script
    assert "localhost/repo-factory-worker:current" in script
    assert "REPO_FACTORY_SECONDARY_SERVICE=repo-factory@workout-agent.service" in unit
