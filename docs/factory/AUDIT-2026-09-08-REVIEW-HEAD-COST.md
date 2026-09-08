# Factory efficiency audit: provider-managed review head settling

## Finding

The existing exact-SHA review debounce is structurally correct, but the deployed 120-second quiet period is shorter than observed delayed commit bursts from provider-managed pull requests.

PR #8865 is a concrete example. After Factory-side repair work produced commits at 22:29, 22:33, and 22:36 UTC on 2026-09-08, the provider-managed branch published another Jules commit at 22:42:41, invalidating that repaired head. Factory restored the reviewed bounded implementation at 22:44:56, then Jules published another stale implementation at 22:50:16. Those late writes arrived roughly six minutes after the preceding repaired heads and forced additional verification/review convergence work.

A two-minute head debounce can therefore admit a subscription-backed independent review while a provider task is still capable of publishing a delayed follow-up commit.

## Change

Production Factory profiles and the deployment example now use:

```text
FACTORY_REVIEW_HEAD_STABILITY_SECONDS=600
```

The existing `ReviewHeadStabilityGate` already applies this only to externally/provider-managed pull requests. Factory-owned issue PRs are not delayed. A changed SHA resets the observation automatically, and the review is released without human action once the same exact SHA remains stable for the configured period.

The gate runs before review concurrency, SHA-scoped review admission, route admission, or provider execution. Moving heads therefore consume no independent-review or provider-route allowance while they are settling.

## Quality and autonomy invariants

This change does not remove or bypass verification, security review, independent review, reviewed-SHA protection, `CI / required`, `factory/independent-review`, mergeability checks, or the exact-head merge fence. It only delays the point at which subscription-backed review starts for an external branch whose producer may still be writing.

There is no quarantine, manual-triage, or human-release path. Head movement resets a bounded timer and stable heads proceed automatically.

## Regression coverage

`automation/tests/test_factory_instance_efficiency.py` requires all checked production/example Factory profiles to retain at least a ten-minute external-review quiet period. Existing `test_review_head_stability.py` coverage continues to verify that moving external heads consume no provider/review budget and that Factory-owned issue PRs are not delayed.
