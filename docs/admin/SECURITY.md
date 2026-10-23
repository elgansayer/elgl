# Admin Security Requirements

## Principles

- Least privilege by default.
- Backend authorization for every privileged read and mutation.
- Stronger controls as operation risk increases.
- Sensitive reads are auditable actions.
- Reversible operations preferred over destructive ones.
- Secrets are never exposed through admin APIs.

## Admin identity and sessions

- Use dedicated admin sessions, separate from ordinary consumer sessions.
- Shorter idle and absolute lifetimes than user sessions.
- Require phishing-resistant MFA for highest-risk roles.
- Support step-up authentication with a short validity window.
- Revoke sessions when roles/capabilities are materially reduced.
- Show active sessions and allow privileged security admins to revoke them.
- Detect suspicious admin login/use patterns and require re-authentication where appropriate.

## Capability risk levels

Suggested levels:

### Low
Read sanitized operational metadata.

### Medium
Reversible moderation/support mutations.

### High
Credential resets, impersonation, private evidence access, financial actions, global configuration and bulk operations.

### Critical
Role/super-admin changes, break-glass data access, destructive global operations, legal holds and emergency security overrides.

High and critical operations should require step-up authentication. Selected critical operations should require independent approval.

## Break-glass access

Break-glass must be exceptional, time-limited and audited.

Required fields:

- requesting admin;
- capability/data class requested;
- reason/reference;
- requested duration;
- approval where configured;
- grant timestamp and expiry;
- every use of the grant.

Normal admin APIs must remain redacted when a break-glass grant is absent.

## Impersonation

Support impersonation only as an explicit support session, never by revealing or replacing user credentials.

During impersonation:

- display a persistent banner;
- record the admin and target user;
- use a short expiry;
- prevent role management, credential/security changes, payment actions and other prohibited high-risk operations;
- audit entry, actions and exit.

## Data handling

Never expose:

- plaintext passwords;
- password hashes;
- session/access/refresh tokens;
- private signing/encryption keys;
- third-party provider secrets;
- database credentials;
- raw environment secrets.

Apply field-level redaction to personal, security and financial data based on capability.

## Admin endpoint protections

- CSRF protection where authentication model requires it.
- Strict CORS/origin policy.
- Rate limits independent from consumer APIs.
- Request size limits.
- Input validation and output serialization.
- Idempotency on retriable mutations.
- Correlation IDs.
- No sensitive payloads in logs.
- Security headers and strict CSP for the portal.

## Consumer-app admin route boundary

The Angular admin guard is a defense-in-depth UX/privacy boundary. It is not an authorization substitute: every privileged backend read and mutation must still enforce the authenticated admin capability server-side.

The frontend contract is intentionally fail-closed:

- every consumer-app route whose path starts with `admin` is protected by `adminGuard`;
- server-side rendering never activates an admin route;
- when there is no access token, the client rejects admin navigation without probing a privileged endpoint;
- the access probe is a real authenticated `GET /admin/users?page=1&pageSize=1` request with no mock-data fallback;
- `401`, `403`, provider/network failures and unexpected access-check exceptions all redirect to `/discovery` rather than rendering privileged UI;
- privileged mutations such as VIP changes, bans and warnings propagate backend failures instead of fabricating successful state.

Route and service regression tests must be updated whenever a new `admin/*` surface is added. The route test deliberately enumerates current admin surfaces so a new unguarded route cannot be added silently.

### Rollout and recovery

This boundary has no schema, migration or configuration dependency and is safe to deploy independently of the backend. Existing server authorization remains authoritative during mixed-version rollout.

If the frontend guard must be rolled back, revert the guard/service/test changes together. Do not weaken or bypass backend admin authorization as part of rollback. A backend authorization outage should continue to deny the consumer-app admin surface until the server can verify access again.

## Destructive actions

For destructive/high-impact operations support as appropriate:

- impact preview;
- explicit target confirmation;
- reason;
- step-up authentication;
- independent approval;
- bounded batch size;
- scheduled execution/cooling-off period;
- rollback/restore where technically possible;
- immutable audit event.

## Audit security

Audit storage should be append-oriented and tamper-evident. Operators who can perform actions should not automatically have permission to erase their audit history.

Audit access itself should be permissioned and sensitive searches should be recorded.

## Emergency controls

Global kill switches must:

- be capability gated;
- identify exact affected surface/environment;
- have a reason;
- default to temporary expiry where practical;
- display prominently to other admins;
- support rollback;
- emit high-priority audit/incident events.

## Security testing

Add tests for privilege escalation, confused-deputy behavior, cross-scope access, stale role caches, expired step-up grants, self-approval, impersonation boundary violations, mass-assignment, IDOR, CSRF/CORS behavior, secret leakage, redaction failures and audit omission.
