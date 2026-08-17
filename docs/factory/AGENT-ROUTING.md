# Agent routing policy

## Contract

Every AI-backed action is an `AgentRequest` with a typed `AgentPhase`, trusted Factory system instructions,
shared logical prompt, isolated working directory, timeout, output limit, and optional structured-output validator.
In production, every request crosses the OpenHands SDK conversation boundary. The outer compatibility router does
not select direct Claude, Codex, Google, or OpenCode CLI providers for production work.

`ConversationRunner` owns production inner-provider selection and returns bounded provider attribution and typed
failure evidence to Factory. Adding or changing an inner provider must not create another scheduler, retry owner,
reviewer daemon, or merge authority.

## Production outer route

The production policy reviewed on 2026-08-17 is deliberately simple:

| Phase | Outer execution boundary |
| --- | --- |
| Planning | OpenHands SDK |
| Architecture | OpenHands SDK |
| Implementation | OpenHands SDK |
| Security review | OpenHands SDK |
| Quality repair | OpenHands SDK |
| Code review | OpenHands SDK |
| CI repair | OpenHands SDK |
| General action | OpenHands SDK |

`config/factory/agents.production.json` disables the direct `claude`, `codex`, `google`, and `opencode` outer
providers. Every phase route is exactly `["openhands"]`. Those adapters may remain temporarily for migration,
diagnostics, and code removal work, but production eligibility is fail-closed at configuration and architecture
checks.

The compatibility `emergency_only` metadata may remain on `openhands` until the outer router is removed. Because
there are no other providers in any production route, it cannot change production ordering.

## Inner provider order

Inside the OpenHands conversation boundary, the production provider order is:

1. OpenAI subscription-backed Codex OAuth.
2. OpenCode Go subscription fallback.

Google/Gemini is disabled for new production selection. There is no third production inner provider. Provider
selection and attribution are implemented in `conversation_runner.py`; the outer phase-routing table must not
recreate this order.

Model aliases remain configuration and must be reviewed when provider catalogues change. An unavailable model is a
typed provider/configuration failure, not permission to silently substitute a different model during a job.

## Selection algorithm

For each production phase, Factory:

1. creates the typed request and leases the task/worktree;
2. routes the request to the sole production outer adapter, `OpenHandsProvider`;
3. starts a bounded OpenHands SDK conversation in its own process group;
4. asks `ConversationRunner` to select an eligible inner provider;
5. prefers OpenAI subscription/Codex OAuth when healthy and available;
6. falls back to OpenCode Go only for typed provider-side failures or unavailability permitted by policy;
7. validates any authoritative structured output before accepting success;
8. records inner-provider attribution, health, metrics, and fallback reason;
9. releases capacity and process resources in a `finally` path.

The candidate list is finite and every attempt is bounded. There is no infinite provider rotation loop.

## Failure semantics

| Failure | Inner-provider fallback | Task-attempt impact |
| --- | --- | --- |
| Provider unavailable | yes | none |
| Authentication required | yes | none |
| Rate limit | yes | none |
| Quota exhausted | yes | none |
| Timeout | bounded by provider policy | none while provider-side |
| Transport error | bounded by provider policy | none while provider-side |
| Agent crash | bounded by provider policy | none while provider-side |
| Invalid structured output | bounded retry/fallback | none while provider-side |
| Task failure | no blind provider rotation | Factory task retry/repair |
| Test failure | no blind provider rotation | verification/repair flow |
| Repository failure | no blind provider rotation | repository recovery flow |
| Policy failure | no | fail closed |
| Internal Factory failure | no | operator-visible Factory failure |

Provider errors are classified from the bounded OpenHands conversation result and inner-provider attribution.
Unexpected Factory validation failures remain Factory failures and do not become provider fallback reasons.

When every eligible inner provider is unavailable for a provider-side reason, Factory preserves the current phase,
schedules the earliest bounded retry, and does not increment the task-attempt counter. Task, test, repository,
policy, and internal failures return to the durable Factory retry or repair path.

Repeated identical task-side failures may open the durable recoverable task circuit after the configured
consecutive-failure threshold. Recovery remains bounded and explicit; the retired permanent-quarantine/swarm
model must not return.

## Provider health and capacity

Inner-provider health, cooldown, and attribution are durable Factory-owned state. Authentication, quota, rate
limit, availability, timeout, transport, crash, and malformed-output signals are persisted with bounded retry
hints. A successful eligible attempt resets the relevant provider failure state.

Exact subscription quota is never fabricated. Health uses the provider capabilities actually exposed to the
service account plus observed bounded failure evidence. Corrupt timestamps, future leases, and impossible durations
must not suppress a provider indefinitely.

The OpenHands outer adapter has bounded concurrency. Inner-provider capacity is also generation-aware so stale
leases from a crashed daemon cannot consume capacity after restart. No-provider capacity defers work without
consuming a task attempt.

## Independent review

Independent review is defined by recorded inner-provider attribution, not by the outer adapter name. A review
conversation should avoid the inner provider that mutated the current worktree when another healthy eligible inner
provider is available. If no independent inner provider can run, a same-provider last resort must be explicit and
recorded rather than silently treated as independent because both attempts used `OpenHandsProvider`.

`.factory-review.json` and `.factory-architect.json` remain provider-neutral and file-authoritative. Before every
attempt the prior artefact is removed. Factory validates the newly written file before accepting success and
removes control artefacts before product change detection.

## Configuration and compatibility

Production configuration is JSON because `FACTORY_AGENTS_CONFIG` names a validated external file. See
[`config/factory/agents.production.json`](../../config/factory/agents.production.json).

The outer `AgentRouter`, direct CLI adapters, and their compatibility configuration may remain in source while
convergence removes them. Their presence does not make them production providers. Production tests must fail when
any direct outer provider is enabled or any phase route differs from `["openhands"]`.

Deployment preserves an existing operator-owned `/etc/hellotalk-factory/agents.json`. Operators must deliberately
reconcile that file with the canonical production reference after architecture changes; deployment must not
silently rewrite operator policy.

## Prompt and secret boundaries

GitHub issue and PR text is untrusted. Repository-owned Factory policy is supplied through the OpenHands SDK
conversation boundary before untrusted task data. Provider authentication material must not gain GitHub or merge
authority.

Model execution must not receive controller GitHub, Telegram, application, or unrelated provider secrets. Trusted
Factory-owned code performs Git and GitHub mutations, protected-base checks, PR operations, status publication, and
SHA-bound merge decisions.

## Change policy

Changing the production outer boundary, inner provider order, authentication transport, fallback semantics,
review-diversity policy, provider capacity, or model aliases requires coordinated changes to the authoritative
architecture documentation, canonical production config where applicable, and executable regression tests.

Do not re-enable direct Claude, Codex, Google, or OpenCode outer routing as a routine configuration change. Such a
change alters the production execution boundary and requires an explicit architecture decision.
