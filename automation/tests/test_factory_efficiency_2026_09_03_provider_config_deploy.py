import subprocess
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (REPOSITORY_ROOT / path).read_text(encoding="utf-8")


def _function_range(script: str, first: str, after: str) -> str:
    start = script.index(first)
    end = script.index(after, start)
    return script[start:end]


def test_updater_reconciles_provider_policy_from_verified_commits() -> None:
    updater = _read("config/systemd/hellotalk-factory-update.sh")

    # The live config is external to the checkout, so deployment is part of the contract.
    assert "AGENTS_CONFIG=${FACTORY_AGENTS_CONFIG:-/etc/hellotalk-factory/agents.json}" in updater
    assert "AGENTS_CONFIG_SOURCE=config/factory/agents.production.json" in updater
    assert 'readlink -m -- "$candidate"' in updater
    assert "/etc/repo-factory/*|/etc/hellotalk-factory/*" in updater
    assert "agents_config_metadata_current" in updater
    assert "repository_managed_agents_config" in updater
    assert "agents_config_matches_commit" in updater
    assert "Adopting verified repository-managed provider policy" in updater
    assert "stat -Lc '%u:%g:%a'" in updater
    assert "openhands_factory.config_reconcile" in updater
    assert 'reconcile_agents_config_from_commits "$local_sha" "$pulled_sha"' in updater
    assert "AgentsConfig.model_validate_json" in updater


def test_updater_rejects_dotdot_escape_from_approved_config_root(tmp_path: Path) -> None:
    updater = _read("config/systemd/hellotalk-factory-update.sh")
    function = _function_range(
        updater,
        "canonical_agents_config_path() {",
        "\nagents_config_metadata_current() {",
    )
    harness = tmp_path / "canonical-path.sh"
    harness.write_text(
        "set -euo pipefail\n"
        "AGENTS_CONFIG=/etc/repo-factory/agents.json\n"
        "log() { :; }\n"
        f"{function}\n"
        "canonical_agents_config_path /etc/repo-factory/../cron.d/factory\n",
        encoding="utf-8",
    )

    result = subprocess.run(
        ["bash", str(harness)],
        check=False,
        capture_output=True,
        text=True,
    )
    assert result.returncode != 0
    assert result.stdout == ""


def test_neutral_provider_policy_is_repository_managed_and_content_checked(
    tmp_path: Path,
) -> None:
    updater = _read("config/systemd/hellotalk-factory-update.sh")
    functions = _function_range(
        updater,
        "repository_managed_agents_config() {",
        "\nrepo_runtime_root_safe() {",
    )
    repository = tmp_path / "repository"
    policy = repository / "config" / "factory" / "agents.production.json"
    policy.parent.mkdir(parents=True)
    policy.write_text('{"routing_enabled": true}\n', encoding="utf-8")
    subprocess.run(["git", "init", "-q", str(repository)], check=True)
    subprocess.run(["git", "-C", str(repository), "add", "."], check=True)
    subprocess.run(
        [
            "git",
            "-C",
            str(repository),
            "-c",
            "user.name=Factory Test",
            "-c",
            "user.email=factory@example.invalid",
            "commit",
            "-qm",
            "test policy",
        ],
        check=True,
    )
    deployed = tmp_path / "agents.json"
    deployed.write_bytes(policy.read_bytes())
    harness = tmp_path / "managed-policy.sh"
    harness.write_text(
        "set -euo pipefail\n"
        f"REPOSITORY={repository}\n"
        "AGENTS_CONFIG_SOURCE=config/factory/agents.production.json\n"
        'factory_git_read() { git -C "$REPOSITORY" "$@"; }\n'
        f"{functions}\n"
        "repository_managed_agents_config /etc/repo-factory/agents.json\n"
        "! repository_managed_agents_config /etc/hellotalk-factory/agents.json\n"
        f"agents_config_matches_commit {deployed} HEAD\n"
        f"printf 'stale\\n' >> {deployed}\n"
        f"! agents_config_matches_commit {deployed} HEAD\n",
        encoding="utf-8",
    )

    subprocess.run(["bash", str(harness)], check=True)


