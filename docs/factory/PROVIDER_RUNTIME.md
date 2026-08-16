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

This is deliberately **not** `FACTORY_GENERATION`. Runtime generation ownership is separate: after acquiring `factory.lock`, the daemon creates a unique generation UUID, writes it to `generation.json`, and rebuilds its pipeline with that UUID. Jobs, leases and provider attribution use the runtime generation so stale processes cannot keep mutating current state.

The daemon checks the active repository checkout for retired swarm workflow entrypoints before taking runtime generation ownership. `scripts/start-factory.sh` refuses an old architecture or `GEMINI_ENABLED=true`. Git history remains the archive for the retired implementation; it is not an executable fallback.

## Independent provider concurrency

- `FACTORY_MAX_PARALLEL_JOBS` controls total Factory worker jobs.
- `FACTORY_OPENAI_MAX_CONCURRENT_CONVERSATIONS` defaults to `2` and caps simultaneous Codex subscription conversations.
- `FACTORY_OPENCODE_MAX_CONCURRENT_CONVERSATIONS` defaults to `3` and caps simultaneous OpenCode Go conversations.
- `FACTORY_PROVIDER_SLOT_WAIT_SECONDS` defaults to `30` and bounds provider-capacity waiting.

Provider slots are durable file-locked leases in `provider-capacity.json`, not process-local semaphores. Provider choice remains stable for the lifetime of one OpenHands conversation.

## Fallback and independent review

Codex is primary. OpenCode Go is selected when Codex OAuth is unavailable, the Codex circuit is open, or independent review should use the other healthy provider. The review phase prefers a different healthy production provider from the implementation provider where practical.

No third model is silently selected. If both Codex OAuth and OpenCode Go are unavailable, the job remains recoverable through the Factory's durable retry/backoff path.

## Failure attribution

Provider circuits represent provider health, not generic job health. Provider-attributable failures such as authentication, rate limiting and upstream errors may affect the circuit breaker. A wall-clock task timeout is recorded as `task-timeout` and **does not** poison Codex/OpenCode health because the cause may instead be issue size, tests, an agent loop or sandbox execution.

Every conversation attempt records non-secret attribution in `provider-attribution.json`, including task, phase, provider/model, runtime generation UUID, success/failure, fallback reason, capacity wait, elapsed time and normalized failure category. Secret tokens, prompts, environments and response bodies are not recorded.

## Doctor and degraded sandbox reporting

`hellotalk-factory doctor` reports the static Factory architecture, single-owner check and authoritative provider chain. Runtime daemon identity remains in the existing generation/heartbeat state. The online doctor validates OpenCode and uses the existing OpenHands OAuth inspection for Codex.

The strict rootless Podman path remains preferred. If the host forces the compatibility fallback that disables nested cgroup limits or uses the host user namespace, doctor reports it as a warning rather than presenting it as fully constrained operation.

## VPS resource envelope

The systemd service uses `MemoryHigh=6G` and `MemoryMax=7G`, giving the service a reclaim threshold before the hard OOM boundary. Provider concurrency and global job concurrency should remain conservative and be raised only with measured headroom.

## OpenHands Agent Server direction

The current Factory still constructs SDK `Conversation` objects locally while confining terminal execution to the secretless rootless Podman worker. OpenHands V1 supports remote `RemoteConversation`/`RemoteWorkspace` execution through Agent Server. The intended evolution is to preserve the Factory state machine and add Agent Server as an execution backend, not replace the Factory with another swarm or CLI scheduler.

That migration must preserve the existing custom terminal/file-editor confinement and reviewed-SHA/CI safety before becoming the default execution backend.
