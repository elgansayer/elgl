# Factory Provider Runtime Controls

The active autonomous system remains the OpenHands Factory daemon on the VPS. The production provider order is OpenAI/ChatGPT subscription OAuth with Codex first, then OpenCode Go. Gemini remains disabled by default.

## Independent provider concurrency

Global job concurrency and provider conversation concurrency are intentionally separate controls:

- `FACTORY_MAX_PARALLEL_JOBS` controls total Factory worker jobs.
- `FACTORY_OPENAI_MAX_CONCURRENT_CONVERSATIONS` defaults to `2` and caps simultaneous Codex subscription conversations.
- `FACTORY_OPENCODE_MAX_CONCURRENT_CONVERSATIONS` defaults to `3` and caps simultaneous OpenCode Go conversations.
- `FACTORY_GEMINI_MAX_CONCURRENT_CONVERSATIONS` defaults to `1` and has no production effect while Gemini is disabled.

A worker that selects a provider reserves that provider's slot before creating the OpenHands conversation subprocess. When all slots are occupied, the worker waits locally instead of starting another provider call. This is deliberate backpressure and prevents global worker capacity from becoming an accidental subscription-rate-limit multiplier.

Do not replace these controls with the retired swarm, separate provider daemons, or per-call cross-provider fallback. Provider choice remains stable for the lifetime of one OpenHands conversation.

## Attribution

Every conversation attempt records non-secret attribution in `provider-attribution.json` under the Factory state directory. Records include:

- task identifier;
- provider and model;
- `FACTORY_GENERATION`;
- success/failure;
- whether the attempt used a fallback provider;
- elapsed time;
- normalized failure category where applicable.

The attribution store never records API keys, OAuth tokens, prompts, environment values, or response bodies. It is bounded to the latest 5,000 attempts.

`FACTORY_GENERATION` should be set by deployment automation to an immutable Factory build or deployment identifier. `unknown` is accepted for local development but should not be used for production deployments.

## Metrics

Conversation attempts also update the existing `metrics.json` provider/model counters under a file lock so concurrent Factory workers cannot overwrite one another. The metrics distinguish successful and failed calls, fallbacks, rate limiting, authentication failures, estimated cost where known, and unknown-cost subscription calls.

Use the existing Factory metrics command to compare Codex subscription and OpenCode Go reliability. Provider attribution is the durable task-level evidence when diagnosing why an individual task fell back or failed.

## Tuning

Start conservatively. Increasing `FACTORY_MAX_PARALLEL_JOBS` does not require increasing provider caps. Raise a provider cap only after observing stable provider health, host memory/CPU headroom, and acceptable rate-limit frequency. Reducing a provider cap is safe and simply increases queue backpressure.
