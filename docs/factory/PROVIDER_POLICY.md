# Factory provider policy

This document defines the production provider authority for the OpenHands Factory control plane.
It supplements `ACTIVE_ARCHITECTURE.md` with the concrete default routing contract that CI must keep stable.

## Canonical production route

Normal engineering phases use phase-specific subscription routes:

- Planning, architecture, implementation, and security review: `claude`, `codex`, `google`, `opencode`.
- Quality repair, code review, and CI repair: `codex`, `claude`, `google`, `opencode`.
- General actions: `opencode`, `google`, `codex`, `claude`.

`openhands` remains available only as an explicitly `emergency_only` SDK adapter after the normal subscription providers are unavailable or ineligible. It must not preempt a subscription provider.

Claude is enabled in the production reference configuration. Google remains disabled in the production reference configuration until its host authentication and executable are verified, but it remains in every configured route so an operator can enable it without redesigning policy. Disabled, unhealthy, cooling-down, or busy providers are skipped by the router.

## Phase policy

Review and repair phases prefer Codex, while implementation and planning prefer Claude. General actions prefer OpenCode. Review independence is also enforced by provider history and diversity rules, so the implementation provider is avoided when another reviewer is usable.

The production route is represented by `config/factory/agents.production.json`. Factory CI asserts the following invariants:

- routing is enabled;
- Claude, Codex, and OpenCode use subscription authentication over their CLI transports;
- every routed phase follows its documented phase-specific order;
- Google is represented in the routes but disabled in the safe reference configuration;
- the OpenHands SDK adapter is enabled only as an emergency tier.

A change to this order, authentication mode, transport, or emergency tier is an architecture change. It must update this document, `ACTIVE_ARCHITECTURE.md` when its control-plane description changes, the production configuration, and executable regression tests in the same logical PR.

## Deployment note

Deployment preserves an existing operator-owned `/etc/hellotalk-factory/agents.json` rather than silently overwriting it. `agents.production.json` is the canonical configuration for new installations and the reference operators should reconcile against when changing an existing host. Startup provider checks remain fail-closed for configured enabled providers.
