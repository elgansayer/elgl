# Factory conservative resource policy

The production Factory deliberately limits admission of expensive AI work so a large issue/PR backlog cannot consume subscription quotas in a burst.

## Production limits

| Work | Limit | Enforcement |
| --- | ---: | --- |
| Newly discovered GitHub issues | 1 per hour | Restart-safe `issue-admissions.json` scheduler gate |
| Fresh independent PR review SHAs | 2 per hour | Restart-safe `review-admissions.json` agent gate |
| Concurrent independent review agents | 1 | In-process bounded semaphore on the shared router |
| Concurrent agent executions overall | 2 | In-process bounded semaphore on the shared router |
| Provider candidates per phase | 2 | Preferred provider plus at most one fallback |
| Same-provider transient retry | Existing routing policy, currently 1 | Base `AgentRouter` bounded retry policy |

The existing production environment already sets:

```text
FACTORY_NEW_ISSUE_INTERVAL_SECONDS=3600
FACTORY_NEW_ISSUES_PER_INTERVAL=1
```

Those values continue to control issue intake. The conservative agent router adds the PR-review, global concurrency, and provider-cascade limits independently of the daemon worker count.

## What counts as a PR review

The hourly review budget is consumed only when the Factory enters the AI-backed `CODE_REVIEW` phase. Cheap deterministic work does not consume the review budget, including:

- GitHub status polling
- mergeability checks
- merge-queue progression
- provider health probes
- worktree bookkeeping
- deterministic quality checks
- mechanical CI formatting/auto-fix attempts

A review admission key includes both PR number and head SHA. The same SHA cannot be admitted repeatedly inside the one-hour window. A changed head SHA is a new review candidate, subject to the remaining hourly budget.

The admission is persisted before the provider call. If the daemon crashes, restarting it does not reset the hourly allowance and immediately spend another review.

## Provider fallback budget

The provider-neutral router still filters disabled, unhealthy, rate-limited, quota-exhausted, unsupported, or unavailable providers before selection. The conservative wrapper then keeps only two eligible candidates for a phase.

That means a provider-side failure can use one fallback, but a single difficult task cannot cascade across every authenticated subscription in one Factory transition.

For code and security review, providers that previously mutated the job are moved behind independent providers before the two-candidate cap is applied. This preserves cross-provider review where possible.

## Concurrency

The daemon may retain multiple workers because many state transitions are cheap control-plane operations. Expensive agent execution is independently capped at two concurrent calls across implementation, planning, security, repair, review, and the architect cycle.

Independent code review has a stricter one-agent concurrency cap. This prevents two review workers from spending both hourly review admissions simultaneously while leaving room for an implementation or repair agent.

The semaphores live on the shared router instance used by daemon workers and the architect executor. The host-level Factory lock already prevents a second daemon from owning the same repository concurrently.

## Failure behaviour

Resource exhaustion is reported as `ProviderCapacityUnavailable`, not as a task failure. Existing pipeline behaviour therefore defers the job with `next_attempt_at` instead of incrementing task-failure attempts or quarantining the issue.

The review admission gate intentionally behaves conservatively. Once a review SHA has been admitted, a provider crash or daemon restart does not refund that slot. This favors predictable quota use over aggressive retry throughput.

## Why the limits are outside the GitHub queue size

Limiting only `FACTORY_MAX_PARALLEL_JOBS` is insufficient. One worker can trigger provider retries/fallbacks, while other workers may only be polling CI or merging already-reviewed PRs. The resource policy limits the actual AI-backed boundary instead of unnecessarily slowing cheap deterministic state transitions.

## Operator visibility

Durable admission state is stored under the Factory state directory:

```text
issue-admissions.json
review-admissions.json
```

Neither file contains provider credentials, prompts, model transcripts, or GitHub tokens. They contain only task/review admission identifiers and timestamps.
