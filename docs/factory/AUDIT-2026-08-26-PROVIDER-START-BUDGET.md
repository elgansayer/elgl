# Factory provider-start allowance audit — 2026-08-26

## Finding

The conservative Factory has a durable hourly agent-route allowance, but the admission was recorded before the provider-neutral router had established that a provider process would actually start.

That created two forms of allowance distortion:

1. a logical route could consume one of the six hourly admissions even when every eligible provider was busy or unavailable and no subscription-backed agent process started;
2. a logical route that fell back from one provider to another consumed only one admission even though it could start two distinct provider processes.

The first case unnecessarily starves useful work. The second case understates the real subscription pressure from fallback churn. Both make the same configured allowance less useful as a control for actual agent consumption.

## Change

`ConservativeAgentRouter` keeps the existing early capacity/fairness checks, but moves the durable admission to the `prepare_attempt` boundary used by the provider-neutral router. That boundary runs after a provider capacity lease is acquired and immediately before `provider.run()`.

The existing environment names are intentionally retained for deployment compatibility:

- `FACTORY_AGENT_ROUTES_PER_INTERVAL`
- `FACTORY_AGENT_ROUTE_INTERVAL_SECONDS`
- `FACTORY_AGENT_ROUTES_PER_TASK_PER_INTERVAL`

Their conservative meaning is now stricter: active admissions represent real provider starts rather than logical scheduler routes.

A distinct fallback provider therefore consumes another admission. A busy/unavailable provider that never starts consumes none. A failed `prepare_attempt` also consumes none.

## Quality and safety invariants

This does not remove or weaken any Factory stage. Implementation, security review, local verification, quality repair, independent review, reviewed-SHA protection, `factory/independent-review`, `CI / required`, and GitHub merge rules remain unchanged.

When the provider-start allowance is exhausted, the existing `ProviderCapacityUnavailable` path defers the job without consuming a task failure or quarantining it. Work resumes after the durable admission window has capacity again.

The candidate cap and independent-review provider-diversity behavior are unchanged.

## Regression coverage

Tests cover:

- the existing global hourly allowance;
- the existing per-task fairness cap;
- a failed first provider consuming the last available admission and deferring a fallback before it starts;
- a provider-capacity-only routing attempt consuming no admission;
- a failed pre-provider `prepare_attempt` consuming no admission.

The expected efficiency outcome is a closer match between configured allowance and real subscription-backed process starts: less false starvation when nothing ran, and no hidden fallback starts outside the budget.
