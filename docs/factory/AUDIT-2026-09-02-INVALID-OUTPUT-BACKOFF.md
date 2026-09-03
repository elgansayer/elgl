# Factory efficiency audit: invalid-output provider backoff

Date: 2026-09-02

## Finding

The current production router opens provider circuits on the first classified provider-side failure and performs no immediate same-provider retry. That is the right allowance policy, but one configured failure class was not receiving a useful durable backoff.

`invalid_output_cooldown_seconds` was 60 seconds while both production Factory instances use `FACTORY_COOLDOWN_SECONDS=300`. A provider that returned malformed or otherwise unusable agent output therefore left its circuit before the next ordinary five-minute control-plane refresh. In practice, the first-failure circuit could protect the current route while providing no protection at the next normal scheduling pass.

This is materially different from a task-side verification failure. Invalid agent output means the provider process started and consumed subscription capacity, but did not return a result the Factory can safely use. Repeatedly rediscovering that condition is pure allowance waste.

## Change

Production `invalid_output_cooldown_seconds` is now 900 seconds.

With the existing five-minute production refresh cadence, a failed provider remains ineligible for at least two subsequent normal refreshes and becomes eligible for an autonomous half-open probe after fifteen minutes. The route can still fail over immediately to another healthy configured subscription provider, and the failed provider recovers automatically after the bounded cooldown.

The previous 60-second value could skip zero normal refreshes. The new value therefore changes provider eligibility without reducing the number of providers available to a logical task over time or creating a human-release state.

## Audit scope

The surrounding Factory controls were rechecked before making this change:

- production already uses zero immediate same-provider retries;
- the first provider-side failure opens the circuit;
- provider failover remains bounded and machine-driven;
- planning, architecture and implementation retain their stronger reasoning tiers, while bounded review and repair phases use cheaper models/effort where already proven safe;
- OpenHands PAYG remains disabled in production;
- prompt construction remains bounded and later phases receive smaller task bodies than implementation;
- issue admission, provider-start budgets and review-start budgets remain bounded;
- duplicate/convergence scans retain strong issue, logical-task, branch and supersession identity checks;
- deterministic verification, security review, independent review, reviewed-SHA protection and required GitHub checks remain unchanged;
- chronic task failures continue through autonomous durable backoff rather than requiring a person.

No additional model downgrade, concurrency reduction, retry removal, CI bypass or merge-policy change was high-confidence enough to combine with this focused correction.

## Autonomy and safety

This change introduces no quarantine, manual-triage or operator-release state. A malformed-output provider is temporarily removed from routing, another healthy provider can be tried under the existing route budget, and the failed provider becomes eligible again automatically after the cooldown.

No task failure is hidden or converted into success. The same verification, security review, independent review, exact reviewed SHA, `factory/independent-review`, `CI / required`, mergeability and branch-protection requirements remain authoritative.

## Regression coverage

`automation/tests/test_factory_efficiency_2026_09_02_invalid_output.py` locks the production circuit policy by asserting that:

- the circuit still opens on the first failure;
- invalid output receives a 900-second cooldown;
- the invalid-output cooldown is longer than the default transient-provider cooldown;
- the cooldown covers at least three five-minute production refresh intervals.

The existing `automation/tests/test_production_refresh_policy.py` independently locks both production Factory instance profiles to the 300-second refresh cadence, so the combined regression contracts prevent the cooldown and production scheduling cadence from silently drifting back into the wasteful relationship.

GitHub Actions on the pull-request head are the authoritative clean-environment validation for Ruff format/lint, mypy, the complete Factory pytest suite, governance and the canonical required gate.
