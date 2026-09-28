# Factory general-action efficiency audit

Date: 2026-09-04

## Scope

This pass rechecked Factory provider routing, phase-specific model/reasoning selection,
retry/failover policy, duplicate-work ownership, prompt/context controls, verification and
independent-review loops, GitHub Actions classification, concurrency/admission controls,
and stalled-task recovery. The hard constraints remain unchanged: autonomous recovery,
no human decision in the execution path, and no weakening of verification, security
review, independent review, reviewed-SHA protection, or required merge checks.

## Finding

`GENERAL_ACTION` is not part of implementation, security review, independent review, CI
repair, or merge qualification. In the current production Factory its internal use is
best-effort stall diagnosis over deterministic diagnostics that have already been gathered
and surfaced independently of the model. Routing policy also restricts this
`factory-internal` work to one eligible regular provider, so a failed diagnosis does not
cascade through subscriptions.

Claude and Codex nevertheless assigned `GENERAL_ACTION` medium reasoning effort. That is
higher than needed for a bounded, non-merge-gating diagnostic and can spend additional
subscription thinking allowance whenever the cheaper providers are unavailable and the
route reaches one of those fallbacks.

## Change

- Claude `GENERAL_ACTION`: `medium` -> `low` effort.
- Codex `GENERAL_ACTION`: `medium` -> `low` reasoning effort.
- Codex independent review remains `medium`.
- Codex security review remains `high`.
- Claude security review remains `medium`.
- Planning, architecture, and implementation keep their existing maximum reasoning
  floors.

The provider order, failover availability, concurrency, timeouts, and autonomous recovery
behavior are unchanged. This therefore reduces thinking allowance only when a
best-effort diagnostic actually reaches Claude or Codex; it does not remove a recovery
path or lower any merge-gating engineering phase.

## Verification

Regression tests pin the new low-effort general-action behavior and explicitly pin the
unchanged security/build or independent-review reasoning floors. Normal Factory CI remains
the authoritative validation for the exact pull-request head.

No token percentage is claimed because subscription providers do not expose a portable
per-effort token multiplier. The deterministic saving is that every affected Claude or
Codex `GENERAL_ACTION` start requests `low` rather than `medium` reasoning while retaining
the same model, prompt, provider fallback, and timeout.
