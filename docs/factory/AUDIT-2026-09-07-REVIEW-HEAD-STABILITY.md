# Factory moving-head review efficiency audit

Date: 2026-09-07

## Finding

Independent review is already exact-head protected and restart-safe, and same-SHA repeat reviews are suppressed. A remaining waste path exists before that boundary: an externally managed or provider-managed pull-request branch can publish several commits in quick succession, while the Factory is free to spend a subscription-backed review on each newly observed SHA.

Every such review can be technically correct and still become useless immediately when the producer publishes the next commit. The newer SHA then requires another independent review by design. GitHub Actions can cancel superseded workflow runs, but that does not recover provider allowance already spent reviewing the obsolete head.

This is especially expensive for automated producer branches because implementation, repair, formatting, generated-file reconciliation, or a provider's own follow-up can arrive as separate pushes.

## Change

Production Factory profiles now require an external/provider-managed PR head to remain unchanged for 120 seconds before a subscription-backed independent code review may start.

The quiet-period gate is restart-safe and stores only:

- pull-request identity;
- exact head SHA; and
- the first observation timestamp for that SHA.

A new SHA resets its timer automatically. Once the same SHA survives the quiet period, the existing review route proceeds normally.

The check runs before review concurrency, exact-head review admission, provider-route admission, or any provider process starts. A moving head therefore consumes none of those scarce resources.

Factory-owned issue work is intentionally not delayed because the Factory controls when those branches are pushed and already advances them through its own verification/review state machine.

## Autonomy

Deferral is a machine-owned scheduling decision, not a hold state. There is no quarantine, manual triage, human release, approval request, or operator action. A changed head automatically restarts the bounded timer and a stable head automatically becomes runnable.

The existing `ProviderCapacityUnavailable` scheduling path carries the exact retry delay without incrementing a task-failure attempt.

## Quality and merge safety

This change does not remove, bypass, or weaken:

- implementation verification;
- security review;
- quality or CI repair;
- independent review;
- provider diversity for independent review;
- exact reviewed-SHA protection;
- `factory/independent-review`;
- `CI / required`;
- mergeability or branch-protection requirements.

The change only avoids paying for review before a producer has finished publishing a realistic candidate head.

## Expected efficiency impact

Each burst of two or more observed producer heads can now collapse to one independent-review provider start instead of one start per intermediate SHA. No token-saving percentage is claimed because the exact saving depends on branch churn and review prompt/output size.

The trade-off is a bounded 120-second delay for newly observed external PR heads. This is deliberately smaller than the production five-minute general refresh cadence and materially cheaper than repeated review/repair cycles on immediately superseded SHAs.

## Regression coverage

Focused tests verify that:

- the first observation is deferred for the configured quiet period;
- an unchanged head becomes eligible automatically;
- a changed head resets the quiet period;
- observation state survives a process restart;
- a deferred external PR consumes no provider start, provider-route admission, or review admission; and
- Factory-owned issue PR review is not delayed.
