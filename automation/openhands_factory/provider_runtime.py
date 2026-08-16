"""Provider attribution helpers for the active OpenHands Factory."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from filelock import FileLock

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.models import FailureKind, ProviderName
from openhands_factory.state import atomic_write_json, read_json


def provider_model(config: FactoryConfig, provider: ProviderName) -> str:
    if provider is ProviderName.OPENAI_SUBSCRIPTION:
        return config.openai_model
    if provider is ProviderName.OPENCODE_GO:
        return f"openai/{config.opencode_model}"
    raise ConfigurationError(
        f"Provider {provider.value!r} is historical-only; production routing is "
        "Codex subscription OAuth -> OpenCode Go"
    )


def conversation_role(prompt: str) -> str:
    prefixes = {
        "# Task Execution": "implementation",
        "# Independent Pull Request Review": "review",
        "# Security": "security-review",
        "# Quality": "quality-repair",
        "# Repair": "ci-repair",
        "# Architect": "architect",
    }
    stripped = prompt.lstrip()
    for prefix, role in prefixes.items():
        if stripped.startswith(prefix):
            return role
    return "factory-phase"


class ProviderAttributionStore:
    """Durably record non-secret provider attribution for every conversation attempt."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self.lock = FileLock(str(path) + ".lock")

    def _attempts(self) -> list[dict[str, object]]:
        payload = read_json(self.path, {"attempts": []})
        attempts = payload.get("attempts", []) if isinstance(payload, dict) else []
        return [item for item in attempts if isinstance(item, dict)]

    def latest_provider(self, task_id: str, *, role: str | None = None) -> ProviderName | None:
        with self.lock:
            for item in reversed(self._attempts()):
                if item.get("task_id") != task_id:
                    continue
                if role is not None and item.get("role") != role:
                    continue
                provider = item.get("provider")
                if isinstance(provider, str):
                    try:
                        parsed = ProviderName(provider)
                    except ValueError:
                        continue
                    if parsed in {ProviderName.OPENAI_SUBSCRIPTION, ProviderName.OPENCODE_GO}:
                        return parsed
        return None

    def task_summary(self, task_id: str) -> list[dict[str, object]]:
        with self.lock:
            return [item.copy() for item in self._attempts() if item.get("task_id") == task_id]

    def record(
        self,
        *,
        task_id: str,
        role: str,
        provider: ProviderName,
        model: str,
        generation: str,
        successful: bool,
        fallback: bool,
        fallback_reason: str | None,
        elapsed_seconds: float,
        capacity_wait_seconds: float = 0,
        failure_kind: FailureKind | None = None,
    ) -> None:
        with self.lock:
            attempts = self._attempts()
            attempts.append(
                {
                    "task_id": task_id,
                    "role": role,
                    "provider": provider.value,
                    "model": model,
                    "factory_generation": generation,
                    "successful": successful,
                    "fallback": fallback,
                    "fallback_reason": fallback_reason,
                    "elapsed_seconds": round(elapsed_seconds, 3),
                    "capacity_wait_seconds": round(capacity_wait_seconds, 3),
                    "failure_kind": failure_kind.value if failure_kind else None,
                    "recorded_at": datetime.now(UTC).isoformat(),
                }
            )
            atomic_write_json(self.path, {"attempts": attempts[-5000:]})
