# Factory recovery and deployment throughput

## Evidence

On 16 October 2026 the Google authenticated catalogue probe succeeded, while
the shared circuit remained half-open with eleven historical transport failures.
Candidate enumeration leased recovery for every due provider, even when the
policy selected Claude. This repeatedly postponed Google without a generation.

Three isolated production-provider canaries wrote the exact requested JSON and
exited successfully in 13.3, 8.4 and 8.1 seconds. The final validated generation
closed Google's circuit under the shared health-store lock without removing
other providers' state. These canaries prove current generation capability, not
that a long repository review can never hang or exhaust allowance.

The durable queue contained eighteen font-inlining failures and twenty-six
design-sync failures. This is historical queue evidence, not eighteen simultaneous
network failures or twenty-six confirmed infrastructure problems. Design previews
remain required; their failures must be repaired rather than waved through.

## Changes

- Enumerating candidates is observational for recovery leases. Only the selected
  provider leases its half-open attempt, after reserving actual provider capacity.
  The atomic shared-store permit continues excluding concurrent recovery probes.
- Factory-requested process cancellations have their own failure classification.
  They do not add provider failures or reduce provider performance metrics. Genuine
  timeouts and unproven external process crashes retain their existing treatment.
- CI repair refreshes a stale local base even when the PR head is unchanged and
  GitHub reports BLOCKED, UNKNOWN or UNSTABLE rather than BEHIND. Clean base merges
  need no model call. Conflicts still require resolution and verification.
- Deterministic verification failures during CI repair enter bounded quality repair
  with the actual evidence. Infrastructure failures still back off without asking
  a model to edit application code to work around a host failure.
- Updates compare deployed immutable runtime inputs, not merely checkout HEAD.
  Application-only updates drain active work before fast-forwarding the checkout,
  but preserve both service processes, the Python environment and worker image.
  Factory code, configuration and scripts retain the full deployment path.
- A separate deployed-runtime marker is recorded only after a successful restart.
  Maintenance can refresh trusted scripts without pretending to have installed the
  Python package. Missing markers or Git comparison failures force a full deploy.
- PR metrics report rolling 1h, 6h and 24h merges, rates and component counts, plus
  repair-model calls per merged PR and the existing green-to-merge wait. Unknown
  components are not reported as application throughput. These are bounded retained
  inventory observations, not a complete historical GitHub analytics database.
- Provider metrics expose successful outputs per total model-minute by phase and
  model. Failed attempts remain in that denominator; known cancellations do not.

## Safeguards and limits

Exact-head CI and independent review remain required. No administrator merge
bypass, fabricated preview approval, broad retry reset or credential change is
part of this work. Existing adaptive routing continues using current phase-model
evidence. More models and higher concurrency are not automatically more throughput
on this memory-constrained shared host.

Paused scheduling still needs bounded draining during app-only checkout updates.
Further reduction should be based on measured wait time, not removal of the gate.
