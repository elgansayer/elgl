# Factory Provider Runtime Controls

The active autonomous system remains the OpenHands Factory daemon on the VPS. The production provider order is OpenAI/ChatGPT subscription OAuth with Codex first, then OpenCode Go. Gemini remains disabled by default.

## Independent provider concurrency

Global job concurrency and provider conversation concurrency are intentionally separate controls:

- `FACTORY_MAX_PARALLEL_JOBS` controls total Factory worker jobs.
- `FACTORY_OPENAI_MAX_CONCURRENT_CONVERSATIONS` defaults to `2` and caps simultaneous Codex subscription conversations.
- `FACTORY_OPENCODE_MAX_CONCURRENT_CONVERSATIONS` defaults to `3` and caps simultaneous OpenCode Go conversations.
- `FACTORY_GEMINI_MAX_CONCURRENT_CONVERSATIONS` defaults to `1` and has no production effect while Gemini is disabled.
- `FACTORY_PROVIDER_SLOT_WAIT_SECONDS` defaults to `30` and bounds how long a worker waits for provider capacity before returning to normal Factory retry/backoff.

Provider slots are durable file-locked leases in `provider-capacity.json`, not process-local semaphores. This means every Factory worker and process observes the same provider cap. Expired leases are discarded automatically after a crashed worker.

The parent selects one provider, reserves that exact provider's durable slot, and explicitly passes the same provider into the spawned OpenHands SDK conversation. The child cannot silently re-select another provider after capacity has been reserved.

Do not replace these controls with the retired swarm, separate provider daemons, or per-call cross-provider fallback. Provider choice remains stable for the lifetime of one OpenHands conversation.

## Fallback and independent review

Provider decisions retain a machine-readable fallback reason. Examples include missing/expired subscription OAuth, an open OpenAI provider circuit, or provider-capacity exhaustion.

For the independent review phase, the Factory prefers a different healthy provider from the provider that performed the implementation when practical. This gives Codex/OpenCode reviews useful independence without violating the authoritative provider chain or enabling per-call provider bouncing. If the alternate provider is unhealthy, normal healthy-provider selection remains authoritative.

## Attribution

Every conversation attempt records non-secret attribution in `provider-attribution.json` under the Factory state directory. Records include:

- task identifier and Factory phase;
- provider and model;
- `FACTORY_GENERATION`;
- success/failure;
- whether the attempt used a fallback provider and why;
- provider-capacity wait time;
- elapsed time;
- normalized failure category where applicable.

The attribution store never records API keys, OAuth tokens, prompts, environment values, or response bodies. It is bounded to the latest 5,000 attempts.

`FACTORY_GENERATION` should be set by deployment automation to an immutable Factory build or deployment identifier. `unknown` is accepted for local development but should not be used for production deployments.

## Metrics

Conversation attempts update `metrics.json` provider/model counters under a file lock so concurrent Factory workers cannot overwrite one another. Metrics distinguish successes, failures, fallbacks, rate limiting, authentication failures, capacity-waited calls, total provider-capacity wait time, estimated cost where known, and unknown-cost subscription calls.

Use the existing Factory metrics command to compare Codex subscription and OpenCode Go reliability. Provider attribution is the durable task-level evidence when diagnosing why an individual implementation, repair, security review, or independent review selected a provider or fell back.

## Tuning

Start conservatively. Increasing `FACTORY_MAX_PARALLEL_JOBS` does not require increasing provider caps. Raise a provider cap only after observing stable provider health, host memory/CPU headroom, and acceptable rate-limit frequency. Reducing a provider cap is safe and simply increases queue backpressure.
