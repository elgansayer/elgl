"""Explicit factory exception hierarchy."""


class FactoryError(RuntimeError):
    """Base factory failure."""


class ConfigurationError(FactoryError):
    """Invalid or incomplete operator configuration."""


class AuthenticationRequired(FactoryError):
    """A provider requires operator-owned authentication."""


class BudgetExhausted(FactoryError):
    """A configured monetary allowance is exhausted."""


class RepositorySafetyError(FactoryError):
    """A repository operation violates a safety invariant."""


class VerificationFailed(FactoryError):
    """A required verification command failed."""


class ProviderCapacityUnavailable(FactoryError):
    """No eligible provider can start now, without consuming a task attempt."""

    def __init__(self, message: str, retry_after_seconds: int | None = None) -> None:
        super().__init__(message)
        self.retry_after_seconds = retry_after_seconds
