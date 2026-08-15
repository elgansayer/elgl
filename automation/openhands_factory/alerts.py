"""Credential-safe operator alerts."""

from __future__ import annotations

import logging
from datetime import UTC, datetime

import httpx

from openhands_factory.config import FactoryConfig
from openhands_factory.redaction import redact_text
from openhands_factory.state import atomic_write_json, read_json

LOGGER = logging.getLogger(__name__)

DEFAULT_COOLDOWN_SECONDS = 1800


class AlertService:
    def __init__(
        self, config: FactoryConfig, cooldown_seconds: int = DEFAULT_COOLDOWN_SECONDS
    ) -> None:
        self.config = config
        self.cooldown_seconds = cooldown_seconds
        self.state_path = config.state_dir / "alert_cooldowns.json"

    def send(self, message: str, *, category: str | None = None) -> bool:
        if self.config.telegram_bot_token is None or self.config.telegram_chat_id is None:
            return False

        # Alerts are keyed by category so a burst of the same failure (e.g. many
        # issues quarantined in quick succession) collapses into one message with a
        # suppressed count, instead of flooding Telegram with one message each.
        resolved_category = category or message.split(":", 1)[0].strip()
        now = datetime.now(UTC)
        state = read_json(self.state_path, {})
        entry = state.get(resolved_category)

        if entry is not None:
            last_sent = datetime.fromisoformat(entry["last_sent"])
            if (now - last_sent).total_seconds() < self.cooldown_seconds:
                entry["suppressed"] = entry.get("suppressed", 0) + 1
                state[resolved_category] = entry
                atomic_write_json(self.state_path, state)
                return False

        suppressed = entry.get("suppressed", 0) if entry is not None else 0
        text = message
        if suppressed:
            minutes = max(1, self.cooldown_seconds // 60)
            text = (
                f"{message}\n\n({suppressed} similar alert"
                f"{'s' if suppressed != 1 else ''} suppressed in the last {minutes} minutes)"
            )

        try:
            response = httpx.post(
                "https://api.telegram.org/bot"
                f"{self.config.telegram_bot_token.get_secret_value()}/sendMessage",
                json={
                    "chat_id": self.config.telegram_chat_id.get_secret_value(),
                    "text": redact_text(text)[:4000],
                    "disable_web_page_preview": True,
                },
                timeout=20,
            )
            sent = response.is_success
        except Exception as error:
            LOGGER.warning("Telegram alert delivery failed: %s", error)
            sent = False

        if sent:
            state[resolved_category] = {"last_sent": now.isoformat(), "suppressed": 0}
            atomic_write_json(self.state_path, state)
        return sent
