"""Credential-safe operator alerts."""

from __future__ import annotations

import logging
import re
from datetime import UTC, datetime

import httpx

from openhands_factory.config import FactoryConfig
from openhands_factory.generation import FACTORY_RUNTIME_VERSION
from openhands_factory.redaction import redact_text
from openhands_factory.state import atomic_write_json, read_json

LOGGER = logging.getLogger(__name__)

DEFAULT_COOLDOWN_SECONDS = 1800
MAX_ALERT_ISSUES = 8
MAX_TELEGRAM_TEXT = 4000


def _alert_category(message: str) -> str:
    """Derive a stable cooldown key without collapsing all factory alerts together."""
    parts = [part.strip() for part in message.split(":", 2)]
    if len(parts) >= 2 and parts[0] == "OpenHands factory alert":
        return f"{parts[0]}:{parts[1]}"
    return parts[0]


def _compact_issue_list(message: str) -> str:
    """Keep large health alerts actionable and safely inside Telegram's message limit."""
    match = re.search(r"issues=([0-9,]+)", message)
    if match is None:
        return message
    identifiers = [identifier for identifier in match.group(1).split(",") if identifier]
    if len(identifiers) <= MAX_ALERT_ISSUES:
        return message
    shown = ",".join(identifiers[:MAX_ALERT_ISSUES])
    remaining = len(identifiers) - MAX_ALERT_ISSUES
    replacement = f"issues={shown},... (+{remaining} more; total={len(identifiers)})"
    return f"{message[: match.start()]}{replacement}{message[match.end() :]}"


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

        resolved_category = category or _alert_category(message)
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
        text = _compact_issue_list(message)
        generation = self.config.factory_generation
        text = (
            f"{text}\n\nFactory generation: {generation}\n"
            f"Factory runtime: {FACTORY_RUNTIME_VERSION}"
        )
        if suppressed:
            minutes = max(1, self.cooldown_seconds // 60)
            text = (
                f"{text}\n\n({suppressed} similar alert"
                f"{'s' if suppressed != 1 else ''} suppressed in the last {minutes} minutes)"
            )

        text = redact_text(text)
        if len(text) > MAX_TELEGRAM_TEXT:
            suffix = "\n...[alert truncated]"
            text = f"{text[: MAX_TELEGRAM_TEXT - len(suffix)]}{suffix}"

        try:
            response = httpx.post(
                "https://api.telegram.org/bot"
                f"{self.config.telegram_bot_token.get_secret_value()}/sendMessage",
                json={
                    "chat_id": self.config.telegram_chat_id.get_secret_value(),
                    "text": text,
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
