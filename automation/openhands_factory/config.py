"""Strict environment configuration without secret logging."""

from __future__ import annotations

import os
from collections.abc import Mapping
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator, model_validator

from openhands_factory.architecture_guard import EXPECTED_FACTORY_ARCHITECTURE
from openhands_factory.exceptions import ConfigurationError


class ProviderConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    enabled: bool = False
    command: str | None = None
    wrapper_command: str | None = None
    cli_variant: Literal["gemini", "antigravity"] | None = None
    auth_mode: str | None = None
    transport: str = "cli"
    emergency_only: bool = False
    max_concurrency: int = 2
    model: str | None = None
    phase_models: dict[str, str] = Field(default_factory=dict)
    timeout_seconds: int | None = None
    max_output_bytes: int = 1_000_000
    max_turns: int = 100
    extra_args: list[str] = Field(default_factory=list)
    credential_paths: list[str] = Field(default_factory=list)
    runtime_paths: list[str] = Field(default_factory=list)

    @model_validator(mode="after")
    def validate_provider(self) -> ProviderConfig:
        if self.max_concurrency <= 0:
            raise ValueError("provider max_concurrency must be positive")
        if self.timeout_seconds is not None and self.timeout_seconds <= 0:
            raise ValueError("provider timeout_seconds must be positive")
        if self.max_output_bytes <= 0 or self.max_turns <= 0:
            raise ValueError("provider output and turn limits must be positive")
        if self.transport not in {"cli", "openhands-sdk"}:
            raise ValueError(f"Unsupported provider transport: {self.transport}")
        if self.auth_mode not in {None, "subscription", "api"}:
            raise ValueError(f"Unsupported provider auth_mode: {self.auth_mode}")
        valid_phases = {
            "planning",
            "architecture",
            "implementation",
            "security-review",
            "security_review",
            "quality-repair",
            "quality_repair",
            "code-review",
            "code_review",
            "ci-repair",
            "ci_repair",
            "general-action",
            "general_action",
        }
        unknown = sorted(set(self.phase_models) - valid_phases)
        if unknown:
            raise ValueError(f"Unknown model phase(s): {', '.join(unknown)}")
        home_paths = [*self.credential_paths, *self.runtime_paths]
        if len(home_paths) > 16:
            raise ValueError("provider home mounts are limited to 16 paths")
        for value in home_paths:
            path = Path(value)
            if (
                not value
                or path.is_absolute()
                or path == Path(".")
                or ".." in path.parts
                or any(marker in value for marker in ("\x00", "\n", "|"))
            ):
                raise ValueError(f"Unsafe provider home mount: {value!r}")
        if len(set(home_paths)) != len(home_paths):
            raise ValueError("provider home mounts must be unique")
        for index, path in enumerate(map(Path, home_paths)):
            for other in map(Path, home_paths[index + 1 :]):
                if path.is_relative_to(other) or other.is_relative_to(path):
                    raise ValueError("provider home mounts must not overlap")
        return self


class AgentTimeoutsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    planning: int = 1200
    architecture: int = 1800
    implementation: int = 3600
    security_review: int = 1800
    # Repair/review phases now route to each provider's fast/low-effort tier
    # (see phase_models and claude.py's per-phase --effort), so a runaway
    # attempt on a narrow CI failure or review pass shouldn't need the same
    # hour-long ceiling implementation gets. Left generous enough that a
    # genuinely slow attempt still finishes rather than getting killed into
    # an extra retry cycle.
    quality_repair: int = 1800
    code_review: int = 900
    ci_repair: int = 1800
    general_action: int = 1800

    @model_validator(mode="after")
    def positive_timeouts(self) -> AgentTimeoutsConfig:
        if any(value <= 0 for value in self.model_dump().values()):
            raise ValueError("agent phase timeouts must be positive")
        return self

    def for_phase(self, phase: str) -> int:
        return int(getattr(self, phase.replace("-", "_")))


class AgentCircuitBreakerConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    failure_threshold: int = 2
    default_cooldown_seconds: int = 300
    rate_limit_cooldown_seconds: int = 300
    quota_cooldown_seconds: int = 3600
    auth_cooldown_seconds: int = 900
    unavailable_cooldown_seconds: int = 300
    transport_cooldown_seconds: int = 300
    timeout_cooldown_seconds: int = 300
    crash_cooldown_seconds: int = 300
    invalid_output_cooldown_seconds: int = 60

    @model_validator(mode="after")
    def positive_values(self) -> AgentCircuitBreakerConfig:
        if any(value <= 0 for value in self.model_dump().values()):
            raise ValueError("agent circuit-breaker values must be positive")
        return self


class AgentsRoutingConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    planning: list[str] = Field(
        default_factory=lambda: ["claude", "codex", "google", "opencode", "pi"]
    )
    architecture: list[str] = Field(
        default_factory=lambda: ["claude", "codex", "google", "opencode", "pi"]
    )
    implementation: list[str] = Field(
        default_factory=lambda: ["claude", "codex", "google", "opencode", "pi"]
    )
    security_review: list[str] = Field(
        default_factory=lambda: ["claude", "codex", "google", "opencode", "pi"]
    )
    quality_repair: list[str] = Field(
        default_factory=lambda: ["codex", "claude", "google", "opencode", "pi"]
    )
    code_review: list[str] = Field(
        default_factory=lambda: ["codex", "claude", "google", "opencode", "pi"]
    )
    ci_repair: list[str] = Field(
        default_factory=lambda: ["codex", "claude", "google", "opencode", "pi"]
    )
    general_action: list[str] = Field(
        default_factory=lambda: ["opencode", "google", "codex", "claude", "pi"]
    )
    skip_busy_providers: bool = True
    same_provider_retries: int = 1

    @field_validator("same_provider_retries")
    @classmethod
    def bounded_same_provider_retries(cls, value: int) -> int:
        if value < 0 or value > 2:
            raise ValueError("same_provider_retries must be between 0 and 2")
        return value


