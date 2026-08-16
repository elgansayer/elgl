from pathlib import Path

import pytest

from openhands_factory.architecture_guard import (
    EXPECTED_FACTORY_ARCHITECTURE,
    assert_single_owner,
    check_direct_provider_router,
    check_factory_architecture,
    check_retired_swarm,
)


def test_expected_agent_canvas_architecture_passes() -> None:
    check = check_factory_architecture(EXPECTED_FACTORY_ARCHITECTURE)
    assert check.passed


def test_old_architecture_is_rejected() -> None:
    check = check_factory_architecture("legacy-swarm")
    assert not check.passed
    assert EXPECTED_FACTORY_ARCHITECTURE in check.detail


def test_clean_checkout_has_single_owner(tmp_path: Path) -> None:
    assert check_retired_swarm(tmp_path).passed
    assert check_direct_provider_router(tmp_path).passed
    assert_single_owner(tmp_path)


def test_retired_workflow_blocks_daemon_ownership(tmp_path: Path) -> None:
    retired = tmp_path / ".github/workflows/auto-dispatcher.yml"
    retired.parent.mkdir(parents=True)
    retired.write_text("name: retired\n", encoding="utf-8")

    check = check_retired_swarm(tmp_path)
    assert not check.passed
    assert "auto-dispatcher.yml" in check.detail
    with pytest.raises(RuntimeError, match="single-owner invariant"):
        assert_single_owner(tmp_path)


def test_direct_provider_router_blocks_daemon_ownership(tmp_path: Path) -> None:
    router = tmp_path / "automation/openhands_factory/agents/router.py"
    router.parent.mkdir(parents=True)
    router.write_text("# alternate execution plane\n", encoding="utf-8")

    check = check_direct_provider_router(tmp_path)
    assert not check.passed
    assert "agents/router.py" in check.detail
    with pytest.raises(RuntimeError, match="single-owner invariant"):
        assert_single_owner(tmp_path)


def test_direct_provider_adapter_blocks_daemon_ownership(tmp_path: Path) -> None:
    adapter = tmp_path / "automation/openhands_factory/agents/codex.py"
    adapter.parent.mkdir(parents=True)
    adapter.write_text("# direct provider adapter\n", encoding="utf-8")

    check = check_direct_provider_router(tmp_path)
    assert not check.passed
    assert "agents/codex.py" in check.detail
