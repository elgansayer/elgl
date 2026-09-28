# Administrative audit trail

The admin audit trail records privileged administrative reads, mutations, denied capability checks, and RBAC lookup failures without copying request bodies or response payloads into the audit store.

## Coverage

`AdminMutationAuditInterceptor` retains its historical name for compatibility but now audits all `/admin` requests after authentication and authorization. A small set of versioned read endpoints already emit richer semantic records in their controllers and are excluded from the generic interceptor to avoid duplicate events.

Capability denials are recorded by `AdminCapabilityGuard`. Attempts by authenticated users with no effective admin role are recorded by `AdminGuard`. Unauthenticated requests cannot be attributed to an actor and are rejected before an administrative audit row is created.

Each persisted row contains the actor user ID, bounded action, capability when one is known, bounded target identifier, structured reason when supplied, outcome, correlation/request ID, timestamp, and allow-listed operational metadata. Query strings, arbitrary headers, request bodies, response bodies, tokens, passwords, cookies, authorization headers, and arbitrary nested metadata are not persisted.

## Reasons and operator notes

Administrative clients should provide an existing structured `reasonCode` for reviewable mutations and may provide `operatorNote` where the endpoint supports it. The interceptor only reads those two named fields. Notes are normalized and rejected before the mutation runs if they exceed the audit limit or appear to contain credentials. Legacy mutations that do not yet accept a reason remain backward-compatible and record a null reason rather than fabricating one.

## Correlation and identifiers

Only correlation IDs containing letters, digits, `.`, `_`, `:`, or `-` are accepted. Invalid or missing request IDs are replaced with a generated UUID. Generic target identifiers are restricted to bounded ID-safe characters. This prevents an attacker-controlled header or route value from turning the audit trail into a storage channel for secrets.

## Retention

`admin_audit_retention_policy` is a backend-only singleton table. The default retention period is 365 days and the allowed range is 30 to 3650 days. Update the singleton with a service-role/admin database operation when the legal or operational policy changes.

After a successful audit write, each backend process invokes `prune_admin_audit_events()` at most once per 24 hours. The RPC deletes rows older than the configured period. Retention failure is logged with a sanitized event name and error type; it does not discard the audit event that was just written or fail the administrative request.

The retention table and pruning RPC are inaccessible to `anon` and `authenticated` Supabase roles. Browser clients therefore cannot shorten retention or erase audit history.

## Failure behavior

Successful privileged operations complete only after their audit record is persisted. Failed operations emit a `failed` audit outcome before the original error is propagated. Authorization remains fail-closed if a denied-attempt audit cannot be written; the audit service logs the persistence problem without including target IDs, notes, payloads, or database error text.

## Verification

Run the focused backend tests for `admin-audit.service`, `admin-mutation-audit.interceptor`, `admin.guard`, and `admin-capability.guard`, then the repository backend unit/build checks. A clean Supabase migration replay should create the retention policy and service-role-only pruning function.

Operational verification after deployment:

1. Read an ordinary admin list endpoint and confirm one audit event is written.
2. Read one of the existing semantic audit endpoints such as `/admin/v1/audit` and confirm only the route-level event is written.
3. Deny an account a required capability and confirm the attempted route records `outcome=denied`.
4. Send an invalid `x-request-id` and confirm the stored correlation ID is a generated UUID rather than the supplied value.
5. Confirm the retention singleton is `365` unless an approved deployment policy overrides it.

## Rollout and rollback

Deploy the migration before or with the backend. Mixed versions are safe: older backend instances ignore the new retention policy/function, while new instances can prune the existing append-only table.

To roll back application behavior, revert the backend interceptor/guard changes. Leave the migration in place because repository migration history is append-only and the policy/function are inert for older application versions. If retention pruning must be suspended during an incident, set `retention_days` to an approved higher value within the enforced range or revoke service-role execution on `prune_admin_audit_events()` through a forward migration. Do not delete or rewrite deployed migration files.
