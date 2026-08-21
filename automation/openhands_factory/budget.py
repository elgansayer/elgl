"""Fail-closed monthly and per-task monetary controls."""

from dataclasses import dataclass

from openhands_factory.exceptions import BudgetExhausted


@dataclass(frozen=True)
class BudgetSnapshot:
    subscription_spend_usd: float
    variable_spend_usd: float
    vps_spend_usd: float
    task_spend_usd: float


def enforce_budget(
    snapshot: BudgetSnapshot,
    *,
    subscription_ceiling: float,
    variable_ceiling: float,
    total_ceiling: float,
    task_ceiling: float,
) -> None:
    if snapshot.subscription_spend_usd > subscription_ceiling:
        raise BudgetExhausted("Monthly subscription budget is exhausted")
    if snapshot.variable_spend_usd > variable_ceiling:
        raise BudgetExhausted("Monthly variable API budget is exhausted")
    total = snapshot.subscription_spend_usd + snapshot.variable_spend_usd + snapshot.vps_spend_usd
    if total > total_ceiling:
        raise BudgetExhausted("Monthly total operating budget is exhausted")
    if snapshot.task_spend_usd > task_ceiling:
        raise BudgetExhausted("Per-task budget is exhausted")
