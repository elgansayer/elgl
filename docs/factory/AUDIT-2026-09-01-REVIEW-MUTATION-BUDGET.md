# Factory efficiency audit: bounded independent-review mutations

## Scope

This follow-up audits the independent-review convergence loop after the current allowance, provider-health, prompt-size, CI-fanout, and retry controls landed on `main`. The goal is to preserve a strict independent completion review while preventing the review route itself from creating optional code churn that invalidates its own reviewed head and consumes another review/verification cycle.

The Factory remains fully autonomous. This change does not introduce quarantine, manual triage, human release, or a stopped state.

## Finding

The independent-review instructions require a structured completion verdict, but the shared phase closing previously told every non-architect phase:

> If defects are found, correct them and update tests.

That wording made no distinction between a merge-blocking defect and an optional cleanup, style edit, refactor, speculative improvement, or unrelated optimization.

The pipeline deliberately treats any tracked-file mutation during independent review as a new implementation head. It verifies and commits the change, invalidates the previous exact-head review, and returns to `REVIEWING`. That fail-closed behavior is correct for safety, but it means an optional reviewer edit can spend:

1. the current independent-review provider start;
2. local verification and a new commit/push;
3. another exact-head independent-review admission/provider start; and
4. another GitHub CI cycle for a change that was not required for merge correctness.

Under the production review budget, unnecessary reviewer mutations therefore consume scarce review capacity and delay unrelated pull requests even when the original head already satisfied the issue.

## Implemented change

Independent review now has a phase-specific mutation budget:

- a reviewer may change tracked files only to correct a **blocking acceptance, correctness, security, or verification defect**;
- non-blocking cleanup, style edits, refactors, speculative improvements, and unrelated optimizations are explicitly prohibited during review;
- when no blocking defect exists, tracked files must remain unchanged;
- a genuine blocking repair is still allowed in the same review provider call, avoiding an extra repair-provider start when the reviewer can safely fix the defect;
- every blocking repair still invalidates the old reviewed head and must pass deterministic verification plus a fresh independent review.

This keeps the existing fast path for real blockers while removing optional mutation as a source of review/CI churn.

## Why this does not lower quality

The acceptance bar is unchanged. Reviewers must still inspect the complete diff, production wiring, tests, persistence, realtime behavior, routes/providers, and every explicit acceptance criterion. UI-only, mocked, simulated, placeholder, incomplete, and unregistered implementations remain blocking.

The change only narrows what the reviewer is allowed to *edit*. It does not narrow what the reviewer must inspect or what counts as blocking. A blocking defect may still be repaired immediately; an unresolved blocking defect still prevents approval. The resulting head still requires verification, `factory/independent-review`, `CI / required`, clean mergeability, and reviewed-SHA equality before merge.

## Efficiency effect

The deterministic saving is per avoided non-blocking reviewer mutation: one extra exact-head review loop, its verification/commit/push work, and the resulting GitHub CI rerun are no longer created by the Factory itself.

No token percentage is claimed because subscription CLIs do not expose a portable allowance meter, and the number of optional edits depends on reviewer behavior. The policy removes the mechanism that previously authorized those optional edits.

## Autonomy and recovery

No human decision point is added. Genuine blockers continue through the existing machine-owned repair/review state machine. Persistent failures retain autonomous retry/backoff and provider failover. No quarantine or manual-triage state is introduced or required.

## Regression coverage

`automation/tests/test_prompts.py` now asserts that independent review:

- permits changes only for blocking defects;
- explicitly rejects non-blocking cleanup churn;
- requires an unchanged tracked worktree when no blocking defect exists; and
- no longer inherits the generic instruction to correct every defect it notices.