def test_provider_config_rollback_reloads_both_services(tmp_path: Path) -> None:
    updater = _read("config/systemd/hellotalk-factory-update.sh")
    functions = _function_range(
        updater,
        "validate_agents_config() {",
        "\ntrap finish_update EXIT",
    )

    config = tmp_path / "agents.json"
    backup = tmp_path / "agents.rollback.json"
    restarts = tmp_path / "restarts.log"
    config.write_text("new-config", encoding="utf-8")
    backup.write_text("previous-config", encoding="utf-8")
    venv_bin = tmp_path / "venv" / "bin"
    venv_bin.mkdir(parents=True)
    validator = venv_bin / "python"
    validator.write_text("#!/bin/sh\ncat >/dev/null\nexit 0\n", encoding="utf-8")
    validator.chmod(0o755)

    harness = tmp_path / "rollback.sh"
    harness.write_text(
        "set -euo pipefail\n"
        f"FACTORY_VENV={tmp_path / 'venv'}\n"
        f"AGENTS_CONFIG={config}\n"
        f"agents_config_backup={backup}\n"
        "agents_config_changed=true\n"
        "services_stopped=true\n"
        "update_completed=false\n"
        "secondary_was_active=true\n"
        "FACTORY_USER=$(id -un)\n"
        "SERVICE=primary.service\n"
        "SECONDARY_SERVICE=secondary.service\n"
        f"RESTART_LOG={restarts}\n"
        "log() { :; }\n"
        "chown() { return 0; }\n"
        "chmod() { return 0; }\n"
        "systemctl() {\n"
        '  if [ "${1:-}" = restart ]; then\n'
        '    printf \'%s:%s\\n\' "$2" "$(cat "$AGENTS_CONFIG")" >> "$RESTART_LOG"\n'
        "  fi\n"
        "  return 0\n"
        "}\n"
        f"{functions}\n"
        "restore_services_on_failure\n",
        encoding="utf-8",
    )

    subprocess.run(["bash", str(harness)], check=True)
    assert config.read_text(encoding="utf-8") == "previous-config"
    assert restarts.read_text(encoding="utf-8").splitlines() == [
        "primary.service:previous-config",
        "secondary.service:previous-config",
    ]


def test_failed_provider_config_rollback_refuses_service_restart(tmp_path: Path) -> None:
    updater = _read("config/systemd/hellotalk-factory-update.sh")
    functions = _function_range(
        updater,
        "validate_agents_config() {",
        "\ntrap finish_update EXIT",
    )
    config = tmp_path / "agents.json"
    config.write_text("new-config", encoding="utf-8")
    restarts = tmp_path / "restarts.log"

    harness = tmp_path / "failed-rollback.sh"
    harness.write_text(
        "set -u\n"
        f"FACTORY_VENV={tmp_path / 'missing-venv'}\n"
        f"AGENTS_CONFIG={config}\n"
        f"agents_config_backup={tmp_path / 'missing-backup'}\n"
        "agents_config_changed=true\n"
        "services_stopped=true\n"
        "update_completed=false\n"
        "secondary_was_active=true\n"
        "FACTORY_USER=$(id -un)\n"
        "SERVICE=primary.service\n"
        "SECONDARY_SERVICE=secondary.service\n"
        f"RESTART_LOG={restarts}\n"
        "log() { :; }\n"
        "systemctl() {\n"
        '  if [ "${1:-}" = restart ]; then echo "$2" >> "$RESTART_LOG"; fi\n'
        "  return 0\n"
        "}\n"
        f"{functions}\n"
        "restore_services_on_failure\n",
        encoding="utf-8",
    )

    result = subprocess.run(["bash", str(harness)], check=False)
    assert result.returncode != 0
    assert not restarts.exists()
    assert config.read_text(encoding="utf-8") == "new-config"


def test_neutral_repo_factory_updater_has_autonomous_bootstrap_path() -> None:
    updater = _read("config/systemd/hellotalk-factory-update.sh")
    maintenance = _read("scripts/maintain-factory-host-storage.sh")
    unit = _read("config/systemd/repo-factory-update.service")

    assert "/bin/bash /opt/repo-factory/repo-factory-update.sh" in unit
    assert '"$REPO_RUNTIME_ROOT/repo-factory-update.sh" 0755' in updater
    assert "FACTORY_PROVIDER_CONFIG_RECONCILIATION_V1" in updater
    assert "bootstrap_repo_factory_updater" in maintenance
    assert "FACTORY_PROVIDER_CONFIG_RECONCILIATION_V1" in maintenance
    assert 'install -o root -g root -m 0755 "$legacy" "$neutral"' in maintenance
    assert "refs/remotes/origin/main" in maintenance
    assert 'cat-file commit "$head"' in maintenance
    assert 'cat-file blob "$updater_blob"' in maintenance
    assert "git hash-object -t commit --stdin" in maintenance
    assert 'actual_blob=$(git hash-object "$temporary")' in maintenance
