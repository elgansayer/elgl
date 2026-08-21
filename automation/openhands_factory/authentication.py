"""Interactive subscription authentication, never called by the daemon."""

from __future__ import annotations

import os
from pathlib import Path

from openhands_factory.config import FactoryConfig


def secure_openai_credentials(home: Path) -> None:
    credentials_dir = home / ".openhands" / "auth"
    if not credentials_dir.is_dir():
        return
    os.chmod(credentials_dir, 0o700)
    for credential in credentials_dir.glob("*_oauth.json"):
        os.chmod(credential, 0o600)


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
        auth_method="device_code",
    )
    secure_openai_credentials(Path.home())
