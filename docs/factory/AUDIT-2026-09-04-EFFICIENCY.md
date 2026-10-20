# Factory efficiency audit: 2026-09-04

## Scope

This pass rechecked current `main` rather than carrying forward older Factory assumptions. The audit covered the active `automation/openhands_factory/` daemon and pipeline, prompt construction, provider routing, production instance configuration, retries and circuits, issue admission, PR review/merge flow, deterministic verification, prompt-size observability, recovery, and Factory-related GitHub Actions.

The active production controls remain intentionally conservative: one newly discovered issue per hour, three Factory workers, review-first scheduling, bounded provider concurrency, zero immediate same-provider retries, first-failure provider circuits, subscription-backed routing, disabled PAYG OpenHands, bounded prompt/evidence bodies, mechanical repair before AI CI repair, independent exact-head review, `factory/independent-review`, `CI / required`, and exact-head merge protection.

Prompt-volume observability from the 2026-09-03 audit is already present on current `main`, so this pass did not recreate it. Provider metrics already record content-free request character counts by provider/model/phase.

## Finding: the provider was instructed to duplicate the Factory's full verification gate

The active system prompt told every provider to run both focused tests and the supplied full verification gate before returning. Implementation prompts also embedded the complete deterministic verification list under a normal `Required verification` heading, while later phase prompts told the provider to run applicable verification before finishing.

That conflicts with the orchestration boundary in `FactoryPipeline`:

- implementation and security-review work flows into `VERIFYING`, where the Factory runs repository-native deterministic verification;
- quality repair returns to `VERIFYING`;
- CI repair is followed immediately by `_verify()` before the repair is committed and pushed; and
- any independent-review mutation is followed by `_verify()` and then a fresh independent review.

The provider-mediated full-suite run therefore did not add a merge safety guarantee. It duplicated the same build/test gate inside an expensive model session, feeding long command output back into model context and increasing the chance that transient or unrelated verification noise consumed additional reasoning and repair turns.

## Finding: nested model delegation could bypass Factory allowance accounting

The Factory rate limits provider starts and records provider/model/phase metrics, but the shared system prompt did not forbid a provider CLI from spawning subagents, agent teams, delegated model sessions, nested LLM calls, or model-launching skills.

That creates a budget escape hatch: one Factory provider start can fan out into additional model work that is invisible to the Factory's provider-start budget. Repository skills also include delegation-oriented guidance, so relying on providers to infer the desired single-session boundary was not sufficient.

## Change

The trusted Factory system contract now makes two ownership rules explicit:

1. **Single provider session per Factory attempt.** Providers must not spawn subagents, agent teams, delegated model sessions, nested LLM calls, or model-launching skills. Repository/shell tools remain available normally.
2. **Full verification belongs to the Factory.** Providers run focused checks needed to validate their edits. They may reproduce a specific failing gate when that is necessary for diagnosis, but they are no longer instructed to execute the whole supplied gate before returning.

The implementation prompt still includes the complete verification list as stable, cacheable acceptance context, but labels it `Factory-owned full verification` and explicitly says not to execute the entire list in-session. Review and repair phase closings use the same ownership boundary. If an independent reviewer makes a blocking repair, the orchestrator still performs full verification and requires a fresh independent review.

## Expected efficiency impact

The change does not reduce the number or strength of deterministic merge gates and does not increase production concurrency. It removes an explicit instruction to perform up to one redundant full verification suite inside each model-backed phase. A normal issue can pass through implementation, security review and independent review, with additional quality/CI repair phases only when needed; the full suite should now run under deterministic Factory ownership rather than being redundantly replayed under each provider session.

The exact token saving depends on provider behaviour and repository command output, so no fabricated token estimate is claimed. The direction is measurable with the existing prompt/call metrics and operational duration data: provider sessions should spend less time ingesting build/test output, while Factory-owned verification count and merge requirements remain unchanged.

Preventing nested model delegation also closes an unbounded multiplier: one accounted provider start now has an explicit one-session contract instead of being allowed to create unaccounted model fan-out.

There is a small one-time prompt-cache invalidation and a few hundred characters of additional stable policy text. That fixed cost is intentionally traded for avoiding potentially thousands of lines of duplicate verification output or whole nested model sessions.

## Safety and compatibility

No state migration is required. Provider routing order, models, reasoning effort, provider timeouts, circuit breakers, issue admission, worktree isolation, deterministic verification commands, security review, quality gates, independent review, reviewed-SHA provenance, GitHub checks, mergeability checks, and exact-head merge logic are unchanged.

The exception for reproducing a specific failing gate preserves autonomous diagnosis when CI evidence cannot be understood from the failure name alone. Full verification remains mandatory after every code-mutating path through the existing orchestrator.

## Related open work

Open documentation-cleanup PRs #8769 and #8791 were reviewed before this change. They target obsolete architecture prose and repository skills rather than the active provider-session/full-verification ownership leak, so this PR does not duplicate their edits. They are also based on older Factory states and should not be treated as evidence for current runtime behaviour without reconciliation to current `main`.
