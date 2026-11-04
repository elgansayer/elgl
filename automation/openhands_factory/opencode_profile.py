"""Prepare a repository-scoped OpenCode trial without credentials or live dispatch."""

from __future__ import annotations

import hashlib
import json
import os
import re
import stat
import tempfile
from pathlib import Path
from typing import Any

from pydantic import ValidationError

from openhands_factory.agents.opencode import OpenCodeProvider, catalogue_models
from openhands_factory.config import AgentsConfig
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.neptune_merge import NEPTUNE_REPOSITORY

MAX_INPUT_BYTES = 256 * 1024
TRIAL_PHASES = ("implementation", "quality_repair", "general_action")


def research_profile(source: AgentsConfig, model: str, catalogue: str) -> AgentsConfig:
    """Retain native providers and shared limits while selecting one trial model."""
    if not re.fullmatch(r"opencode-go/[A-Za-z0-9][A-Za-z0-9._-]*", model):
        raise ConfigurationError("Select an explicit opencode-go model identifier")
    if model not in catalogue_models(catalogue):
        raise ConfigurationError("Selected model is absent from the supplied OpenCode catalogue")
    if not source.routing_enabled:
        raise ConfigurationError("OpenCode trials require the existing direct-provider router")
    if (
        source.repository_scope
        and source.repository_scope.casefold() != NEPTUNE_REPOSITORY.casefold()
    ):
        raise ConfigurationError("Source agent configuration belongs to a different repository")
    if any(p.enabled and p.auth_mode != "subscription" for p in source.providers.values()):
        raise ConfigurationError(
            "Disable API-backed providers before preparing this subscription trial"
        )
    if source.providers["opencode"].extra_args:
        raise ConfigurationError("Remove custom OpenCode argument overrides before this trial")

    result = source.model_copy(deep=True)
    result.repository_scope = NEPTUNE_REPOSITORY
    provider = result.providers["opencode"]
    provider.enabled = True
    provider.emergency_only = False
    provider.command = provider.command or OpenCodeProvider.default_command
    provider.auth_mode = "subscription"
    provider.transport = "cli"
    provider.model = model
    provider.phase_models = {}
    provider.max_concurrency = 1
    provider.timeout_seconds = min(provider.timeout_seconds or 600, 600)
    provider.max_output_bytes = min(provider.max_output_bytes, 512_000)
    provider.credential_paths = provider.credential_paths or list(
        OpenCodeProvider.default_credential_paths
    )
    provider.runtime_paths = provider.runtime_paths or list(OpenCodeProvider.default_runtime_paths)

    for phase, names in result.routing.model_dump().items():
        if not isinstance(names, list):
            continue
        candidates = [name for name in names if name != "opencode"]
        if phase in TRIAL_PHASES:
            candidates.insert(0, "opencode")
        setattr(result.routing, phase, candidates)
    try:
        return AgentsConfig.model_validate(result.model_dump())
    except ValidationError as error:
        raise ConfigurationError(
            "Trial routes need an enabled native provider for other phases"
        ) from error


def _read_bounded(path: Path) -> bytes:
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, "rb") as stream:
        info = os.fstat(stream.fileno())
        if not stat.S_ISREG(info.st_mode) or info.st_size > MAX_INPUT_BYTES:
            raise ConfigurationError("Profile input must be a bounded regular file")
        raw = stream.read(MAX_INPUT_BYTES + 1)
    if len(raw) > MAX_INPUT_BYTES:
        raise ConfigurationError("Profile input exceeds its size limit")
    return raw


def prepare_profile(source: Path, catalogue: Path, output: Path, model: str) -> dict[str, Any]:
    """Publish a private new file atomically, refusing replacement of any old path."""
    try:
        source_raw, catalogue_raw = _read_bounded(source), _read_bounded(catalogue)
    except OSError as error:
        raise ConfigurationError("Cannot read the regular source and catalogue files") from error
    try:
        agents = AgentsConfig.model_validate_json(source_raw)
        model_catalogue = catalogue_raw.decode("utf-8")
    except (ValidationError, UnicodeError, ValueError) as error:
        # Validation errors can echo input values. Never print a supplied credential.
        raise ConfigurationError(
            "Invalid source agent configuration or catalogue encoding"
        ) from error
    profile = research_profile(agents, model, model_catalogue)
    encoded = (json.dumps(profile.model_dump(), indent=2) + "\n").encode()
    temporary: Path | None = None
    try:
        with tempfile.NamedTemporaryFile(
            dir=output.parent, prefix=".opencode-trial-", delete=False
        ) as f:
            temporary = Path(f.name)
            f.write(encoded)
            f.flush()
            os.fsync(f.fileno())
        # link() publishes atomically without replacing an operator file or symlink.
        os.link(temporary, output)
    except OSError as error:
        raise ConfigurationError(
            "Cannot publish profile; its output must be a new writable path"
        ) from error
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {
        "schema": "factory.opencode-profile-preparation.v1",
        "scope": "configuration prepared only; no authentication, dispatch or activation",
        "repository_scope": profile.repository_scope,
        "model": model,
        "trial_phases": list(TRIAL_PHASES),
        "source_sha256": hashlib.sha256(source_raw).hexdigest(),
        "catalogue_sha256": hashlib.sha256(catalogue_raw).hexdigest(),
        "output_sha256": hashlib.sha256(encoded).hexdigest(),
        "output": str(output),
    }
