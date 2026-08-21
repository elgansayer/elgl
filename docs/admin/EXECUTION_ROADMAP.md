# Admin Platform Execution Roadmap

This document turns the large admin backlog into an implementation sequence. The dedicated `admin-portal/` is a privileged client, never the source of authority. Every privileged operation must be enforced by the NestJS backend.

## P0: Security foundation

Build these before broad admin mutation capabilities:

1. Dedicated admin authentication and session boundary.
2. Phishing-resistant MFA / WebAuthn support for privileged operators.
3. Server-side capability authorization with deny-by-default behavior.
4. `/api/admin/v1/me` effective-capability contract.
5. Admin session revocation, expiry, device context and re-authentication.
6. Step-up authentication for high-risk actions.
7. Immutable/tamper-evident privileged audit events.
8. Structured reason codes for sensitive actions.
9. Redaction and privacy minimization layer for admin reads.
10. Approval workflow for destructive or unusually broad actions.
11. Idempotency/concurrency safeguards for privileged mutations.
12. Admin API rate limiting and abuse protection.

No admin UI visibility rule may substitute for backend authorization.

## P1: User and trust-and-safety operations

Once P0 exists, prioritize the workflows operators need every day:

- global user search and user investigation view
- warnings, strikes, restrictions, suspension and restoration
- revoke sessions / compromised-account response
- report and moderation case queue
- appeals
- evidence preservation
- spam, bot, scam and phishing response
- coordinated harassment and raid response
- ban-evasion and impersonation investigation
- child/teen safety escalation workflows
- social-graph and direct-message abuse investigation

Prefer reversible interventions with explicit expiry and restoration.

## P2: Content, community and live-media operations

- content quarantine and restoration
- bulk moderation with preview/dry run
- viral-content response
- group/community administration
- live room and livestream intervention
- media/upload moderation
- policy/context labels
- creator/influencer operations
- search, trending and recommendation integrity

High-impact bulk actions require step-up authentication and, where appropriate, independent approval.

## P3: Platform and reliability operations

- sanitized log explorer
- distributed tracing and correlation IDs
- exception/error explorer
- system health dashboard
- job/queue/dead-letter operations
- cache/Redis operations
- storage/CDN/media delivery diagnostics
- Centrifugo/WebSocket health
- LiveKit health
- database/schema/migration operations
- deployment/rollback controls
- SLOs and error budgets
- platform kill switches and maintenance controls

Administrative infrastructure controls must never expose raw provider credentials or service-role secrets to the browser.

## P4: Privacy, compliance and governance

- DSAR workflows
- consent history and governance
- data residency
- retention/deletion verification
- legal holds
- privacy incident response
- bounded/redacted exports
- regional policy handling
- admin-access review

Sensitive reads themselves must be auditable.

## P5: AI and language-product operations

- AI model/provider governance
- prompt and policy versioning
- AI moderation review
- evaluation/red-team tooling
- AI cost/token dashboards
- tutor quality operations
- dictionary/vocabulary corrections
- reading-content operations
- classroom/language-party operations
- pronunciation/audio review

AI-generated decisions must expose provenance and should not silently bypass human-review policy.

## P6: Admin productivity and accessibility

- universal admin search
- investigation workspaces
- saved cases and bookmarks
- command palette
- operator notification inbox
- keyboard-first workflows
- high-zoom layouts
- screen-reader support
- colour-independent state presentation
- customizable dashboards

Accessibility is part of acceptance criteria for privileged workflows, not a follow-up.

## Required implementation shape for every domain

A production-ready admin domain generally needs:

1. explicit capabilities
2. backend DTOs and stable error semantics
3. bounded search/list APIs
4. safe detail/inspection API
5. mutations with reasons and audit events
6. step-up/approval where risk requires it
7. idempotency and concurrency handling
8. redaction/retention/export rules
9. metrics and alerts
10. dedicated portal UI
11. OpenAPI + generated typed client
12. authorization, integration, accessibility and end-to-end tests

## Agent execution rules

Coding agents should prefer small dependency-respecting issues. Do not implement a frontend mutation before its backend capability exists. Do not add destructive powers without audit and reason-code support. Do not introduce mock privileged data into production paths. Avoid direct database manipulation from the admin frontend. Reuse domain services where possible so normal application invariants remain enforced.

## Backlog waves

The original `Admin <domain>: <action>` issues establish broad cross-domain administrative primitives. The newer `Advanced Admin <domain>: <action>` issues expand into specialized trust-and-safety, AI, live-media, reliability, privacy and operator-productivity workflows.

When duplicate intent exists, keep the more specific issue and close/link the generic issue rather than implementing both independently.
