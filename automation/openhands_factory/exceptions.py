"""Explicit factory exception hierarchy."""


class FactoryError(RuntimeError):
    """Base factory failure."""


class ConfigurationError(FactoryError):
    """Invalid or incomplete operator configuration."""


class AuthenticationRequired(FactoryError):
    """A provider requires operator-owned authentication."""


class BudgetExhausted(FactoryError):
    """A configured monetary allowance is exhausted."""


class ProviderCapacityUnavailable(FactoryError):
    """No configured provider can currently accept work.

    This is deliberately distinct from a task failure. The scheduler should defer the
    job without consuming a task attempt and try again after provider cooldowns expire.
    """

    def __init__(self, message: str, retry_after_seconds: int | None = None) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds


class RepositorySafetyError(FactoryError):
    """A repository operation violates a safety invariant."""


class VerificationFailed(FactoryError):
    """A required verification command failed."""


class AgentTaskFailure(FactoryError):
    """A responsive agent could not satisfy the task contract."""