class AgentsConfig(BaseModel):
    model_config = ConfigDict(extra="forbid")

    routing_enabled: bool = True
    providers: dict[str, ProviderConfig] = Field(
        default_factory=lambda: {
            "claude": ProviderConfig(
                enabled=True,
                command="claude",
                auth_mode="subscription",
                model="fable",
                credential_paths=[".claude", ".claude.json"],
                runtime_paths=[".local/bin", ".local/share/claude", ".npm-global"],
                phase_models={
                    "planning": "opus",
                    "architecture": "opus",
                    "security_review": "opus",
                    "implementation": "sonnet",
                    "quality_repair": "haiku",
                    "code_review": "haiku",
                    "ci_repair": "haiku",
                    "general_action": "fable",
                },
            ),
            "codex": ProviderConfig(
                enabled=True,
                command="codex",
                auth_mode="subscription",
                model="gpt-5.6-sol",
                credential_paths=[".codex"],
                runtime_paths=[".local/bin", ".npm-global"],
            ),
            "google": ProviderConfig(
                enabled=True,
                command="agy",
                cli_variant="antigravity",
                auth_mode="subscription",
                model="gemini-3.1-pro-high",
                credential_paths=[".gemini"],
                runtime_paths=[".local/bin", ".npm-global"],
                phase_models={
                    "planning": "gemini-3.1-pro-high",
                    "architecture": "gemini-3.1-pro-high",
                    "security_review": "gemini-3.1-pro-high",
                    "implementation": "gemini-3.1-pro-high",
                    "quality_repair": "gemini-3.7-flash-low",
                    "code_review": "gemini-3.7-flash-low",
                    "ci_repair": "gemini-3.7-flash-low",
                    "general_action": "gemini-3.7-flash-low",
                },
            ),
            "opencode": ProviderConfig(
                enabled=True,
                command="opencode",
                auth_mode="subscription",
                # opencode-go/deepseek-v4-flash is the fast tier of the
                # opencode-go catalog (verified via `opencode models`) - used
                # uniformly rather than split by phase.
                model="opencode-go/deepseek-v4-flash",
                credential_paths=[".config/opencode", ".local/share/opencode"],
                runtime_paths=[".local/bin", ".npm-global", ".opencode"],
            ),
            "openhands": ProviderConfig(
                enabled=False,
                emergency_only=True,
                auth_mode="api",
                transport="openhands-sdk",
                model="gpt-5.6-sol",
            ),
            "pi": ProviderConfig(
                enabled=True,
                command="pi",
                auth_mode="subscription",
                model="github-copilot/claude-sonnet-5",
                credential_paths=[".pi"],
                # pi's native installer places its executable in .local/bin as a
                # symlink into .local/lib/node_modules; both must be mounted or
                # the sandboxed process cannot resolve the symlink target.
                runtime_paths=[".local/bin", ".local/lib"],
                phase_models={
                    "planning": "github-copilot/claude-opus-5",
                    "architecture": "github-copilot/claude-opus-5",
                    "security_review": "github-copilot/claude-opus-5",
                    "implementation": "github-copilot/claude-sonnet-5",
                    "quality_repair": "github-copilot/claude-haiku-4.5",
                    "code_review": "github-copilot/claude-haiku-4.5",
                    "ci_repair": "github-copilot/claude-haiku-4.5",
                    "general_action": "github-copilot/claude-haiku-4.5",
                },
            ),
        }
    )
    routing: AgentsRoutingConfig = Field(default_factory=AgentsRoutingConfig)
    timeouts: AgentTimeoutsConfig = Field(default_factory=AgentTimeoutsConfig)
    circuit_breaker: AgentCircuitBreakerConfig = Field(default_factory=AgentCircuitBreakerConfig)

    @model_validator(mode="before")
    @classmethod
    def apply_provider_transport_defaults(cls, value: object) -> object:
        if not isinstance(value, dict):
            return value
        providers = value.get("providers")
        if not isinstance(providers, dict):
            return value
        normalised_providers: dict[object, object] = {}
        for name, provider in providers.items():
            if not isinstance(provider, dict):
                normalised_providers[name] = provider
                continue
            normalised_provider = dict(provider)
            normalised_provider.setdefault(
                "transport", "openhands-sdk" if name == "openhands" else "cli"
            )
            normalised_provider.setdefault(
                "auth_mode", "api" if name == "openhands" else "subscription"
            )
            defaults = {
                "claude": {
                    "credential_paths": [".claude", ".claude.json"],
                    "runtime_paths": [".local/bin", ".local/share/claude", ".npm-global"],
                },
                "codex": {
                    "credential_paths": [".codex"],
                    "runtime_paths": [".local/bin", ".npm-global"],
                },
                "google": {
                    "credential_paths": [".gemini"],
                    "runtime_paths": [".local/bin", ".npm-global"],
                },
                "opencode": {
                    "credential_paths": [".config/opencode", ".local/share/opencode"],
                    "runtime_paths": [".local/bin", ".npm-global", ".opencode"],
                },
                "pi": {
                    "credential_paths": [".pi"],
                    "runtime_paths": [".local/bin", ".local/lib"],
                },
            }.get(str(name), {})
            for key, default in defaults.items():
                normalised_provider.setdefault(key, default)
            normalised_providers[name] = normalised_provider
        normalised = dict(value)
        normalised["providers"] = normalised_providers
        return normalised

    @classmethod
    def legacy_openhands_only(cls) -> AgentsConfig:
        # openhands now defaults to disabled (config.py's production default has
        # no working credential for it), so it must be constructed pre-enabled
        # here rather than enabled after the fact: routing_enabled=False requires
        # openhands to already be enabled at validation time, which runs during
        # construction, before any post-construction mutation could take effect.
        config = cls(
            routing_enabled=False,
            providers={
                "openhands": ProviderConfig(
                    enabled=True,
                    emergency_only=False,
                    auth_mode="api",
                    transport="openhands-sdk",
                    model="gpt-5.6-sol",
                ),
            },
        )
        return config

    @model_validator(mode="after")
    def validate_provider_names(self) -> AgentsConfig:
        supported = {"claude", "codex", "google", "opencode", "openhands", "pi"}
        declared_unknown = sorted(set(self.providers) - supported)
        if declared_unknown:
            raise ValueError(f"Unknown agent provider(s): {', '.join(declared_unknown)}")
        for name in supported - set(self.providers):
            self.providers[name] = ProviderConfig(enabled=False)
        for name, provider in self.providers.items():
            if provider.cli_variant is not None and name != "google":
                raise ValueError("cli_variant is supported only by the google provider")
            expected_transport = "openhands-sdk" if name == "openhands" else "cli"
            if provider.enabled and provider.transport != expected_transport:
                raise ValueError(
                    f"Provider {name!r} requires transport {expected_transport!r}, "
                    f"not {provider.transport!r}"
                )
            expected_auth_mode = "api" if name == "openhands" else "subscription"
            if provider.enabled and provider.auth_mode != expected_auth_mode:
                raise ValueError(
                    f"Provider {name!r} requires auth_mode {expected_auth_mode!r}, "
                    f"not {provider.auth_mode!r}"
                )
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
        if not self.routing_enabled:
            if not self.providers["openhands"].enabled:
                raise ValueError("OpenHands must be enabled when agent routing is disabled")
            return self
        for phase, names in self.routing.model_dump().items():
            if not isinstance(names, list):
                continue
            if not any(self.providers[name].enabled for name in names):
                raise ValueError(f"Agent route {phase!r} has no enabled provider")
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
    openai_model: str = "gpt-5.6-sol"
    openai_max_concurrent_conversations: int = 2
    opencode_api_key: SecretStr | None = None
    opencode_base_url: str = "https://opencode.ai/zen/go/v1"
    opencode_model: str | None = None
    opencode_profile_name: str = "opencode-go"
    opencode_max_concurrent_conversations: int = 3
    planning_model: str | None = None
    terminal_execution_model: str | None = None
    bulk_ci_repair_model: str | None = None
    # Legacy API-backed Gemini fields remain loadable so old environment files
    # fail with a precise migration error instead of becoming unparsable. The
    # direct Google subscription adapter is configured under agents.providers.
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
    # Zero preserves the historical unlimited admission behaviour. Production can
    # set 3600/1 to admit exactly one newly discovered GitHub issue per hour while
    # allowing in-flight implementation, review, CI repair, and PR work to continue.
    new_issue_interval_seconds: int = 0
    new_issues_per_interval: int = 1
    label_reconciliation_batch_size: int = 25
    cooldown_seconds: int = 60
    provider_cooldown_seconds: int = 300
    provider_slot_wait_seconds: int = 30
    oauth_degraded_hours: int = 24
    minimum_free_disk_gib: float = 5
    # archive_worktree() writes a full worktree copy into recovery_dir on every
    # crash-recovery path with nothing that ever deletes them; left unpruned,
    # these silently consume the disk-space reserve minimum_free_disk_gib
    # protects, permanently pausing scheduling with no further log output
    # once the check has already failed once (it only logs on state changes).
    recovery_retention_hours: float = 72
    max_no_pr_hours: float = 6
    architect_interval_hours: float = 168
    architect_max_new_issues: int = 8
    # Quarantine (after FACTORY_MAX_CONSECUTIVE_FAILURES repeated identical
    # failures) is a bounded cooldown, not a dead end: a fully autonomous
    # deployment with no operator triage step needs a task to come back and
    # try again on its own on a short horizon, not sit inert for a day.
    # Durable failure counters, the fingerprint, and last_error are preserved
    # across this recovery, so a genuinely broken task simply re-quarantines
    # after its next few attempts rather than tight-looping.
    quarantine_recovery_minutes: int = 30
    review_lane_first: bool = True
    review_reserve_provider_slot: bool = True
    review_lane_max_concurrent: int = 1
    github_token: SecretStr
    github_repository: str = "elgansayer/elgl"
    require_trusted_intake: bool = False
    trusted_github_actors: frozenset[str] = frozenset({"elgansayer"})
    control_github_actors: frozenset[str] = frozenset({"elgansayer"})
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
        "new_issues_per_interval",
        "openai_max_concurrent_conversations",
        "opencode_max_concurrent_conversations",
        "gemini_max_concurrent_conversations",
        "provider_slot_wait_seconds",
        "architect_max_new_issues",
        "review_lane_max_concurrent",
        "quarantine_recovery_minutes",
    )
    @classmethod
    def positive_limits(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("factory limits must be positive")
        return value

    @field_validator("new_issue_interval_seconds")
    @classmethod
    def non_negative_issue_interval(cls, value: int) -> int:
        if value < 0:
            raise ValueError("new issue interval cannot be negative")
        return value

    @field_validator("label_reconciliation_batch_size")
    @classmethod
    def bounded_label_reconciliation_batch(cls, value: int) -> int:
        if not 1 <= value <= 100:
            raise ValueError("label reconciliation batch size must be between 1 and 100")
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
        if self.recovery_retention_hours <= 0:
            raise ValueError("recovery retention must be positive")
        if self.factory_architecture != EXPECTED_FACTORY_ARCHITECTURE:
            raise ValueError(
                f"FACTORY_ARCHITECTURE must be {EXPECTED_FACTORY_ARCHITECTURE!r}; "
                "the retired swarm/older architecture must not share this control plane"
            )
        if (self.opencode_api_key is None) != (self.opencode_model is None):
            raise ValueError(
                "OPENCODE_GO_API_KEY and OPENCODE_GO_MODEL must either both be set or both be empty"
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

        agents_config = AgentsConfig.legacy_openhands_only()
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

        github_repository = env.get("GITHUB_REPOSITORY", "elgansayer/elgl")
        repository_owner = github_repository.partition("/")[0]
        trusted_github_actors = frozenset(
            actor.strip().casefold()
            for actor in env.get("FACTORY_TRUSTED_GITHUB_ACTORS", repository_owner).split(",")
            if actor.strip()
        )
        control_github_actors = frozenset(
            actor.strip().casefold()
            for actor in env.get("FACTORY_CONTROL_GITHUB_ACTORS", repository_owner).split(",")
            if actor.strip()
        )

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
                factory_architecture=env.get("FACTORY_ARCHITECTURE", EXPECTED_FACTORY_ARCHITECTURE),
                factory_generation=env.get("FACTORY_GENERATION", "unknown"),
                openai_model=env.get("OPENHANDS_OPENAI_MODEL", "gpt-5.6-sol"),
                openai_max_concurrent_conversations=int(
                    env.get("FACTORY_OPENAI_MAX_CONCURRENT_CONVERSATIONS", "2")
                ),
                opencode_api_key=SecretStr(env["OPENCODE_GO_API_KEY"])
                if env.get("OPENCODE_GO_API_KEY", "").strip()
                else None,
                opencode_base_url=env.get(
                    "OPENCODE_GO_BASE_URL", "https://opencode.ai/zen/go/v1"
                ).rstrip("/"),
                opencode_model=env.get("OPENCODE_GO_MODEL") or None,
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
                new_issue_interval_seconds=int(env.get("FACTORY_NEW_ISSUE_INTERVAL_SECONDS", "0")),
                new_issues_per_interval=int(env.get("FACTORY_NEW_ISSUES_PER_INTERVAL", "1")),
                label_reconciliation_batch_size=int(
                    env.get("FACTORY_LABEL_RECONCILIATION_BATCH_SIZE", "25")
                ),
                cooldown_seconds=int(env.get("FACTORY_COOLDOWN_SECONDS", "60")),
                provider_cooldown_seconds=int(env.get("FACTORY_PROVIDER_COOLDOWN_SECONDS", "300")),
                provider_slot_wait_seconds=int(env.get("FACTORY_PROVIDER_SLOT_WAIT_SECONDS", "30")),
                oauth_degraded_hours=int(env.get("FACTORY_OAUTH_DEGRADED_HOURS", "24")),
                minimum_free_disk_gib=float(env.get("FACTORY_MINIMUM_FREE_DISK_GIB", "5")),
                recovery_retention_hours=float(env.get("FACTORY_RECOVERY_RETENTION_HOURS", "72")),
                max_no_pr_hours=float(env.get("FACTORY_MAX_NO_PR_HOURS", "6")),
                architect_interval_hours=float(env.get("FACTORY_ARCHITECT_INTERVAL_HOURS", "168")),
                architect_max_new_issues=int(env.get("FACTORY_ARCHITECT_MAX_NEW_ISSUES", "8")),
                quarantine_recovery_minutes=int(
                    env.get("FACTORY_QUARANTINE_RECOVERY_MINUTES", "30")
                ),
                review_lane_first=boolean("FACTORY_REVIEW_LANE_FIRST", True),
                review_reserve_provider_slot=boolean("FACTORY_REVIEW_RESERVE_PROVIDER_SLOT", True),
                review_lane_max_concurrent=int(env.get("FACTORY_REVIEW_LANE_MAX_CONCURRENT", "1")),
                github_token=SecretStr(required("GITHUB_TOKEN")),
                github_repository=github_repository,
                require_trusted_intake=boolean("FACTORY_REQUIRE_TRUSTED_INTAKE", False),
                trusted_github_actors=trusted_github_actors,
                control_github_actors=control_github_actors,
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
