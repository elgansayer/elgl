# Factory quarantine recovery

The Factory quarantines a job after the configured number of repeated identical task-side failures. Quarantine is a safety circuit, not a provider failover mechanism: provider availability, authentication, quota, rate-limit, and capacity failures use the provider routing and retry controls instead.

## Recovery policy

`FACTORY_QUARANTINE_RECOVERY_MINUTES` is the first autonomous recovery window. If the recovered job hits the same stable failure again, its next quiet window doubles while the existing failure evidence remains intact.

With the production defaults of three repeated failures and a 30-minute base window, continued identical failures become eligible again after approximately:

| Repeated identical failure count | Quiet window |
| ---: | ---: |
| 3 | 30 minutes |
| 4 | 1 hour |
| 5 | 2 hours |
| 6 | 4 hours |
| 7 | 8 hours |
| 8 | 16 hours |
| 9+ | 24 hours |

The 24-hour maximum is the same durable retry-policy cap used elsewhere in the Factory. A task can therefore recover autonomously without being allowed to consume a subscription-backed agent route every 30 minutes indefinitely.

For comparison, a permanently unchanged task under the old fixed 30-minute policy could become eligible 48 times in one day. The adaptive schedule makes it eligible at most five times in the first 24 hours after the initial quarantine, before settling at the 24-hour cap. Actual executions can be fewer because normal queue, capacity, and provider controls still apply.

## Evidence preservation

Autonomous recovery does not reset:

- attempt counters;
- failure-class counters;
- the stable failure fingerprint;
- provider history;
- the last error;
- verification, review, or pull-request metadata.

If the underlying problem changes and the job makes meaningful progress, the existing retry policy clears stale failure diagnostics as before. An explicit operator requeue remains the deliberate path for resetting a quarantined task's retry evidence.

Legacy quarantine records that predate persisted quarantine timestamps remain immediately recoverable so old state cannot wedge the queue.

## Quality and merge safety

Adaptive recovery changes only when a repeatedly failing job becomes eligible to run again. It does not skip or weaken implementation, security review, local verification, quality repair, independent review, reviewed-SHA validation, `factory/independent-review`, `CI / required`, mergeability checks, or repository branch protection.
