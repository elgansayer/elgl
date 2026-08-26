# Factory conservative resource policy

The production Factory deliberately limits admission of expensive AI work so a large issue/PR backlog cannot consume subscription quotas in a burst.

## Production limits

| Work | Limit | Enforcement |
| --- | ---: | --- |
| Newly discovered GitHub issues | 1 per hour | Restart-safe `issue-admissions.json` scheduler gate |
| AI-backed Factory phase starts | 6 per hour | Restart-safe `agent-route-admissions.json` router gate |
| Fresh independent PR review SHAs | 2 per hour | Restart-safe `review-admissions.json` agent gate |
| Concurrent independent review agents | 1 | In-process bounded semaphore on the shared router |
| Concurrent agent executions overall | 2 | In-process bounded semaphore on the shared router |
| Provider candidates per phase | 2 | Preferred provider plus at most one fallback |
| Same-provider transient retry | 0 under conservative policy | Defer/re-route instead of immediately spending twice on one provider |

The existing production environment controls issue intake and the independent AI-route budget:

```text
FACTORY_NEW_ISSUE_INTERVAL_SECONDS=3600
FACTORY_NEW_ISSUES_PER_INTERVAL=1
FACTORY_AGENT_ROUTE_INTERVAL_SECONDS=3600
FACTORY_AGENT_ROUTES_PER_INTERVAL=6
```

Issue intake and agent-route admission are intentionally separate. One admitted issue can require implementation, security review, independent code review and a bounded repair. Limiting only new issues therefore does not bound subscription consumption.

Six route starts/hour leaves enough budget for a healthy issue path plus the two-review lane while retaining recovery capacity. Each route can use the preferred provider and at most one distinct fallback. The conservative policy disables immediate same-provider retries, so a single provider-side transient failure cannot double-spend the same subscription before fallback. The next durable scheduler transition may revisit a provider after health/circuit state changes.

## Prompt-size budget

The Factory also bounds provider input before invocation:

| Input | Character cap |
| --- | ---: |
| Shared implementation context | 48,000 |
| GitHub task/PR body | 24,000 |
| Phase-specific failure/review evidence | 8,000 |

These are deterministic character limits, not claimed token counts. Subscription CLIs do not expose one portable tokenizer or exact remaining-quota API. Oversized untrusted text keeps its beginning and end with an explicit omission marker, which preserves the issue summary and trailing acceptance/verification details without forwarding unlimited release notes, logs or generated prose to every provider.

`README.md` remains excluded from unconditional implementation context. `AGENTS.md` and `TODO.md` are included only inside the shared context budget, while task-specific source inspection remains the agent's responsibility inside the worktree.

## What counts as an AI-backed route

The global route budget is consumed immediately before entering the provider-neutral router for phases such as:

- architecture/planning
- implementation
- security review
- quality repair
- independent code review
- CI repair
- general AI-backed action

Cheap deterministic work does not consume an AI-route admission, including:

- GitHub status polling
- mergeability checks
- merge-queue progression
- provider health probes
- worktree bookkeeping
- deterministic verification/quality checks
- mechanical CI formatting/auto-fix attempts

Admission is persisted before provider execution. A daemon crash therefore does not reset the hourly allowance and immediately replay the expensive boundary.

## What counts as a PR review

The hourly review budget is consumed only when the Factory enters the AI-backed `CODE_REVIEW` phase. It is a narrower limit layered on top of the global route budget.

A review admission key includes both PR number and head SHA. The same SHA cannot be admitted repeatedly inside the one-hour window. A changed head SHA is a new review candidate, subject to the remaining hourly and global route budgets.

## Provider fallback budget

The provider-neutral router still filters disabled, unhealthy, rate-limited, quota-exhausted, unsupported, or unavailable providers before selection. The conservative wrapper then keeps only two eligible candidates for a phase.

That means a provider-side failure can use one fallback, but a single difficult task cannot cascade across every authenticated subscription in one Factory transition. Immediate same-provider retry is disabled by the conservative wrapper even when the underlying general routing configuration allows one.

For code and security review, providers that previously mutated the job are moved behind independent providers before the two-candidate cap is applied. This preserves cross-provider review where possible.

## Concurrency

The daemon may retain multiple workers because many state transitions are cheap control-plane operations. Expensive agent execution is independently capped at two concurrent routes across implementation, planning, security, repair, review, and the architect cycle.

Independent code review has a stricter one-agent concurrency cap. This prevents two review workers from spending both hourly review admissions simultaneously while leaving room for an implementation or repair agent.

The semaphores live on the shared router instance used by daemon workers and the architect executor. The host-level Factory lock already prevents a second daemon from owning the same repository concurrently.

## Failure behaviour

Resource exhaustion is reported as `ProviderCapacityUnavailable`, not as a task failure. Existing pipeline behaviour therefore defers the job with `next_attempt_at` instead of incrementing task-failure attempts or quarantining the issue.

Admission gates intentionally behave conservatively. Once an AI route or review SHA has been admitted, a provider crash or daemon restart does not refund that slot. This favors predictable quota use over aggressive retry throughput.

When a gate is exhausted, the router now calculates the next persisted admission expiry rather than hot-looping every minute where that timestamp is available.

## Why the limits are outside the GitHub queue size

Limiting only `FACTORY_MAX_PARALLEL_JOBS` is insufficient. One worker can trigger provider retries/fallbacks, while other workers may only be polling CI or merging already-reviewed PRs. The resource policy limits the actual AI-backed boundary instead of unnecessarily slowing cheap deterministic state transitions.

Likewise, `1 issue/hour` alone is not a token or allowance budget because one issue can fan out into several AI phases. The route gate is the Factory's enforceable subscription-consumption control.

## Operator visibility

Durable admission state is stored under the Factory state directory:

```text
issue-admissions.json
agent-route-admissions.json
review-admissions.json
```

None of these files contains provider credentials, prompts, model transcripts, or GitHub tokens. They contain only admission identifiers and timestamps.
