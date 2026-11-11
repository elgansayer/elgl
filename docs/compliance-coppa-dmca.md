# Compliance: COPPA age assurance and DMCA takedown flow

This document describes the operational contract for the two compliance features delivered by issue #2044. The schema is defined in:

- `supabase/migrations/20261111120000_coppa_age_gate.sql`
- `supabase/migrations/20261111130000_dmca_takedown_flow.sql`

Both migrations are additive and safe to retry. See the migration headers for the exact rollback statements.

## COPPA age assurance

### Behaviour

Every authenticated account must declare a date of birth before it can use the API.

- `SupabaseAuthGuard` evaluates `users.age_gate_status` on every HTTP request and WebSocket handshake.
- A refused request returns HTTP 403 with a stable `code`:
  - `AGE_GATE_REQUIRED` while the account still has to declare a date of birth.
  - `AGE_GATE_BLOCKED` when the account declared an ineligible date of birth.
- Only `@AgeGateExempt()` routes bypass the check: the age-gate controller itself and `POST /privacy/delete-account`, so a blocked user can still close the account.
- Only the `passed` status is cached, for 60 seconds. `required` and `blocked_under_age` are re-read so a state change takes effect immediately.

### API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/age-gate/status` | Read `{ status, required, blocked }` for the caller. Never returns the minimum age or the stored date. |
| `POST` | `/api/age-gate` | Declare `{ "dateOfBirth": "YYYY-MM-DD" }` (UTC calendar date). The first declaration wins. |

The response shape is identical for every outcome, so a client cannot probe the age threshold.

### Blocking and erasure

A declaration under 13, or any declaration from a mailbox locked out in the last 7 days, blocks the account in one statement:

- status becomes `blocked_under_age`;
- the date of birth and self-declared `age` are cleared;
- the profile is hidden from search;
- account deletion is scheduled immediately;
- the sign-in identity is banned.

The hourly `ageGateMaintenance` job completes erasure for blocked accounts, purges the sign-in identity after the deletion pipeline has run, removes expired lockouts, and deletes outcome-log rows older than 24 months.

The lockout store keeps only a keyed HMAC-SHA-256 of the lowercased email address. The outcome log (`age_gate_events`) carries no date of birth, email or name.

### Data protection

The `users_protect_age_gate_columns` trigger stops the `anon` and `authenticated` PostgREST roles from writing the gate columns or changing `age` once a date of birth is recorded. The service role and migrations are trusted.

### Configuration

| Variable | Meaning |
| --- | --- |
| `AGE_GATE_LEGACY_ENFORCEMENT_FROM` | ISO 8601 instant from which accounts created before the gate (`legacy`) must also declare a date of birth. Blank keeps them grandfathered. |

### Rollout

1. Deploy the additive migrations first. Existing accounts default to `legacy` and are not blocked.
2. Deploy the API and frontend together: the `ageGateInterceptor` redirects a refused request to `/age-gate`.
3. Test with a fresh account: `required`, then `passed` for an eligible date, and `blocked_under_age` for an ineligible one.
4. Only after the age-gate screen is confirmed live, set `AGE_GATE_LEGACY_ENFORCEMENT_FROM` to the cut-over instant.

### Rollback

Run the statements in the migration header, then review blocked accounts by hand. Disabling the maintenance job first prevents further erasure while the schema is reverted.

## DMCA notice-and-takedown

### Behaviour

1. A claimant submits a notice through `POST /api/dmca/notices` (public). The API stores one pending row per identified item and emails a single confirmation link.
2. Nothing is disabled until the claimant confirms the link through `POST /api/dmca/notices/verify` (public). Repeating a used token reports the current state instead of failing.
3. On confirmation the API resolves the target, disables it atomically, moves hosted media to the private `dmca-quarantine` prefix, emails both parties, and records an event.
4. Material that cannot be located moves to `needs_review` for an operator.
5. The owner can list notices at `GET /api/dmca/notices/mine` and file a counter-notification at `POST /api/dmca/notices/:id/counter-notice`.
6. After a counter-notification the material is restored 10 business days later unless an operator records a litigation hold.

### API

