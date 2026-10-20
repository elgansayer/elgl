# Factory efficiency audit: Pi stall-diagnostic thinking

Date: 2026-09-06

## Finding

The production Factory already treats `GENERAL_ACTION` as best-effort control-plane diagnosis rather than productive engineering work. The only production caller reasons over a deterministic stall-diagnostic snapshot, routing is bounded to a single regular provider candidate, the phase has a five-minute timeout, and failure does not gate implementation, verification, review, or merge eligibility.

Recent efficiency work lowered Claude and Codex `GENERAL_ACTION` reasoning to their low tiers, but Pi still requested `--thinking medium`. Production already routes Pi `GENERAL_ACTION` to `github-copilot/claude-haiku-4.5`, so retaining medium thinking for this optional bounded diagnostic is inconsistent with the current cost policy and can consume avoidable Copilot-backed reasoning allowance when Pi is selected.

## Change

Pi `GENERAL_ACTION` now uses `--thinking low` instead of `medium`.

No other Pi phase changes. Planning, architecture, and implementation remain `max`; security review remains `high`; independent code review remains `medium`; bounded quality and CI repair remain `low`.

## Expected efficiency

This reduces reasoning allocation for the only non-productive Pi phase without changing provider order, provider count, model selection, timeout, retry policy, concurrency, or autonomous recovery. No token percentage is claimed because the subscription-backed CLI does not expose a portable billable-token meter.

The saving is deliberately narrow but high confidence: the deterministic diagnostic evidence exists before the model starts, the result is advisory, and a timeout or provider failure cannot weaken a merge decision.

## Safety and autonomy

Verification, security review, independent exact-head review, reviewed-SHA protection, `factory/independent-review`, `CI / required`, mergeability checks, and exact-head merge protection are unchanged. Independent review keeps its existing Pi medium-thinking floor.

No quarantine, human-triage, manual approval, or human-release path is added. Recoverable failures continue through the existing autonomous provider/circuit/backoff paths, and persistent task-side failures remain machine-owned.

## Validation

The existing phase-scoped Pi regression test now locks `GENERAL_ACTION` to `low` while retaining the stronger reasoning floors for implementation, security review, and independent review. The complete Factory validation remains authoritative on the published pull-request head.
