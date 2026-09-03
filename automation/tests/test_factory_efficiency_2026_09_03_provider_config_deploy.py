from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[2]


def _read(path: str) -> str:
    return (REPOSITORY_ROOT / path).read_text(encoding="utf-8")


def test_updater_reconciles_provider_config_from_verified_commit() -> None:
    updater = _read("config/systemd/hellotalk-factory-update.sh")

    assert (
        "AGENTS_CONFIG=${FACTORY_AGENTS_CONFIG:-/etc/hellotalk-factory/agents.json}"
        in updater
    )
    assert "AGENTS_CONFIG_SOURCE=config/factory/agents.production.json" in updater
    assert "/etc/repo-factory/*|/etc/hellotalk-factory/*" in updater
    assert (
        'file_matches_commit "$remote_sha" "$AGENTS_CONFIG_SOURCE" "$AGENTS_CONFIG"'
        in updater
    )
    assert 'install_agents_config_from_commit "$pulled_sha"' in updater
    assert "AgentsConfig.model_validate_json" in updater


def test_provider_config_reconciliation_rolls_back_on_failed_update() -> None:
    updater = _read("config/systemd/hellotalk-factory-update.sh")

    assert "restore_agents_config_on_failure" in updater
    assert "agents_config_backup=__absent__" in updater
    assert 'mv -fT -- "$agents_config_backup" "$AGENTS_CONFIG"' in updater
    assert "update_completed=true" in updater
