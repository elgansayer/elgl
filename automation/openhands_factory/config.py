"""Strict environment configuration without secret logging."""

from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path

from pydantic import BaseModel, Field, SecretStr, field_validator, model_validator

from openhands_factory.architecture_guard import EXPECTED_FACTORY_ARCHITECTURE
from openhands_factory.exceptions import ConfigurationError


class ProviderConfig(BaseModel):
    enabled: bool = False
    command: str | None = None
    auth_mode: str | None = None
    emergency_only: bool = False
    max_concurrency: int = 2


class AgentsRoutingConfig(BaseModel):
    planning: list[str] = Field(
        default_factory=lambda: ["claude", "codex", "google", "opencode", "openhands"]
    )
    architecture: list[str] = Field(
        default_factory=lambda: ["claude", "codex", "google", "opencode", "openhands"]
    )
    implementation: list[str] = Field(
        default_factory=lambda: ["claude", "codex", "google", "opencode", "openhands"]
    )
    security_review: list[str] = Field(
        default_factory=lambda: ["claude", "codex", "google", "opencode", "openhands"]
    )
    quality_repair: list[str] = Field(
        default_factory=lambda: ["codex", "claude", "google", "opencode", "openhands"]
    )
    code_review: list[str] = Field(
        default_factory=lambda: ["codex", "claude", "google", "opencode", "openhands"]
    )
    ci_repair: list[str] = Field(
        default_factory=lambda: ["codex", "claude", "google", "opencode", "openhands"]
    )
    general_action: list[str] = Field(
        default_factory=lambda: ["opencode", "google", "codex", "claude", "openhands"]
    )
    skip_busy_providers: bool = True


class AgentsConfig(BaseModel):
    routing_enabled: bool = True
    providers: dict[str, ProviderConfig] = Field(
        default_factory=lambda: {
            "claude": ProviderConfig(enabled=True, auth_mode="subscription"),
            "codex": ProviderConfig(enabled=True, auth_mode="subscription"),
            "google": ProviderConfig(enabled=False, auth_mode="subscription"),
            "opencode": ProviderConfig(enabled=True, auth_mode="subscription"),
            "openhands": ProviderConfig(
                enabled=True,
                emergency_only=True,
                auth_mode="api",
            ),
        }
    )
    routing: AgentsRoutingConfig = Field(default_factory=AgentsRoutingConfig)

    @model_validator(mode="after")
    def validate_provider_names(self) -> AgentsConfig:
        supported = {"claude", "codex", "google", "opencode", "openhands"}
        for name in supported - set(self.providers):
            self.providers[name] = ProviderConfig(enabled=False)
        known = set(self.providers)
        referenced = {
            provider
            for phase in self.routing.model_dump().values()
            if isinstance(phase, list)
            for provider in phase
        }
        unknown = sorted(referenced - known)
        if unknown:
            raise ValueError(f"Unknown agent provider(s): {', '.join(unknown)}")
        return self


