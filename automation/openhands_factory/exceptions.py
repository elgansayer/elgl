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
