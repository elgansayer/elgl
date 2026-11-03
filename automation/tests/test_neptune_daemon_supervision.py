"""Neptune entrypoint/generation wiring; private stores and no provider calls."""

import os
from pathlib import Path

import pytest

from openhands_factory.canary import SingleIssueCanary
from openhands_factory.config import FactoryConfig
from openhands_factory.daemon import FactoryDaemon
from openhands_factory.exceptions import ConfigurationError, ProviderCapacityUnavailable
from openhands_factory.gated_daemon import MainCiGatedFactoryDaemon
from openhands_factory.provider_capacity import ProviderCapacityStore
from openhands_factory.session_identity import SessionCheckpoint, ProcessIdentity


@pytest.mark.parametrize("entrypoint", ["daemon", "gated", "canary", "flagged-canary"])
def test_neptune_entrypoints_share_the_existing_store_and_private_journal(
    neptune_config: FactoryConfig, entrypoint: str
) -> None:
    if entrypoint == "daemon":
        daemon = FactoryDaemon(neptune_config)
    elif entrypoint == "gated":
        daemon = MainCiGatedFactoryDaemon(neptune_config)
    else:
        daemon = SingleIssueCanary(
            neptune_config, 536, supervised_session=entrypoint == "flagged-canary"
        )
    supervisor = daemon.pipeline.router.session_supervisor
    assert supervisor is not None
    assert supervisor.store is daemon.pipeline.router.capacity_store
    assert supervisor.store.factory_generation is None
    assert supervisor.lease_seconds == 30 and supervisor.guard_timeout_seconds == 5
    assert supervisor.journal.directory == neptune_config.state_dir / "manual-session-identities"
    assert supervisor.journal.directory.stat().st_mode & 0o077 == 0
    assert not supervisor.store.path.exists()  # Construction never dispatches/reserves.
    assert daemon.generation is None


@pytest.mark.parametrize("entrypoint", [FactoryDaemon, MainCiGatedFactoryDaemon])
def test_generation_rebuild_keeps_journal_foreign_lease_and_host_gates(
    neptune_config: FactoryConfig, entrypoint: type[FactoryDaemon]
) -> None:
    daemon = entrypoint(neptune_config)
    supervisor = daemon.pipeline.router.session_supervisor
    assert supervisor is not None
    journal, store = supervisor.journal, supervisor.store
    foreign = store.acquire_renewable("codex", owner="foreign-fixture", limit=1)
    journal.create(SessionCheckpoint("9812-fixture", ProcessIdentity.capture(os.getpid()), foreign))
    record_bytes = (journal.directory / "9812-fixture.json").read_bytes()
    before = store.path.read_bytes()
    host_gate, verification_gate = daemon.host_resource_slots, daemon.verification_slots
    try:
        for _ in range(2):
            daemon._activate_generation()
            current = daemon.pipeline.router.session_supervisor
            assert current is not None and current is not supervisor
            assert current.journal is journal
            assert current.store is daemon.pipeline.router.capacity_store
            assert current.store.path == store.path and current.store.factory_generation is None
            assert store.path.read_bytes() == before
            assert (journal.directory / "9812-fixture.json").read_bytes() == record_bytes
            reader = ProviderCapacityStore(
                store.path.parent, max_lease_seconds=store.max_lease_seconds
            )
            assert reader.snapshot() == {"codex": 1}
            with pytest.raises(ProviderCapacityUnavailable):
                current.acquire("codex", "must-not-start", limit=1, wait_seconds=0)
            assert daemon.pipeline.host_resource_slots is host_gate
            assert daemon.pipeline.router.host_resource_slots is host_gate
            assert daemon.pipeline.verification_slots is verification_gate
    finally:
        store.release_renewable(foreign)


@pytest.mark.parametrize("profile", ["hellotalk", "workout-agent"])
def test_other_repository_defaults_do_not_add_supervision(
    neptune_config: FactoryConfig, profile: str
) -> None:
    config = neptune_config.model_copy(update={"repository_profile": profile})
    daemon = FactoryDaemon(config)
    assert daemon.pipeline.router.session_supervisor is None
    assert not (config.state_dir / "manual-session-identities").exists()
    daemon._activate_generation()
    assert daemon.pipeline.router.session_supervisor is None
    assert not (config.state_dir / "manual-session-identities").exists()


def test_enabled_unsupported_transport_fails_before_generation_or_dispatch(
    neptune_config: FactoryConfig,
) -> None:
    providers = dict(neptune_config.agents.providers)
    providers["openhands"] = providers["openhands"].model_copy(update={"enabled": True})
    config = neptune_config.model_copy(
        update={"agents": neptune_config.agents.model_copy(update={"providers": providers})}
    )
    with pytest.raises(ConfigurationError, match="supported direct CLI providers: openhands"):
        FactoryDaemon(config)
    assert not (config.state_dir / "generation.json").exists()
    assert not (config.provider_capacity_dir / "provider-capacity.json").exists()


def test_unsafe_journal_fails_before_generation_or_dispatch(
    neptune_config: FactoryConfig, tmp_path: Path
) -> None:
    neptune_config.state_dir.mkdir(parents=True)
    target = tmp_path / "outside"
    target.mkdir()
    (neptune_config.state_dir / "manual-session-identities").symlink_to(
        target, target_is_directory=True
    )
    with pytest.raises((OSError, ValueError)):
        FactoryDaemon(neptune_config)
    assert not list(target.iterdir())
    assert not (neptune_config.state_dir / "generation.json").exists()
