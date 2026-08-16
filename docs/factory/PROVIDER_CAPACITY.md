# OpenHands Factory provider capacity and backpressure

The active autonomous coding system remains the OpenHands Factory daemon on the VPS. The default provider order is Codex through ChatGPT/OpenAI subscription OAuth first, then OpenCode Go. The retired AI swarm is not a provider or scheduling layer.

## Why provider-specific limits exist

`FACTORY_MAX_PARALLEL_JOBS` controls total Factory work, but a subscription provider has its own practical concurrency and throttling constraints. Global parallelism therefore must not imply the same number of simultaneous Codex conversations.

The Factory now acquires a durable provider-capacity lease before starting an OpenHands conversation. The default limits are:

- `FACTORY_OPENAI_MAX_PARALLEL=2`
- `FACTORY_OPENCODE_MAX_PARALLEL=4`
- `FACTORY_GEMINI_MAX_PARALLEL=1` when Gemini is explicitly enabled
- `FACTORY_PROVIDER_SLOT_WAIT_SECONDS=30`

Every provider limit must be less than or equal to `FACTORY_MAX_PARALLEL_JOBS`.

Capacity state is stored under the Factory state directory as `provider-capacity.json`. Entries have bounded expiry times so a killed worker cannot permanently consume a slot. Capacity exhaustion raises a normal recoverable Factory error. The job scheduler applies its existing backoff rather than creating more provider calls.

## Metrics

`hellotalk-factory metrics` reports provider/model calls, successes, failures, fallback calls, rate limits, authentication failures, capacity waits and capacity exhaustion. A call on OpenCode Go is marked as a fallback when the normal primary is the OpenAI subscription provider.

These signals should be used to tune concurrency. Raise a provider cap only after observing stable rate-limit and failure rates. Subscription throttling should lower effective throughput through queue backpressure, not trigger aggressive retries.

## Provider-stable conversations

The capacity layer does not change the provider inside a multi-turn conversation. Provider selection remains conversation-scoped. If a provider becomes unavailable, a later retry may start a fresh conversation on the next healthy provider. This avoids replaying provider-specific tool-call state across incompatible LLM backends.

## Security boundary

Provider capacity files contain only provider names, opaque lease-owner identifiers, timestamps and process IDs. They must never contain OAuth tokens, API keys, prompts, responses or GitHub credentials. Worker containers still do not receive controller credentials.

## Operational checks

When provider throughput is unexpectedly low:

1. Run `hellotalk-factory providers check` to distinguish provider health from capacity pressure.
2. Run `hellotalk-factory metrics` and inspect `capacity_waits`, `capacity_exhausted`, `rate_limits` and authentication failures.
3. Inspect `provider-capacity.json` only as the dedicated Factory service account or root.
4. Do not delete live capacity state while the daemon is active. Expired leases are removed automatically on acquisition.
5. Prefer lowering concurrency after repeated rate limiting rather than reducing retry delays.
