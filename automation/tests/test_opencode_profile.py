"""Offline profile preparation and isolation contracts; no live provider calls."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from unittest.mock import patch

import pytest

from openhands_factory import cli
from openhands_factory.config import AgentsConfig, FactoryConfig
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.neptune_merge import NEPTUNE_REPOSITORY
from openhands_factory.opencode_profile import MAX_INPUT_BYTES, prepare_profile, research_profile

MODEL = "opencode-go/minimax-m3"
CATALOGUE = f"{MODEL}\nopencode-go/deepseek-v4-flash\n"


@pytest.fixture
def source_path() -> Path:
    return Path(__file__).parents[2] / "config/factory/agents.production.json"


@pytest.fixture
def source(source_path: Path) -> AgentsConfig:
    return AgentsConfig.model_validate_json(source_path.read_bytes())


def test_profile_preserves_native_providers_and_constrains_the_trial(source: AgentsConfig) -> None:
    before = source.model_dump()
    profile = research_profile(source, MODEL, CATALOGUE)
    assert source.model_dump() == before
    assert profile.repository_scope == NEPTUNE_REPOSITORY
    for name in ("claude", "codex", "google", "pi", "openhands"):
        assert profile.providers[name] == source.providers[name]
    worker = profile.providers["opencode"]
    assert worker.enabled and worker.model == MODEL
    assert worker.phase_models == {}
    assert worker.max_concurrency == 1 and worker.timeout_seconds == 600
    assert worker.max_output_bytes <= source.providers["opencode"].max_output_bytes
    assert profile.routing.implementation == ["opencode", *source.routing.implementation]
    assert profile.routing.quality_repair == ["opencode", *source.routing.quality_repair]
    assert profile.routing.general_action == ["opencode", *source.routing.general_action]
    assert profile.routing.planning == source.routing.planning
    assert profile.routing.code_review == source.routing.code_review
    assert profile.timeouts == source.timeouts
    assert profile.circuit_breaker == source.circuit_breaker


def test_existing_stricter_limits_and_native_review_are_retained(source: AgentsConfig) -> None:
    worker = source.providers["opencode"]
    worker.timeout_seconds = 30
    worker.max_output_bytes = 1000
    worker.phase_models = {"planning": "opencode-go/kimi-k3"}
    source.routing.planning.insert(0, "opencode")
    source.routing.code_review.insert(0, "opencode")
    profile = research_profile(source, MODEL, CATALOGUE)
    assert profile.providers["opencode"].timeout_seconds == 30
    assert profile.providers["opencode"].max_output_bytes == 1000
    assert "opencode" not in profile.routing.planning
    assert "opencode" not in profile.routing.code_review
    assert profile.providers["opencode"].phase_models == {}


@pytest.mark.parametrize("model", ["minimax-m3", "other/minimax-m3", "opencode-go/x\n--auto"])
def test_explicit_provider_model_is_required(source: AgentsConfig, model: str) -> None:
    with pytest.raises(ConfigurationError, match="explicit opencode-go"):
        research_profile(source, model, CATALOGUE)


@pytest.mark.parametrize("catalogue", ["", MODEL + "-preview", "warning: " + MODEL])
def test_missing_or_similarly_named_model_is_not_substituted(
    source: AgentsConfig, catalogue: str
) -> None:
    with pytest.raises(ConfigurationError, match="absent"):
        research_profile(source, MODEL, catalogue)


def test_api_fallback_and_foreign_scope_are_refused(source: AgentsConfig) -> None:
    source.providers["openhands"].enabled = True
    with pytest.raises(ConfigurationError, match="API-backed"):
        research_profile(source, MODEL, CATALOGUE)
    source.providers["openhands"].enabled = False
    source.repository_scope = "elgansayer/workout-agent"
    with pytest.raises(ConfigurationError, match="different repository"):
        research_profile(source, MODEL, CATALOGUE)


def test_trial_cannot_replace_native_providers_for_all_phases() -> None:
    source = AgentsConfig(providers={"opencode": {"enabled": True}})
    with pytest.raises(ConfigurationError, match="native provider"):
        research_profile(source, MODEL, CATALOGUE)


def test_custom_arguments_cannot_override_the_selected_model(source: AgentsConfig) -> None:
    source.providers["opencode"].extra_args = ["--model", "opencode-go/kimi-k3"]
    with pytest.raises(ConfigurationError, match="argument overrides"):
        research_profile(source, MODEL, CATALOGUE)


def test_generated_profile_loads_only_for_neptune(
    source: AgentsConfig, neptune_environment: dict[str, str]
) -> None:
    profile = research_profile(source, MODEL, CATALOGUE)
    target = Path(neptune_environment["FACTORY_AGENTS_CONFIG"])
    target.write_text(profile.model_dump_json())
    config = FactoryConfig.from_environment(neptune_environment)
    assert config.agents.providers["opencode"].model == MODEL
    assert config.max_parallel_jobs == 1
    assert config.provider_capacity_dir != config.state_dir
    assert config.monthly_variable_budget_usd == 0
    for repository in ("elgansayer/elgl", "elgansayer/workout-agent"):
        with pytest.raises(ValueError, match="different repository"):
            FactoryConfig(agents=profile, github_repository=repository, github_token="test")


def test_preparation_is_private_atomic_and_does_not_dispatch(
    source_path: Path, tmp_path: Path
) -> None:
    catalogue = tmp_path / "catalogue.txt"
    catalogue.write_text(CATALOGUE)
    target = tmp_path / "trial.json"
    original = source_path.read_bytes()
    with patch("subprocess.run", side_effect=AssertionError("must not launch a process")):
        report = prepare_profile(source_path, catalogue, target, MODEL)
    assert target.stat().st_mode & 0o777 == 0o600
    assert source_path.read_bytes() == original
    assert report["source_sha256"] == hashlib.sha256(original).hexdigest()
    assert report["output_sha256"] == hashlib.sha256(target.read_bytes()).hexdigest()
    assert (
        AgentsConfig.model_validate_json(target.read_bytes()).repository_scope == NEPTUNE_REPOSITORY
    )
    assert "no authentication, dispatch or activation" in report["scope"]
    with pytest.raises(ConfigurationError, match="new writable path"):
        prepare_profile(source_path, catalogue, target, MODEL)
    assert not list(tmp_path.glob(".opencode-trial-*"))


def test_symlink_output_and_source_are_not_followed(source_path: Path, tmp_path: Path) -> None:
    catalogue = tmp_path / "catalogue.txt"
    catalogue.write_text(CATALOGUE)
    existing = tmp_path / "existing"
    existing.write_text("preserve operator content")
    link = tmp_path / "link"
    link.symlink_to(existing)
    with pytest.raises(ConfigurationError):
        prepare_profile(source_path, catalogue, link, MODEL)
    assert existing.read_text() == "preserve operator content"
    with pytest.raises(ConfigurationError, match="Cannot read"):
        prepare_profile(link, catalogue, tmp_path / "new.json", MODEL)


def test_oversized_input_is_rejected(source_path: Path, tmp_path: Path) -> None:
    catalogue = tmp_path / "catalogue.txt"
    catalogue.write_bytes(b"x" * (MAX_INPUT_BYTES + 1))
    with pytest.raises(ConfigurationError, match="bounded regular file"):
        prepare_profile(source_path, catalogue, tmp_path / "trial.json", MODEL)


def test_cli_prepares_without_daemon_credentials(
    source_path: Path, tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    catalogue = tmp_path / "catalogue.txt"
    catalogue.write_text(CATALOGUE)
    with patch("openhands_factory.cli._config", side_effect=AssertionError("no daemon config")):
        result = cli.main(
            [
                "opencode-profile",
                "--source",
                str(source_path),
                "--catalogue",
                str(catalogue),
                "--output",
                str(tmp_path / "trial.json"),
                "--model",
                MODEL,
            ]
        )
    assert result == 0
    assert json.loads(capsys.readouterr().out)["model"] == MODEL


def test_cli_validation_error_does_not_echo_supplied_secrets(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = tmp_path / "source.json"
    source.write_text(json.dumps({"api_key": "private-test-secret"}))
    catalogue = tmp_path / "catalogue.txt"
    catalogue.write_text(CATALOGUE)
    result = cli.main(
        [
            "opencode-profile",
            "--source",
            str(source),
            "--catalogue",
            str(catalogue),
            "--output",
            str(tmp_path / "trial.json"),
            "--model",
            MODEL,
        ]
    )
    output = capsys.readouterr()
    assert result == 2
    assert "Invalid source" in output.err
    assert "private-test-secret" not in output.err + output.out
