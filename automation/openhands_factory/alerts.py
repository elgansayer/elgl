"""Credential-safe operator alerts."""

from __future__ import annotations

import httpx

from openhands_factory.config import FactoryConfig
from openhands_factory.redaction import redact_text


class AlertService:
    def __init__(self, config: FactoryConfig) -> None:
        self.config = config

    def send(self, message: str) -> bool:
        if self.config.telegram_bot_token is None or self.config.telegram_chat_id is None:
            return False
        response = httpx.post(
            "https://api.telegram.org/bot"
            f"{self.config.telegram_bot_token.get_secret_value()}/sendMessage",
            json={
                "chat_id": self.config.telegram_chat_id.get_secret_value(),
                "text": redact_text(message)[:4000],
                "disable_web_page_preview": True,
            },
            timeout=20,
        )
        return response.is_success
