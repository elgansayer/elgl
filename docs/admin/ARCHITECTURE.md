# Admin Platform Architecture

## Boundary

The admin platform is a privileged control plane over the existing application. It must use normal application services where possible instead of bypassing invariants with direct database writes.

```text
Admin browser
    |
    v
Dedicated admin portal
    |
    v
/admin API gateway/controllers
    |
    +--> admin authentication + session policy
    +--> capability authorization
    +--> step-up / approval checks
    +--> redaction policy
    +--> audit context
    |
    v
Privileged application services
    |
    +--> users/auth
    +--> moderation/reports
    +--> content/media
    +--> groups/messaging/live rooms
    +--> payments/fraud
    +--> jobs/queues/cache/search/storage
    +--> feature flags/configuration
    +--> privacy/compliance
```

## Authorization model

Use capabilities such as:

- `admin.users.read`
- `admin.users.restrict`
- `admin.users.credentials.reset`
- `admin.moderation.cases.read`
- `admin.moderation.actions.write`
- `admin.messages.evidence.read`
- `admin.logs.read`
- `admin.jobs.retry`
- `admin.roles.manage`
- `admin.breakglass.request`

Roles are collections of capabilities. Built-in roles may include support, moderator, senior moderator, trust-and-safety, security, privacy, finance, operations and super-admin, but backend authorization must evaluate capabilities rather than role names.

Support scoped grants where useful, for example region, language, community, environment or product surface. Explicit deny rules should override grants.

## Request pipeline

Every privileged request should establish:

1. authenticated admin identity;
2. active dedicated admin session;
3. effective capabilities and scope;
4. step-up state when required;
5. optional approval token for selected operations;
6. correlation/request ID;
7. structured operator reason where required;
8. redaction policy;
9. audit context.

## Admin API conventions

Use a dedicated, versioned namespace such as `/api/admin/v1`.

Requirements:

- cursor pagination for large collections;
- bounded filters and time ranges;
- stable machine-readable error codes;
- idempotency keys for mutations that can be retried;
- optimistic concurrency or target-version checks for dangerous state changes;
- dry-run/preview endpoints for bulk actions;
- stable audit-event IDs returned from sensitive mutations;
- generated OpenAPI schema and TypeScript client.

## Sensitive reads

Reads can be privileged actions too. Access to moderation evidence, authentication history, private support data, logs, IP/network signals, financial records and privacy records must be audited.

Default responses should be redacted. Exceptionally sensitive fields must require a dedicated capability and, where appropriate, a break-glass grant with short expiry and justification.

## Mutation safety

Prefer state machines over boolean toggles. Examples:

- active -> restricted -> suspended -> restored;
- open case -> assigned -> reviewing -> actioned -> appealed -> resolved;
- media active -> quarantined -> removed/restored.

Dangerous mutations should support as applicable:

- reason code;
- freeform private note;
- expiry;
- preview;
- step-up authentication;
- second approval;
- idempotency;
- rollback;
- user/operator notification;
- audit history.

## Auditing

Audit events should include at minimum:

- event ID;
- timestamp;
- actor/admin ID;
- admin session ID;
- capability used;
- action;
- target type and stable ID;
- reason category;
- correlation ID;
- result;
- safe before/after metadata where useful.

Do not write secrets or unrestricted payload dumps into audit records.

## Operational integrations

Admin-facing operational tools may integrate with logging, tracing, metrics, queue systems, storage/CDN providers, search indexes and feature-flag systems. Prefer adapters behind backend services. The admin portal should not receive provider credentials.

## Bulk operations

All bulk operations require reusable infrastructure for:

- target query snapshot or immutable selection;
- target count and impact preview;
- batch limits;
- dry run;
- confirmation token;
- progress status;
- per-target result;
- cancellation where safe;
- partial failure handling;
- per-target or grouped audit records.

## Testing

Every admin capability requires tests for:

- authorized role/capability;
- unauthorized user;
- wrong scope;
- stale/expired admin session;
- missing step-up state;
- approval failures where relevant;
- idempotency/concurrency;
- redaction;
- audit emission;
- failure/rollback behavior.
