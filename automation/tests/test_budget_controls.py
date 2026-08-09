import pytest

from openhands_factory.budget import BudgetSnapshot, enforce_budget
from openhands_factory.exceptions import BudgetExhausted


def test_zero_variable_budget_rejects_paid_usage() -> None:
    with pytest.raises(BudgetExhausted, match="variable"):
        enforce_budget(
            BudgetSnapshot(30, 0.01, 5, 0.01),
            subscription_ceiling=30,
            variable_ceiling=0,
            total_ceiling=35,
            task_ceiling=2,
        )


def test_unknown_subscription_cost_does_not_invent_api_cost() -> None:
    enforce_budget(
        BudgetSnapshot(30, 0, 5, 0),
        subscription_ceiling=30,
        variable_ceiling=0,
        total_ceiling=35,
        task_ceiling=2,
    )
