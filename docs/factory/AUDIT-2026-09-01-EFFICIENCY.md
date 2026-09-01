# Factory efficiency audit: 2026-09-01

## Scope

This audit reviewed the current OpenHands/Repo Factory on `main` after the August efficiency
series, including provider routing and fallbacks, conservative admission, phase models and
reasoning controls, prompt bounds, provider health/circuit state, issue/PR refresh behaviour,
Factory merge/review automation, scheduled GitHub Actions, and the current production instance
configuration.

The objective remains useful engineering throughput per scarce subscription/provider start. The
changes below do not remove security review, independent review, deterministic verification,
required CI, exact-head merge protection, provider diversity, or durable recovery.

## Existing controls reconfirmed

The current tree already contains the major controls from the preceding audits:

- one newly discovered issue is admitted per hour in the HelloTalk production instance;
- issue discovery is admission-aware while pull requests remain freshly reconciled on the normal
  five-minute control-plane cadence;
- conservative mode admits at most six real provider starts per hour and four per task;
- global agent concurrency is two and independent review concurrency is one;
- a route sees at most two provider candidates in conservative mode;
- conservative mode suppresses immediate same-provider retries;
- provider circuits open after the first classified provider-side failure in production;
- provider circuit health and capacity are shared across Repo Factory instances;
- implementation/review/repair prompt bodies are bounded, and stable prompt material is kept in a
  cache-friendly prefix;
- mechanical CI repair is attempted before an agent-backed CI repair;
- Factory-internal stall diagnosis is already restricted to one regular provider with no emergency
  or PAYG cascade;
- OpenHands PAYG remains disabled in production;
- Factory-only pull requests already skip multiple unrelated application/contract runners.

Those protections are retained.

## Finding: Pi forced maximum thinking on every fallback phase

`PiProvider` previously emitted `--thinking max` unconditionally. That meant a fallback quality
repair, CI repair, independent review, or control-plane diagnosis asked Pi for the same maximum
reasoning depth as planning or implementation even though production already selects Haiku for
Pi's repair/review/general-action phases.

This was inconsistent with the phase-aware effort controls already used by Claude, Codex, and
Antigravity.

### Change

Pi now uses phase-specific thinking levels:

- planning, architecture, implementation: `max`;
- security review: `high`;
- independent code review and general action: `medium`;
- quality repair and CI repair: `low`.

The provider, model routing, sandbox, system-prompt channel, verification, and fallback ordering are
unchanged. This reduces requested reasoning allowance whenever Pi is used for a bounded phase while
preserving maximum reasoning for open-ended build work and a stronger security-review tier.

No token percentage is claimed because Pi/Copilot does not expose a portable subscription-token
counter to the Factory.

## Finding: production declared a retry that conservative runtime immediately disabled

`agents.production.json` still declared `same_provider_retries: 1`, while
`ConservativeAgentRouter` sets the effective runtime value to zero. That mismatch had two costs:

1. if conservative mode were ever disabled or misconfigured, production would silently regain an
   immediate retry of the same subscription after a provider-side failure; and
2. `maximum_agent_lease_seconds()` derives its stale-capacity acceptance ceiling from the configured
   retry count before the conservative wrapper overrides the runtime value.

### Change

Production now explicitly declares `same_provider_retries: 0`.

With the current longest 3,600-second phase timeout, the maximum valid outer-router lease envelope
falls from `3,600 * 2 + 300 = 7,500` seconds to `3,600 + 300 = 3,900` seconds, a 48% reduction in the
maximum stale lease window accepted after a crashed worker. Normal successful provider leases are
still released immediately, so this is a recovery/backpressure hardening rather than a throughput
reduction.

The change also makes the no-immediate-retry policy true even if the conservative wrapper is
accidentally disabled.

## Finding: best-effort stall diagnosis could hold a subscription for 30 minutes

The only production `GENERAL_ACTION` caller is the Factory's stall investigation. It receives a
bounded deterministic diagnostic snapshot and, by existing routing policy, may start only one
regular provider. It cannot cascade into another subscription or emergency/PAYG execution.

A 1,800-second phase timeout was therefore disproportionate for best-effort control-plane analysis
and could tie up one of the scarce provider slots long after the deterministic evidence was already
available.

### Change

The production `general_action` timeout is now 600 seconds.

That reduces the maximum runtime/allowance exposure of one automated stall investigation by 66.7%
(30 minutes to 10 minutes). Productive planning, implementation, security review, code review, and
repair timeouts are unchanged.

## Finding: dependency compatibility reconciliation had an event trigger plus four daily polls

`Dependency Compatibility Lanes` already runs immediately whenever `Dependency review` completes.
Its six-hour schedule was therefore a recovery backstop, not the normal execution path, but still
allocated four Ubuntu runners per day for checkout, classifier tests, and reconciliation.

### Change

The event-driven `workflow_run` trigger and manual dispatch are unchanged. The scheduled backstop is
now once daily at 04:41 UTC.

Deterministic scheduled effect:

- compatibility-lane backstop runs: **4/day -> 1/day**;
- scheduled runner allocations avoided: **3/day**;
- scheduled polling reduction: **75%**.

Dependency-review completion still reconciles lanes immediately.

## Deliberately unchanged after current-code review

Several tempting changes were rejected because the present implementation already has a safer or
more precise control:

- the six-start hourly provider budget was not reduced further;
- issue polling was not stretched again because admission-aware issue discovery already removes the
  large backlog scan while retaining five-minute PR reconciliation;
- security review and independent review were not combined or removed;
- the primary planning/architecture/implementation reasoning tiers were not lowered;
- provider candidate fallback and first-failure circuit breaking were not weakened;
- the one-hour Factory merge-recovery workflow was not slowed because it is the daemon-downtime
  fallback for exact-head merges;
- CLI output capture remains bounded but is not used as a hard process-kill threshold: verbose tool
  output can be valid work, so terminating solely on capture volume could waste an otherwise useful
  implementation; phase timeouts remain the authoritative runtime ceiling;
- the generic `max_turns` provider field was not newly injected into CLI flags because direct CLIs
  have different and version-sensitive turn/step semantics; the Factory already has provider-neutral
  phase timeouts and output capture bounds.

## Regression coverage

`automation/tests/test_factory_efficiency_2026_09_01.py` locks:

- Pi's phase-specific thinking levels;
- production zero same-provider retries;
- the ten-minute production general-action ceiling;
- the resulting 3,900-second maximum agent lease envelope; and
- event-driven dependency-lane reconciliation plus a single daily schedule backstop.

## Expected result

This pass removes an unconditional maximum-reasoning setting from bounded Pi fallback work, makes
production's no-immediate-retry policy explicit instead of relying on a wrapper override, cuts the
worst-case allowance exposure of optional stall diagnosis by two thirds, tightens stale provider
capacity recovery, and removes three scheduled GitHub Actions runners per day. Productive Factory
implementation capacity and all existing safety gates remain intact.
