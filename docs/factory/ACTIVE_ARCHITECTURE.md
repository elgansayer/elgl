# Active OpenHands Factory Architecture

This document is the authoritative architecture contract for autonomous coding in this repository.

## Active system

The active autonomous coding system is the OpenHands Factory daemon running on the VPS.

The retired AI swarm, Aider-based workers, swarm watchdogs, legacy guardians, legacy resolver/reviewer daemons, and any other pre-OpenHands orchestration are not part of the active architecture. They must not be re-enabled, called as fallbacks, or treated as authoritative state.

## Provider order

For each new OpenHands conversation, provider selection is conversation-scoped and health-aware:

1. ChatGPT subscription authentication through `LLM.subscription_login(vendor="openai", ...)`, using a Codex model supported by the installed OpenHands SDK.
2. OpenCode Go through its authenticated OpenAI-compatible endpoint.
3. No third provider is enabled by default.

Gemini support remains optional code only. It may be enabled deliberately through configuration for a controlled experiment, but it is not part of the production fallback chain unless an operator explicitly changes `GEMINI_ENABLED=true`.

Do not replace this with OpenHands `FallbackStrategy` for multi-turn conversations while the documented cross-provider tool-call replay incompatibility remains relevant. Provider selection happens once per conversation, and the job-level retry path may select the next healthy provider for a subsequent conversation.

## OAuth ownership

OpenAI subscription credentials live under the dedicated `hellotalk-factory` service account home in `~/.openhands/auth/`. Workers never receive that OAuth cache. Initial login and forced re-authentication are operator actions.

The configured OpenAI model must be a model accepted by the installed OpenHands SDK subscription-login implementation. Do not invent model IDs or copy model names from unrelated ChatGPT runtimes.

## Execution boundary

The daemon/controller owns scheduling, provider selection, GitHub orchestration, durable state, health, metrics, and recovery.

Task execution happens in isolated factory worktrees and rootless Podman worker environments. Agents do not receive controller OAuth credentials, GitHub tokens, Telegram credentials, or unrelated host secrets.

## Work lifecycle

GitHub issues are the source of work. One bounded OpenHands conversation handles one task attempt. The factory performs implementation, deterministic quality checks, security review, verification, independent completion review, PR creation, and reconciliation through the current OpenHands Factory pipeline.

All code changes go through branches and pull requests. The active automation must not push directly to protected `main` or silently merge unverified work.

## Legacy isolation rule

Any file, service unit, script, documentation, cron job, tmux process, branch automation, or VPS process that belongs to the retired swarm must be treated as legacy until proven otherwise. Legacy components must not share queues, leases, state directories, credentials, worktrees, alerts, or merge authority with the OpenHands Factory.

When legacy artifacts are discovered, prefer removal if they are unused. If historical documentation is useful, label it clearly as retired architecture so an agent cannot mistake it for an operational runbook.

## Change control

Any future change to provider order, authentication method, autonomous merge authority, execution isolation, or the decision to reactivate a retired orchestration component requires an explicit architecture change in this document and corresponding tests.
