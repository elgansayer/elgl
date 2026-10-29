# Factory allowance audit: provider output volume

Date: 2026-09-07

## Scope

This pass re-audited the current OpenHands Factory after the CI-repair routing change in #8832. It reviewed the active provider configuration, routing and retry policy, provider process capture, allowance metrics, scheduled GitHub Actions backstops, review/merge automation, and current repository rulesets. The goal remains sustainable engineering throughput rather than simply reducing provider starts.

## Current controls that should remain

Production already has strong allowance controls and this audit does not weaken them:

- one new issue admission per hour, separate from cheap control-plane reconciliation;
- bounded agent and independent-review concurrency;
- at most two provider candidates per phase selection window;
- zero immediate same-provider retries in production;
- first-failure provider circuits with bounded cooldowns;
- phase-specific cheaper models for bounded repair/review work;
- PAYG OpenHands disabled and emergency-only;
- bounded task, phase-evidence, prompt, timeout, and provider-output capture sizes;
- mechanical CI repair before model-backed repair;
- deterministic verification, independent review, reviewed-head protection, current-main gating, and exact-head merge safety.

#8832 also makes CI repair cheap-first without hiding the flagship fallback: OpenCode and Google Flash are the initial repair window, while Codex is promoted once both cheap starts have been consumed. This avoids spending flagship allowance on easy CI failures without allowing hard repairs to burn the whole per-task hourly start budget before Codex becomes eligible.

## Finding: output pressure was measurable at the process boundary but lost from Factory metrics

The provider process runner already bounds captured stdout/stderr and records whether the bound was exceeded. `CLIProvider` previously reduced that data to a redacted 4,000-character summary and `AgentResult` discarded both output size and the truncation signal. The router therefore persisted prompt characters, calls, failures, fallbacks, rate limits, quota/auth failures, duration, capacity wait, and known API cost, but had no content-free way to answer:

- which provider/model/phase regularly emits the most retained output;
- whether configured output bounds are actually reached;
- whether a proposed tighter output bound would affect rare outliers or routine successful attempts;
- whether verbose output correlates with fallback or repair churn.

Without that evidence, lowering provider output limits is unsafe: truncating a useful agent response can create validation failure and a second provider start, consuming more allowance than the original response.

## Implemented measurement

Direct subscription-CLI attempts now carry two content-free fields through the provider result, bounded job history, and aggregate metrics:

- `captured_output_chars`: retained decoded stdout + stderr character count;
- `output_truncated`: whether the process capture ceiling was exceeded.

Aggregate usage adds measured-call, total retained characters, maximum retained characters, and truncation-count fields per provider/model/phase. Existing metrics files restore with zero values for the new fields, so the change is backward compatible and requires no state migration.

The metric intentionally does **not** store model output text and does **not** estimate tokens. Character counts are a stable cross-provider proxy; tokenization differs by provider/model. When `output_truncated` is true, the retained character count is a lower bound rather than the total generated output. That distinction is preserved in both aggregate and bounded per-job history.

## Expected efficiency effect

This instrumentation does not claim an immediate token percentage reduction. It removes an observability blind spot that previously forced output-limit decisions to be speculative. After enough normal Factory attempts, the output/truncation distribution can support evidence-based follow-ups such as phase-specific output ceilings or tighter instructions only where they reduce allowance without increasing retries.

The runtime overhead is negligible: integer/boolean accounting is added to the same locked metrics write already performed once per direct provider attempt. No extra provider call, GitHub request, process, workflow, or model context is introduced.

## GitHub Actions review

The current scheduled workflows are already materially reduced and event-driven paths remain primary: the Factory merge workflow is an hourly downtime backstop, dependency compatibility runs once daily, branch/PR hygiene runs daily, and self-healing uses a six-hour scheduled backstop plus immediate event-driven recovery. No further polling reduction was justified in this pass because it would trade negligible model allowance for slower recovery.

## Remaining repository-level allowance waste

An active repository ruleset still requests GitHub Copilot code review on default-branch pull requests, including drafts. Recent Factory PR activity shows repeated Copilot review attempts failing because the review quota is exhausted. That review path is not the Factory's authoritative `factory/independent-review` gate, so it creates avoidable review-quota churn when enabled alongside Factory review automation.

The available Factory/GitHub connector can inspect rulesets but does not expose a ruleset-write action, so this audit does not pretend to disable it in code. The safe repository-administration follow-up is to disable that automatic Copilot review ruleset or scope it away from Factory-owned PRs while leaving `factory/independent-review` unchanged.

## Validation target

The change is covered by focused tests for:

- CLI propagation of retained output characters and truncation;
- router propagation into aggregate metrics and bounded provider history;
- multi-call aggregation and maximum/truncation counters;
- legacy metrics restoration without the new fields;
- the existing rule that character counts remain measurement only and are not presented as invented token estimates.

GitHub Actions remains authoritative for Ruff formatting, Ruff lint, mypy, the complete Factory pytest suite, repository governance, and canonical `CI / required` on the exact published head.
