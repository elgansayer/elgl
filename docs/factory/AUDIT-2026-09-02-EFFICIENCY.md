# Factory efficiency audit - 2026-09-02

## Scope

This pass audited the current `main` implementation of the OpenHands Factory rather than carrying forward assumptions from earlier reviews. The review covered provider routing, retry and circuit behaviour, concurrency and admission budgets, prompt/context construction, implementation/security/review/repair phases, issue and pull-request reconciliation, GitHub Actions recovery workflows, dependency state, and the open Factory pull-request backlog.

An existing storage-hardening pull request, #8784, already owns recovery archive, Podman, watchdog, and host-storage pressure work. This audit deliberately does not duplicate those changes.

During the audit, the green Factory dependency update in #8759 was merged, moving the automation environment to OpenHands SDK/tools 1.44.1 and its associated routine patch updates before this branch was created.

## Current controls that should remain

The current Factory already contains several strong allowance controls and they remain unchanged:

- one newly discovered issue per hour in the production HelloTalk instance;
- at most two concurrent real agent routes and one independent review route;
- six agent starts per hour globally and four per task per configured interval;
- at most two provider candidates per phase;
- no immediate same-provider retry in conservative production mode;
- a first-failure provider circuit with phase/provider cooldowns;
- disabled PAYG OpenHands emergency execution in production;
- 48,000 characters of implementation context, 24,000 characters of task body, 8,000 characters of phase evidence, and smaller review/repair body budgets;
- only `AGENTS.md` as unconditional implementation repository context, rather than replaying the large README feature specification;
- deterministic verification and quality gates before pull-request publication;
- mechanical CI repair before an agent is allowed to spend a route;
- independent exact-head review, required GitHub checks, and exact-head merge protection;
- weekly rather than high-frequency architect analysis.

The main issue pipeline also does not run separate planning and architecture model calls for every issue. Ordinary issue work moves from discovery to implementation, security review, deterministic verification, independent review, CI repair when required, and merge. Further concurrency or prompt reductions here would be more likely to reduce useful throughput than remove obvious waste.

## Changes in this pass

### 1. Pi security fallback: Opus to Sonnet

Pi is the last subscription fallback in the production security-review route. Its security model was still `github-copilot/claude-opus-5`, even though security review is a bounded current-diff checklist and the primary Claude route already uses Sonnet for the same phase.

The Pi security-review model is now `github-copilot/claude-sonnet-5`. Planning and architecture remain on Opus, implementation remains on Sonnet, and repair/review phases remain on Haiku. This removes premium Opus use from a bounded fallback without weakening the open-ended design phases.

### 2. Codex security reasoning: maximum to high

Codex previously defaulted security review to maximum reasoning. The phase already receives a bounded task body and security checklist and is followed by deterministic verification and independent review.

Security review now uses `high` reasoning. Planning, architecture, and implementation remain `max`; code review and general action remain `medium`; quality and CI repair remain `low`.

This is an allowance reduction rather than a safety-gate reduction: the security-review phase, checklist, routing, provider diversity, verification, exact-head review, and merge requirements are unchanged.

### 3. Self-healing scheduled backstop: every three hours to every six hours

`Self-Healing Workflow Monitor` has immediate event-driven paths on pushes to `main` and on CI/Deploy/Admin workflow completion. Its schedule is therefore a missed-event recovery backstop, not the primary repair mechanism.

The scheduled backstop changes from eight starts per day to four starts per day. That is a 50% reduction in this recurring runner allocation, avoiding four healthy no-op runner starts per day, or up to 1,460 per year, while retaining the push and `workflow_run` recovery paths unchanged.

## Observability finding

Provider metrics currently record calls, successes, failures, fallbacks, rate limits, authentication/quota failures, timeouts, duration, capacity waiting, estimated API cost when known, and failure classes. Subscription CLIs do not expose one portable token-usage interface, and the metrics store does not yet persist deterministic proxies such as prompt characters, captured output bytes, or output truncation counts.

That remains the clearest observability gap for future work. The safe implementation should instrument the provider request/result boundary once, preserve backward-compatible metrics restoration, and avoid logging prompt content. It was not combined into this change because doing it correctly spans the shared `AgentResult`, CLI capture, router, metrics schema, and migration tests; a partial counter would be misleading.

## Expected result

This pass reduces premium reasoning consumption on two bounded security paths and removes half of the remaining scheduled self-healing polling, while leaving productive issue admission, implementation quality, provider fallback, security checks, deterministic verification, independent review, and merge safety intact.

The changes are deliberately small because earlier audits have already removed the larger deterministic wastes. The remaining high-value parallel work is #8784's storage-pressure hardening, which should land independently once its exact head is green.
