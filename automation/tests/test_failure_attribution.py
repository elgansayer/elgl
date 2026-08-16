from openhands_factory.failure_attribution import attribute_failed_checks


def test_identical_failed_check_is_attributed_to_the_base() -> None:
    attribution = attribute_failed_checks(
        {"backend / unit", "frontend / build"},
        {"backend / unit"},
    )

    assert attribution.base_failures == ("backend / unit",)
    assert attribution.introduced_failures == ("frontend / build",)
    assert attribution.has_base_failures is True
    assert attribution.has_introduced_failures is True


def test_pr_only_failure_is_introduced_by_the_pr() -> None:
    attribution = attribute_failed_checks(
        {"factory"},
        {"backend / lint"},
    )

    assert attribution.base_failures == ()
    assert attribution.introduced_failures == ("factory",)
    assert attribution.has_base_failures is False
    assert attribution.has_introduced_failures is True


def test_base_only_failures_do_not_get_assigned_to_a_green_pr_check_set() -> None:
    attribution = attribute_failed_checks(set(), {"backend / unit"})

    assert attribution.base_failures == ()
    assert attribution.introduced_failures == ()
    assert attribution.has_base_failures is False
    assert attribution.has_introduced_failures is False


def test_attribution_order_is_stable_for_operator_state() -> None:
    attribution = attribute_failed_checks(
        {"z-check", "a-check", "m-check"},
        {"z-check", "a-check"},
    )

    assert attribution.base_failures == ("a-check", "z-check")
    assert attribution.introduced_failures == ("m-check",)
