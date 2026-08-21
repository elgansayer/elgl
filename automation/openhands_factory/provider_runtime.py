"""Inner-provider attribution helpers for the OpenHands adapter."""

from __future__ import annotations

from datetime import UTC, datetime
from pathlib import Path

from filelock import FileLock

from openhands_factory.config import FactoryConfig
from openhands_factory.exceptions import ConfigurationError
from openhands_factory.models import FailureKind, ProviderName
from openhands_factory.state import atomic_write_json, read_json


def _is_attribution_payload(value: object) -> bool:
    return isinstance(value, dict) and isinstance(value.get("attempts"), list)


def provider_model(config: FactoryConfig, provider: ProviderName, role: str | None = None) -> str:
    if provider is ProviderName.OPENAI_SUBSCRIPTION:
        if role in ("architect", "review") and config.planning_model is not None:
            return config.planning_model
        if role == "implementation" and config.terminal_execution_model is not None:
            return config.terminal_execution_model
        if role == "ci-repair" and config.bulk_ci_repair_model is not None:
            return config.bulk_ci_repair_model
        return config.openai_model
    if provider is ProviderName.OPENCODE_GO:
        if config.opencode_model is None:
            raise ConfigurationError("OpenCode Go API fallback is not configured")
        return f"openai/{config.opencode_model}"
    if provider is ProviderName.GEMINI:
        if role == "triage":
            return "gemini-3.6-flash"
        return config.gemini_model
    raise ConfigurationError(
        f"Provider {provider.value!r} is historical-only inside OpenHands; "
        "the compatibility chain is OpenAI subscription OAuth then OpenCode Go"
    )


def conversation_role(prompt: str) -> str:
    """Derive the trusted Factory phase from its repository-owned prompt prefix."""
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
        payload = read_json(
            self.path,
            {"attempts": []},
            validator=_is_attribution_payload,
        )
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
        """Return sanitized attribution suitable for PR metadata or diagnostics."""
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
            atomic_write_json(
                self.path,
                {"attempts": attempts[-5000:]},
                validator=_is_attribution_payload,
            )
