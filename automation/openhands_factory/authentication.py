"""Interactive subscription authentication, never called by the daemon."""

from __future__ import annotations

import os
from pathlib import Path

from openhands_factory.config import FactoryConfig


def authenticate_openai(config: FactoryConfig, *, force: bool = False) -> None:
    from openhands.sdk import LLM

    cache_dir = Path.home() / ".openhands"
    cache_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(cache_dir, 0o700)
    LLM.subscription_login(
        vendor="openai",
        model=config.openai_model,
        force_login=force,
        open_browser=False,
    )
    auth_path = cache_dir / "auth"
    if auth_path.exists():
        os.chmod(auth_path, 0o600)
