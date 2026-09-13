# Factory diagnostic timeout audit

Date: 2026-09-05

## Scope

This pass rechecked the current Factory after the recent prompt, routing, CI, provider-retry, source-scoped refresh, review-admission, and reasoning-effort changes. The goal remains to reduce subscription/API allowance without reducing useful implementation throughput or weakening verification, security review, independent review, exact-head protection, or autonomous recovery.

## Finding

The remaining production `GENERAL_ACTION` caller is a best-effort Factory-internal stall diagnosis. Deterministic diagnostics are gathered and surfaced independently before the model is invoked, routing is already restricted to one regular provider, and the phase does not gate implementation, verification, review, or merge eligibility.

The 2026-09-01 audit reduced this phase from a 30-minute ceiling to 10 minutes. The 2026-09-04 audit then reduced Claude/Codex reasoning effort for the same bounded phase. With those controls in place, allowing a single optional diagnosis to retain a subscription slot for a further ten minutes is still disproportionate to its role.

## Change

Production `general_action` timeout: **600 seconds -> 300 seconds**.

This halves the worst-case runtime/allowance exposure of one optional diagnostic session. The deterministic evidence remains available if the provider times out, and the next daemon cycle can diagnose again after the normal durable resource/circuit controls allow it.

No productive phase timeout changes. Planning remains 20 minutes, architecture/security/quality/CI repair 30 minutes, implementation 60 minutes, and independent code review 15 minutes. Provider order, one-provider Factory-internal `GENERAL_ACTION` routing, zero same-provider retries, two-provider fallback cap for productive phases, global route admission, and concurrency are unchanged.

## Expected efficiency

The deterministic bound improves from 10 minutes to 5 minutes, a **50% reduction in maximum provider occupancy and allowance exposure per stalled diagnostic**. No token percentage is claimed because subscription CLIs do not expose a portable token meter.

## Safety

`GENERAL_ACTION` is not part of the merge safety chain. Implementation, deterministic verification, security review, independent review, reviewed-SHA checks, current-main CI gating, and mergeability checks are unchanged. A diagnostic timeout cannot make an unsafe PR merge; it only ends optional reasoning over evidence that was already gathered outside the model.
