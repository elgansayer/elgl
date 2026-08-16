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

Do not replace this with OpenHands `FallbackStrategy` for multi-turn conversations while cross-provider tool-call replay can produce provider-incompatible conversation state. Provider selection happens once per conversation. A job-level retry starts a fresh bounded conversation and may select the next healthy provider.

## OAuth ownership and health

OpenAI subscription credentials live under the dedicated `hellotalk-factory` service account home in `~/.openhands/auth/`. Workers never receive that OAuth cache. Initial login and forced re-authentication are operator actions.

The configured OpenAI model must be a model accepted by the installed OpenHands SDK subscription-login implementation. Do not invent model IDs or copy model names from unrelated ChatGPT runtimes.

Credential-file existence is not sufficient proof of provider health. The Factory health model should distinguish credential presence, credential parsing, token refresh, subscription model compatibility, provider throttling, provider-call success, and circuit-breaker state. Online doctor/deployment checks should exercise a bounded non-mutating subscription-login smoke path without exposing credentials.

## Execution boundary

The daemon/controller owns scheduling, provider selection, GitHub orchestration, durable state, health, metrics, and recovery.

Task execution happens in isolated factory worktrees and rootless Podman worker environments. Agents do not receive controller OAuth credentials, GitHub tokens, Telegram credentials, or unrelated host secrets.

Provider credentials are controller capabilities, not task data. They must never be copied into prompts, task worktrees, worker environments, logs, commits, pull requests, review reports, or artifacts.

## Work lifecycle

GitHub issues are the source of work. One bounded OpenHands conversation handles one task attempt. The Factory performs implementation, deterministic quality checks, security review, verification, independent completion review, PR creation, and reconciliation through the current OpenHands Factory pipeline.

All code changes go through branches and pull requests. The active automation must not push directly to protected `main` or silently merge unverified work.

Implementation, quality repair, security review and independent review may use separate bounded OpenHands conversations, but they remain roles inside the same Factory control plane. They must not be split back into independent legacy daemons. When practical, independent review should use a different healthy provider from implementation, while each individual conversation remains provider-stable.

## Provider scheduling and backpressure

Global job concurrency and provider concurrency are separate controls. The scheduler must be able to cap simultaneous Codex subscription conversations independently from OpenCode Go and from the total number of Factory jobs.

Subscription throttling and provider rate limits should produce bounded backpressure rather than retry storms. Fallback reasons should be durable and machine-readable, including OAuth unavailable, refresh failure, unsupported model, rate limiting, provider circuit open, transient provider failure, and provider chain exhausted.

Every task attempt should be attributable to the Factory version/generation, role, provider and model without recording secrets. Metrics should make it possible to compare first-pass CI success, review rejection/repair rate, completion rate, duration, fallback frequency and available usage/cost signals across providers.

## Single-controller ownership

Exactly one Factory generation may be authoritative on the VPS. Durable leases are necessary but should be backed by a host-level single-instance mechanism so two daemon processes cannot simultaneously own the queue.

Jobs, leases, reviews, alerts and PR attribution should carry a Factory generation/version. A stale generation must not acquire or renew work after deployment turnover. Durable state must be schema-versioned; unknown or incompatible state fails closed, migrates explicitly, or is quarantined rather than silently reinterpreted.

Upgrades should validate the candidate environment, perform provider and worker smoke checks, atomically transfer active ownership, and preserve a safe rollback path.

## Legacy isolation rule

Any file, service unit, script, documentation, cron job, tmux process, branch automation, VPS process, PID file, queue, database, state directory, worktree, or credential location that belongs to the retired swarm must be treated as legacy until proven otherwise. Legacy components must not share queues, leases, state directories, credentials, worktrees, alerts, or merge authority with the OpenHands Factory.

When legacy artifacts are discovered, prefer removal if they are unused. If historical state is useful for diagnosis, archive it read-only and outside active Factory paths. Historical documentation must be labelled clearly as retired architecture so an agent cannot mistake it for an operational runbook.

`doctor --online` should eventually prove that no known retired orchestrator is active. Repository CI should prevent new executable references that resurrect retired orchestration while allowing explicitly marked historical documentation.

## Dependency and security changes

Dependency/security automation follows the same Factory lifecycle as product work: issue, bounded OpenHands implementation, deterministic verification, independent review, pull request, required CI, then merge policy.

Major-version upgrades require migration-specific acceptance criteria and must not become autonomously mergeable solely because dependency metadata changed cleanly. Authentication, payments, database engines, runtime versions, framework majors and other high-impact upgrades require explicit compatibility evidence.

## Architecture invariants

The following are intended to become mechanically enforced CI invariants:

- Default provider order is OpenAI subscription/Codex then OpenCode Go.
- Gemini is disabled by default.
- Provider selection is stable for the lifetime of one conversation.
- Workers receive no controller OAuth, GitHub or Telegram secrets.
- Autonomous changes do not push directly to protected `main` or bypass required checks.
- Retired swarm components cannot regain executable authority.
- GitHub issues and current Factory durable state are the only active work authorities.
- One VPS Factory generation owns scheduling at a time.
- Architecture-affecting changes update this document and corresponding tests.

## Hardening roadmap

The implementation backlog for this contract is tracked in GitHub issues:

- #7047: harden Codex OAuth validation and deployment smoke tests.
- #7048: detect and permanently isolate retired AI swarm runtime artifacts.
- #7049: add provider concurrency, backpressure, attribution and quality metrics.
- #7050: enforce single-daemon generation ownership and versioned durable state.
- #7052: codify architecture invariants in CI and autonomous review policy.

These issues are normal Factory work. They must be implemented by the current OpenHands Factory, not by reviving or delegating to the retired swarm.

## Change control

Any future change to provider order, authentication method, autonomous merge authority, execution isolation, work authority, controller ownership, or the decision to reactivate a retired orchestration component requires an explicit architecture change in this document and corresponding tests.