| Method | Route | Auth | Purpose |
| --- | --- | --- | --- |
| `POST` | `/api/dmca/notices` | public | Submit a notice (5 per hour per address, 30 per mailbox per day, up to 10 items). |
| `POST` | `/api/dmca/notices/verify` | public | Confirm the emailed token. |
| `GET` | `/api/dmca/notices/mine` | owner | List notices about the caller's content, bounded pagination. |
| `POST` | `/api/dmca/notices/:id/counter-notice` | owner | File a counter-notification. Repeat calls are idempotent. |
| `GET` | `/api/admin/v1/dmca/notices` | `moderation.cases.read` | Operator queue. |
| `GET` | `/api/admin/v1/dmca/notices/:id` | `moderation.cases.read` | Notice detail with event trail. |
| `POST` | `/api/admin/v1/dmca/notices/:id/decision` | `moderation.cases.manage` | `disable`, `reject`, `withdraw` or `litigation_hold`, with an audited reason code. |
| `GET` | `/api/legal/dmca` | public | Public copyright policy and designated agent. |

### Disable and restore

`dmca_disable_content` snapshots the original content into `dmca_content_snapshots` and blanks the live row in one transaction. Existing read paths therefore stop serving the material without changes, and the row and its engagements are preserved.

`dmca_restore_content` restores the snapshot unless another live notice still covers the item. The `protect_dmca_disabled_content` trigger stops browser roles editing disabled content or clearing the marker.

### Privacy and retention

- `dmca_notices` holds claimant contact details. Closed notices are deleted 3 years after `closed_at`; unconfirmed notices are deleted 30 days after creation.
- `dmca_content_snapshots` are deleted on restore, or when the target no longer exists (owner deletion or account erasure).
- `dmca_notice_events` stores event names and actors only, never free text or claimant details.
- Logs record event names and counts, never claimant email, content or tokens.

### Repeat infringers

`GET /api/admin/v1/dmca/notices` surfaces accounts with 3 or more active notices in 12 months by queueing them in `reports` with reason `copyright_repeat_infringer`. Accounts are reviewed by an operator and are never closed automatically.

### Configuration

| Variable | Meaning |
| --- | --- |
| `DMCA_AGENT_NAME` | Designated agent name published on the copyright policy. |
| `DMCA_AGENT_EMAIL` | Designated agent email. Falls back to the legal contact address. |
| `DMCA_AGENT_POSTAL_ADDRESS` | Designated agent postal address. |
| `DMCA_AGENT_PHONE` | Designated agent telephone. |

Blank values are omitted from the public page. Register the agent with the US Copyright Office separately.

### Scheduling

- `dmcaMaintenance` runs every 5 minutes: retries verified-but-unprocessed notices, expires unconfirmed notices, restores items whose waiting period passed, completes pending media moves, and removes orphaned snapshots.
- `dmcaRetention` runs daily at 03:00: deletes closed notices after 3 years and unconfirmed notices after 30 days.

### Observability

Metrics are exported on the shared Prometheus registry:

- `hellotalk_compliance_age_gate_decisions_total{outcome}`
- `hellotalk_compliance_dmca_events_total{event}`

### Rollout

1. Deploy the migration.
2. Deploy the API. Nothing is disabled until a claimant confirms a notice.
3. Configure the `DMCA_AGENT_*` values and publish `/legal/dmca`.
4. Exercise the flow in staging with a test Moment and a claimant mailbox you control.

### Rollback

Restore any disabled content through the operator decision API first, then run the statements in the DMCA migration header in reverse order. The header lists the trigger, functions and tables to drop.

## Verification

Focused checks used while developing this change:

```bash
cd backend
npx vitest run --configLoader runner src/age-gate src/dmca \
  src/auth/supabase-auth.guard.age-gate.spec.ts \
  src/database/migrations/20261111120000_coppa_age_gate.spec.ts \
  src/database/migrations/20261111130000_dmca_takedown_flow.spec.ts

cd ../frontend
npx ng test --no-watch --include='src/app/components/age-gate/**/*.spec.ts'
```

The repository CI workflow runs the authoritative full build, lint, unit and end-to-end gates.
