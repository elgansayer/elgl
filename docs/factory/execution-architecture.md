# Factory execution architecture

## Authoritative control plane

The production Factory has exactly one autonomous execution control plane: **OpenHands Agent Canvas**.

Every Factory phase, including planning, architecture, implementation, security review, quality repair, code review, CI repair, and general actions, enters the owned `OpenHandsProvider` boundary and is executed by the bounded `ConversationRunner`. Direct Claude Code, Codex CLI, Gemini/Google Agent, and OpenCode CLI adapters are not production routing peers and must not be enabled through `AgentsConfig`.

This keeps process lifecycle, worktree confinement, provider attribution, capacity limits, circuit breakers, cost accounting, cancellation, and recovery under one control plane rather than creating a second autonomous agent system beside OpenHands.

## Model/provider chain inside OpenHands

For each OpenHands conversation, `ConversationRunner` selects one conversation-stable model provider through `provider_profiles.select_provider_decision`:

1. **OpenAI subscription OAuth / Codex** is the primary provider.
2. **OpenCode Go** is the only production fallback when the primary provider is unavailable or cooling down.

The independent review phase may prefer the other healthy provider for provider diversity, but it still runs as an OpenHands conversation and remains provider-stable for that conversation.

Gemini helpers are historical configuration/diagnostic compatibility only. They are not eligible for production execution. If both production model providers are unavailable, the Factory fails closed and returns the job to bounded retry/recovery rather than silently dispatching a third provider.

## Architecture invariants

- `FACTORY_ARCHITECTURE` remains `openhands-agent-canvas-v1`.
- Outer phase routing resolves only to `openhands`.
- Direct CLI agent providers remain disabled and cannot be referenced by production phase routing.
- OpenHands cannot be disabled in production Factory configuration.
- Underlying provider health is durable and applies only to the two production model providers.
- Routine provider exhaustion is recoverable work, not a reason to resurrect permanent job quarantine or the retired swarm.
- Retired Aider, swarm, guardian, resolver, reviewer, and parallel autonomous executor entrypoints must not return.

## Why two routing layers are prohibited

The Factory contains provider-adapter code that can be useful for diagnostics and migration, but making those adapters autonomous routing peers duplicates responsibilities already owned by OpenHands and `ConversationRunner`. It can bypass OpenHands OAuth/provider selection, produce two incompatible circuit-breaker stores, and make provider provenance ambiguous.

Configuration validation therefore rejects enabled or routed direct agent providers. Removing the unused direct adapters from the codebase is a safe follow-up once compatibility consumers are confirmed absent.
