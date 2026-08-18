# Factory provider policy

This document defines the production provider authority for the OpenHands Factory control plane.
It supplements `ACTIVE_ARCHITECTURE.md` with the concrete default routing contract that CI must keep stable.

## Canonical production route

For every normal engineering phase, the production route is:

1. `codex` using the OpenAI/ChatGPT subscription-backed Codex CLI.
2. `opencode` using the authenticated OpenCode Go subscription.

`openhands` remains available only as an explicitly `emergency_only` SDK adapter after the normal subscription providers are unavailable or ineligible. It must not preempt either normal provider.

The optional `claude` and `google` adapters remain implemented so they can be deliberately enabled in a future architecture change, but they are disabled in the production configuration and must not appear in the normal routing chain. Gemini/Google therefore remains disabled by default.

## Phase policy

The same normal ordering applies to planning, architecture, implementation, security review, quality repair, code review, CI repair, and general actions. Review independence is enforced by the router's provider-history and diversity rules rather than by changing the canonical provider order.

The production route is represented by `config/factory/agents.production.json`. Factory CI asserts the following invariants:

- routing is enabled;
- Codex and OpenCode use subscription authentication over their CLI transports;
- every routed phase is `codex`, then `opencode`, then emergency-only `openhands`;
- Claude and Google are disabled in production;
- the OpenHands SDK adapter is enabled only as an emergency tier.

A change to this order, authentication mode, transport, or emergency tier is an architecture change. It must update this document, `ACTIVE_ARCHITECTURE.md` when its control-plane description changes, the production configuration, and executable regression tests in the same logical PR.

## Deployment note

Deployment preserves an existing operator-owned `/etc/hellotalk-factory/agents.json` rather than silently overwriting it. `agents.production.json` is the canonical configuration for new installations and the reference operators should reconcile against when changing an existing host. Startup provider checks remain fail-closed for configured enabled providers.
