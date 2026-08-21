# ELGL Admin Platform

This directory is the source of truth for the privileged administration platform.

## Objective

Build a production-grade administration system for a modern social/language-learning platform. The admin system must provide deep operational control over users, moderation, content, safety, communities, live rooms, media, jobs, infrastructure-facing operations, privacy workflows, incidents and platform configuration without turning the browser client into a security boundary.

## Core rule

**The backend is always authoritative.** Hiding a button in the admin frontend is UX, never authorization. Every privileged read and mutation must be independently authorized by the backend.

## Target architecture

- `admin-portal/`: dedicated Angular admin application with its own build and deployment.
- `backend`: NestJS admin APIs and privileged service layer.
- Capability-based authorization instead of a single `isAdmin` boolean.
- Dedicated short-lived admin sessions with phishing-resistant MFA for high-risk roles.
- Step-up authentication for dangerous operations.
- Immutable/tamper-evident audit events for sensitive reads and all mutations.
- Field-level redaction and break-glass access for exceptionally sensitive data.
- Reversible operations by default; destructive operations require stronger controls.
- OpenAPI-generated typed client used by the admin portal.

## Documents

- [ARCHITECTURE.md](ARCHITECTURE.md): backend and system architecture.
- [ADMIN_PORTAL.md](ADMIN_PORTAL.md): dedicated admin frontend specification.
- [SECURITY.md](SECURITY.md): privileged-access security requirements.
- [MODULES.md](MODULES.md): functional module map and expected administrative powers.

## Implementation order

1. Capability model, admin identity/session model and audit infrastructure.
2. Versioned `/admin` API contract and generated TypeScript client.
3. Dedicated `admin-portal` shell, authentication, capability-aware navigation and accessible design system.
4. User management, reports/cases and moderation modules.
5. Logs, system health, queues/jobs and incident operations.
6. Communities, messaging, live rooms, media and recommendation controls.
7. Privacy/compliance, payments/fraud and support tooling.
8. Advanced automation, anomaly detection and bulk operations.

## Non-goals

- Never expose passwords, password hashes, private keys, raw session tokens or application secrets.
- Never give the frontend direct database access.
- Never rely on client-side route guards to protect data.
- Never create a universal unaudited super-admin bypass.
- Never allow ordinary support impersonation to inherit payment, credential, role-management or destructive powers.

## Issue backlog

The GitHub backlog contains the implementation tasks. Issues should link back to these documents when architecture or security behavior is relevant. New admin functionality should fit a defined capability, module, audit event and API contract before frontend controls are added.
