# Factory review admission efficiency audit

Date: 2026-08-30

## Finding

The conservative Factory correctly budgets independent reviews to two exact pull-request heads per hour, but the admission was recorded before provider capacity was known.

A review scheduling attempt could therefore consume one of the two hourly review admissions even when every eligible provider was busy, or when review preparation failed before any provider process started. No subscription-backed review work occurred, yet the SHA remained blocked by the review budget until the admission window expired.

This is control-plane accounting waste rather than an engineering-quality problem.

## Change

Review admission is now charged at the same provider-start boundary used by the durable agent-route budget:

1. task fairness and review concurrency are checked first;
2. the base router resolves provider health and capacity;
3. review preparation runs;
4. immediately before the first review provider process starts, the exact-head review admission is persisted;
5. provider execution proceeds normally.

A fallback provider in the same logical review does not consume a second exact-head review admission. The ordinary provider-route budget still charges every real provider start, including fallback starts.

## Efficiency impact

With the production limit of two reviews per hour, a busy-provider scheduling miss previously could waste 50% of the entire hourly independent-review allowance without performing a review. Two such misses could block all review progress for the window.

After this change, provider-capacity misses and pre-provider preparation failures consume zero review admissions. The allowance represents actual review starts rather than scheduler attempts.

## Autonomy and quality

This change does not introduce quarantine, manual triage, or a human decision point. A deferred review remains machine-owned and is retried by the existing scheduler.

The following remain unchanged:

- mandatory independent review;
- review-provider diversity;
- local verification;
- security review;
- quality and CI repair;
- reviewed-head SHA protection;
- `factory/independent-review`;
- `CI / required`;
- mergeability and branch-protection checks.

## Regression coverage

Focused tests verify that:

- a busy provider consumes no exact-head review admission;
- once provider capacity becomes available, the same review starts and consumes exactly one admission;
- a preparation failure before provider start consumes no review admission.