class FactoryConfig(BaseModel):
    agents: AgentsConfig = Field(default_factory=AgentsConfig)
    repository: Path = Path("/var/lib/hellotalk-factory/repository")
    base_branch: str = "main"
    state_dir: Path = Path("/var/lib/hellotalk-factory")
    log_dir: Path = Path("/var/log/hellotalk-factory")
    profile_store: Path = Path("/var/lib/hellotalk-factory/profiles")
    worktree_dir: Path = Path("/var/lib/hellotalk-factory/worktrees")
    recovery_dir: Path = Path("/var/lib/hellotalk-factory/recovery")
    # Static architecture identity. This is deliberately separate from
    # factory_generation, which generation.py replaces with a unique per-daemon
    # ownership UUID after the host-level lock is acquired.
    factory_architecture: str = EXPECTED_FACTORY_ARCHITECTURE
    factory_generation: str = "unknown"
    openai_model: str = "gpt-5.2-codex"
    openai_max_concurrent_conversations: int = 2
    opencode_api_key: SecretStr
    opencode_base_url: str = "https://opencode.ai/zen/go/v1"
    opencode_model: str
    opencode_profile_name: str = "opencode-go"
    opencode_max_concurrent_conversations: int = 3
    planning_model: str | None = None
    terminal_execution_model: str | None = None
    bulk_ci_repair_model: str | None = None
    # Legacy fields remain loadable so old environment files fail with a precise
    # migration error instead of becoming unparsable. Gemini is not a production
    # execution tier in the Agent Canvas factory.
    gemini_api_key: SecretStr | None = None
    gemini_model: str = "gemini-3.6-flash"
    gemini_profile_name: str = "gemini-flash"
    gemini_enabled: bool = False
    gemini_free_tier_only: bool = True
    gemini_max_concurrent_conversations: int = 1
    monthly_subscription_budget_usd: float = 30
    monthly_variable_budget_usd: float = 0
    monthly_total_budget_usd: float = 35
    max_task_cost_usd: float = 2
    max_task_minutes: int = 120
    max_conversation_turns: int = 100
    max_consecutive_failures: int = 3
    max_parallel_jobs: int = 5
    cooldown_seconds: int = 60
    provider_cooldown_seconds: int = 300
    provider_slot_wait_seconds: int = 30
    oauth_degraded_hours: int = 24
    minimum_free_disk_gib: float = 5
    max_no_pr_hours: float = 6
    architect_interval_hours: float = 168
    architect_max_new_issues: int = 8
    github_token: SecretStr
    github_repository: str = "elgansayer/elgl"
    require_ready_label: bool = False
    ready_label: str = "factory-ready"
    telegram_bot_token: SecretStr | None = None
    telegram_chat_id: SecretStr | None = None
    podman_path: Path = Path("/usr/bin/podman")
    task_image: str = "localhost/hellotalk-factory-worker:current"
    dry_run: bool = False

    @field_validator(
        "repository", "state_dir", "log_dir", "profile_store", "worktree_dir", "recovery_dir"
    )
    @classmethod
    def absolute_paths(cls, value: Path) -> Path:
        if not value.is_absolute():
            raise ValueError("factory paths must be absolute")
        return value

    @field_validator(
        "max_task_minutes",
        "max_conversation_turns",
        "max_consecutive_failures",
        "max_parallel_jobs",
        "openai_max_concurrent_conversations",
        "opencode_max_concurrent_conversations",
        "gemini_max_concurrent_conversations",
        "provider_slot_wait_seconds",
        "architect_max_new_issues",
    )
    @classmethod
    def positive_limits(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("factory limits must be positive")
        return value

    @model_validator(mode="after")
    def consistent_budgets(self) -> FactoryConfig:
        if (
            min(
                self.monthly_subscription_budget_usd,
                self.monthly_variable_budget_usd,
                self.monthly_total_budget_usd,
                self.max_task_cost_usd,
            )
            < 0
        ):
            raise ValueError("budgets cannot be negative")
        if self.minimum_free_disk_gib < 1:
            raise ValueError("minimum free disk reserve must be at least 1 GiB")
        if self.factory_architecture != EXPECTED_FACTORY_ARCHITECTURE:
            raise ValueError(
                f"FACTORY_ARCHITECTURE must be {EXPECTED_FACTORY_ARCHITECTURE!r}; "
                "the retired swarm/older architecture must not share this control plane"
            )
        return self

    @classmethod
    def from_environment(cls, environment: Mapping[str, str] | None = None) -> FactoryConfig:
        env = os.environ if environment is None else environment

        def required(name: str) -> str:
            value = env.get(name, "").strip()
            if not value:
                raise ConfigurationError(f"Required environment variable {name} is missing")
            return value

        def boolean(name: str, default: bool) -> bool:
            return env.get(name, str(default)).lower() in {"1", "true", "yes"}

        import json

        agents_config = AgentsConfig()
        if boolean("GEMINI_ENABLED", False):
            raise ConfigurationError(
                "GEMINI_ENABLED is retired; configure a subscription agent provider instead"
            )
        agents_config_path = env.get("FACTORY_AGENTS_CONFIG")
        if agents_config_path:
            try:
                with open(agents_config_path) as f:
                    agents_data = json.load(f)
                agents_config = AgentsConfig(**agents_data)
            except (OSError, ValueError) as error:
                raise ConfigurationError(f"Invalid FACTORY_AGENTS_CONFIG: {error}") from error

        try:
            return cls(
                agents=agents_config,
                repository=Path(
                    env.get("FACTORY_REPOSITORY", cls.model_fields["repository"].default)
                ),
                base_branch=env.get("FACTORY_BASE_BRANCH", "main"),
                state_dir=Path(env.get("FACTORY_STATE_DIR", cls.model_fields["state_dir"].default)),
                log_dir=Path(env.get("FACTORY_LOG_DIR", cls.model_fields["log_dir"].default)),
                profile_store=Path(
                    env.get("FACTORY_PROFILE_STORE", cls.model_fields["profile_store"].default)
                ),
                worktree_dir=Path(
                    env.get("FACTORY_WORKTREE_DIR", cls.model_fields["worktree_dir"].default)
                ),
                recovery_dir=Path(
                    env.get("FACTORY_RECOVERY_DIR", cls.model_fields["recovery_dir"].default)
                ),
                factory_architecture=env.get(
                    "FACTORY_ARCHITECTURE", EXPECTED_FACTORY_ARCHITECTURE
                ),
                factory_generation=env.get("FACTORY_GENERATION", "unknown"),
                openai_model=env.get("OPENHANDS_OPENAI_MODEL", "gpt-5.2-codex"),
                openai_max_concurrent_conversations=int(
                    env.get("FACTORY_OPENAI_MAX_CONCURRENT_CONVERSATIONS", "2")
                ),
                opencode_api_key=SecretStr(required("OPENCODE_GO_API_KEY")),
                opencode_base_url=env.get(
                    "OPENCODE_GO_BASE_URL", "https://opencode.ai/zen/go/v1"
                ).rstrip("/"),
                opencode_model=required("OPENCODE_GO_MODEL"),
                opencode_profile_name=env.get("OPENCODE_GO_PROFILE_NAME", "opencode-go"),
                opencode_max_concurrent_conversations=int(
                    env.get("FACTORY_OPENCODE_MAX_CONCURRENT_CONVERSATIONS", "3")
                ),
                planning_model=env.get("FACTORY_PLANNING_MODEL"),
                terminal_execution_model=env.get("FACTORY_TERMINAL_EXECUTION_MODEL"),
                bulk_ci_repair_model=env.get("FACTORY_BULK_CI_REPAIR_MODEL"),
                gemini_api_key=SecretStr(env["GEMINI_API_KEY"])
                if env.get("GEMINI_API_KEY")
                else None,
                gemini_model=env.get("GEMINI_MODEL", "gemini-3.6-flash"),
                gemini_profile_name=env.get("GEMINI_PROFILE_NAME", "gemini-flash"),
                gemini_enabled=boolean("GEMINI_ENABLED", False),
                gemini_free_tier_only=boolean("GEMINI_FREE_TIER_ONLY", True),
                gemini_max_concurrent_conversations=int(
                    env.get("FACTORY_GEMINI_MAX_CONCURRENT_CONVERSATIONS", "1")
                ),
                monthly_subscription_budget_usd=float(
                    env.get("FACTORY_MONTHLY_SUBSCRIPTION_BUDGET_USD", "30")
                ),
                monthly_variable_budget_usd=float(
                    env.get("FACTORY_MONTHLY_VARIABLE_BUDGET_USD", "0")
                ),
                monthly_total_budget_usd=float(env.get("FACTORY_MONTHLY_TOTAL_BUDGET_USD", "35")),
                max_task_cost_usd=float(env.get("FACTORY_MAX_TASK_COST_USD", "2")),
                max_task_minutes=int(env.get("FACTORY_MAX_TASK_MINUTES", "120")),
                max_conversation_turns=int(env.get("FACTORY_MAX_CONVERSATION_TURNS", "100")),
                max_consecutive_failures=int(env.get("FACTORY_MAX_CONSECUTIVE_FAILURES", "3")),
                max_parallel_jobs=int(env.get("FACTORY_MAX_PARALLEL_JOBS", "5")),
                cooldown_seconds=int(env.get("FACTORY_COOLDOWN_SECONDS", "60")),
                provider_cooldown_seconds=int(env.get("FACTORY_PROVIDER_COOLDOWN_SECONDS", "300")),
                provider_slot_wait_seconds=int(env.get("FACTORY_PROVIDER_SLOT_WAIT_SECONDS", "30")),
                oauth_degraded_hours=int(env.get("FACTORY_OAUTH_DEGRADED_HOURS", "24")),
                minimum_free_disk_gib=float(env.get("FACTORY_MINIMUM_FREE_DISK_GIB", "5")),
                max_no_pr_hours=float(env.get("FACTORY_MAX_NO_PR_HOURS", "6")),
                architect_interval_hours=float(env.get("FACTORY_ARCHITECT_INTERVAL_HOURS", "168")),
                architect_max_new_issues=int(env.get("FACTORY_ARCHITECT_MAX_NEW_ISSUES", "8")),
                github_token=SecretStr(required("GITHUB_TOKEN")),
                github_repository=env.get("GITHUB_REPOSITORY", "elgansayer/elgl"),
                require_ready_label=boolean("FACTORY_REQUIRE_READY_LABEL", False),
                ready_label=env.get("FACTORY_READY_LABEL", "factory-ready"),
                telegram_bot_token=SecretStr(env["TELEGRAM_BOT_TOKEN"])
                if env.get("TELEGRAM_BOT_TOKEN")
                else None,
                telegram_chat_id=SecretStr(env["TELEGRAM_CHAT_ID"])
                if env.get("TELEGRAM_CHAT_ID")
                else None,
                podman_path=Path(env.get("FACTORY_PODMAN_PATH", "/usr/bin/podman")),
                task_image=env.get(
                    "FACTORY_TASK_IMAGE", "localhost/hellotalk-factory-worker:current"
                ),
            )
        except ValueError as error:
            raise ConfigurationError(str(error)) from error
