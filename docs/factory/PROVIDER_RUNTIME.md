# Factory Provider Runtime Controls

The active autonomous system is the OpenHands Factory on the VPS. Agent Canvas is the operator-facing OpenHands surface; the Factory remains the durable GitHub/job control plane. The **only production provider order** is:

1. OpenAI/ChatGPT subscription OAuth with Codex through `LLM.subscription_login()`.
2. OpenCode Go.

Gemini is historical configuration only and cannot be enabled as a production fallback. The retired GitHub Actions AI swarm must not coexist with this daemon.

## Architecture identity and runtime generation

Production configuration must contain the static architecture identity:

```text
FACTORY_ARCHITECTURE=openhands-agent-canvas-v1
```

This is deliberately **not** `FACTORY_GENERATION`. Runtime generation ownership is a separate mechanism: after acquiring `factory.lock`, the daemon creates a unique generation UUID, writes it to `generation.json`, and rebuilds its pipeline with that UUID. Jobs, leases and provider attribution use the runtime generation so stale processes cannot keep mutating current state.

The daemon checks the active repository checkout for retired swarm workflow entrypoints before taking runtime generation ownership. `scripts/start-factory.sh` refuses an old architecture or `GEMINI_ENABLED=true`. Git history remains the archive for the retired implementation; it is not an executable fallback.

## Independent provider concurrency

Global job concurrency and provider conversation concurrency are intentionally separate controls:

- `FACTORY_MAX_PARALLEL_JOBS` controls total Factory worker jobs.
- `FACTORY_OPENAI_MAX_CONCURRENT_CONVERSATIONS` defaults to `2` and caps simultaneous Codex subscription conversations.
- `FACTORY_OPENCODE_MAX_CONCURRENT_CONVERSATIONS` defaults to `3` and caps simultaneous OpenCode Go conversations.
- `FACTORY_PROVIDER_SLOT_WAIT_SECONDS` defaults to `30` and bounds how long a worker waits for provider capacity before returning to normal Factory retry/backoff.

Provider slots are durable file-locked leases in `provider-capacity.json`, not process-local semaphores. This means every Factory worker and process observes the same provider cap. Expired leases are discarded automatically after a crashed worker.

The parent selects one provider, reserves that exact provider's durable slot, and explicitly passes the same provider into the spawned OpenHands SDK conversation. The child cannot silently re-select another provider after capacity has been reserved.

Do not replace these controls with the retired swarm, separate provider daemons, or per-call cross-provider fallback. Provider choice remains stable for the lifetime of one OpenHands conversation.

## Fallback and independent review

Provider decisions retain a machine-readable fallback reason. Codex is primary. OpenCode Go is selected when Codex OAuth is unavailable, the Codex circuit is open, or independent review should use the other healthy provider.

For the independent review phase, the Factory prefers a different healthy production provider from the provider that performed the implementation. This gives Codex/OpenCode reviews useful independence without violating conversation-level provider stability. If the alternate provider is unavailable, the healthy production provider remains authoritative.

No third model is silently selected. If both Codex OAuth and OpenCode Go are unavailable, the job remains recoverable through the Factory's durable retry/backoff path.

## Failure attribution

Provider circuits represent provider health, not generic job health. Provider-attributable failures such as authentication, rate limiting and upstream errors may affect the circuit breaker. A wall-clock task timeout is recorded as `task-timeout` and **does not** poison Codex/OpenCode health because the cause may instead be issue size, tests, an agent loop or sandbox execution.

Every conversation attempt records non-secret attribution in `provider-attribution.json` under the Factory state directory. Records include:

- task identifier and Factory phase;
- provider and model;
- runtime Factory generation UUID;
- success/failure;
- whether the attempt used the fallback provider and why;
- provider-capacity wait time;
- elapsed time;
- normalized failure category where applicable.

The attribution store never records API keys, OAuth tokens, prompts, environment values, or response bodies. It is bounded to the latest 5,000 attempts.

## Doctor and degraded sandbox reporting

`hellotalk-factory doctor` reports the static Factory architecture, single-owner check and authoritative provider chain. Runtime daemon identity is reported through the existing generation/heartbeat state. The online doctor validates OpenCode and uses the existing OpenHands OAuth inspection for Codex.

The strict rootless Podman path remains preferred. If the host forces the compatibility fallback that disables nested cgroup limits or uses the host user namespace, the doctor reports that state as a warning rather than presenting it as fully constrained operation. Fix host/rootless-Podman configuration instead of normalizing the degraded path.

## Metrics

Conversation attempts update `metrics.json` provider/model counters under a file lock so concurrent Factory workers cannot overwrite one another. Metrics distinguish successes, failures, fallbacks, rate limiting, authentication failures, capacity-waited calls, total provider-capacity wait time, estimated cost where known, and unknown-cost subscription calls.

Use the existing Factory metrics command to compare Codex subscription and OpenCode Go reliability. Provider attribution is the durable task-level evidence when diagnosing why an individual implementation, repair, security review, or independent review selected a provider or fell back.

## VPS resource envelope

The systemd service uses `MemoryHigh=6G` and `MemoryMax=7G`. `MemoryHigh` starts reclaim pressure before the hard service limit so concurrent build/test workloads have room to drain instead of running directly into the OOM boundary. Provider concurrency and `FACTORY_MAX_PARALLEL_JOBS` should still be tuned conservatively from observed host pressure.

## OpenHands Agent Server direction

The current Factory still constructs SDK `Conversation` objects locally while confining terminal execution to the secretless rootless Podman worker. OpenHands V1 supports remote `RemoteConversation`/`RemoteWorkspace` execution through Agent Server. The intended evolution is to preserve the Factory state machine and add Agent Server as the execution backend, not to replace the Factory with another swarm or CLI scheduler.

That migration must preserve the existing custom terminal/file-editor confinement and reviewed-SHA/CI safety before becoming the default execution backend.
