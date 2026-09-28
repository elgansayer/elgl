# Factory efficiency audit: Claude stall-diagnostic model

Date: 2026-09-11

## Scope

This pass re-audited current `main` after the existing Factory efficiency work covering provider-start budgets, phase-aware reasoning, prompt/output bounds, cheap-first CI repair, head-stability gating, provider circuits, source-scoped discovery, deterministic verification ownership, and autonomous retry/recovery.

The audit specifically rechecked production routing/model selection, retries and failover, prompt/context policy, review/repair loops, scheduling, GitHub Actions, duplicate-work controls, and stalled-task recovery. Open work already owns longer provider cooldowns, progressive quota backoff, external-PR settling, and cheap-first quality repair, so this change deliberately does not duplicate those branches.

## Finding

The production Claude profile still selected `fable` for `general_action` while every other bounded Claude repair/review phase already selected `haiku`.

`GENERAL_ACTION` is not an implementation, security-review, or independent-review phase. In the current Factory it is the bounded best-effort stall diagnostic path. It receives deterministic diagnostic evidence, has a five-minute production timeout, does not replace deterministic recovery, and sits behind cheaper providers in the general-action route.

That made Fable an unnecessarily expensive fallback for routine control-plane diagnosis. Fable remains appropriate for genuinely hard long-horizon work, but the Factory does not need frontier long-horizon capability merely to interpret a bounded stall snapshot and suggest the next autonomous recovery action.

## Change

The production Claude `general_action` phase model changes from `fable` to `haiku`.

Nothing else in the route changes:

- OpenCode and Google remain ahead of Claude in the general-action route;
- the bounded provider-start and candidate limits remain unchanged;
- the five-minute diagnostic timeout remains unchanged;
- same-provider retries remain disabled in production;
- provider failure still falls through the existing autonomous failover/circuit paths;
- planning and architecture remain on Opus;
- implementation and security review remain on Sonnet;
- independent review and repair retain their existing model policy.

The deployed Factory consumes `config/factory/agents.production.json` through the existing autonomous updater, so the production profile is the correct control point for this allowance reduction.

## Quality and autonomy floor

This change does not alter deterministic verification, security review, independent exact-head review, reviewed-SHA protection, `factory/independent-review`, `CI / required`, mergeability checks, or exact-head merge protection.

No quarantine, manual-triage, or human-release state is introduced. A diagnostic provider failure remains machine-owned: the router can use another eligible provider under the existing bounded failover policy, while deterministic stalled-task recovery continues independently of model advice.

## Regression coverage

`automation/tests/test_factory_efficiency_2026_09_11.py` loads the actual production agent profile and locks the Claude diagnostic model to Haiku while also asserting that the stronger planning, architecture, implementation, and security-review model tiers remain unchanged. It additionally locks the existing five-minute diagnostic ceiling, zero same-provider retries, and the current autonomous general-action fallback route.

GitHub Actions remains authoritative for Ruff formatting, Ruff lint, mypy, the complete Factory pytest suite, governance checks, and canonical `CI / required` on the exact published head.
