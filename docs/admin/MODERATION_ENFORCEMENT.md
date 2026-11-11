# Flagged Moments moderation and account suspensions

Issue: #2031 (Moderation Dashboard)

This is the first enforcement surface in the admin portal. Members flag a Moment, a reviewer decides in the portal, and a reviewer can suspend the author for a bounded time. The suspension is enforced by the API, not merely recorded.

It follows the prerequisites in [USER_MANAGEMENT.md](./USER_MANAGEMENT.md#account-enforcement-is-not-part-of-this-surface): a time-bounded, reversible restriction record with append-only history; enforcement at the authentication boundary with a bounded cache; `/admin/v1` mutations behind a dedicated capability with reason codes and idempotency keys; and only then portal controls with explicit consequence text.

## Flow

1. **Flag.** A member opens the Moments feed, chooses **Report** on someone else's Moment and picks a category in the existing report dialog. `POST /api/safety/report` accepts an optional `moment_id`. The API verifies the Moment exists and belongs to `reported_id`, then stores `reports.reported_moment_id` and a snapshot of up to 1000 characters of its text. A member flagging the same Moment twice resolves to the same case.
2. **Review.** Operators with `moderation.cases.read` open **Moderation > Flagged Moments** in the portal. Each card shows the snapshot, the reporter's note, the author, the language and post type, links to up to four HTTPS media files, and the author's active suspension if there is one.
3. **Decide.** Operators with `moderation.cases.manage` choose **Dismiss report** (status `approved`), **Uphold report** (status `rejected`) or **Uphold and suspend author**. Each asks for a reason code and an optional private note and states the consequence before the confirm button.
4. **Enforce.** A suspension blocks the account at `SupabaseAuthGuard` until it expires or is lifted. The member sees a translated notice with the end time.
5. **Reverse.** **Lift suspension** on the author's card, or let it expire.

Upholding a report records the decision only. It does not hide the Moment: there is no content-visibility flag in the data model, and adding one touches every feed query. See [Not included](#not-included).

## Data model

Migration `20261109120000_moderation_flagged_moments_and_suspensions.sql`.

- `reports.reported_moment_id` is a **soft reference** (no foreign key) and `reports.reported_moment_excerpt` is the snapshot. If the author deletes the Moment after it is flagged, the case stays in the queue with its evidence; the card says the Moment was deleted. A partial index serves the queue and a partial unique index makes a repeated flag idempotent. The two evidence columns are server-authored: the `reports_insert_own` policy forces them to stay null on direct member inserts, so only `/safety/report`, after verifying the Moment and its author, can attach them. A member cannot fabricate the snapshot a reviewer sees.
- `account_suspensions` holds `user_id`, `reason_code`, private `operator_note`, optional `report_id`, `issued_by`, `idempotency_key`, `created_at`, `expires_at` and the one-time lift fields. RLS is enabled with no policy and all privileges are revoked from `anon` and `authenticated`: only the backend service role touches it.
- A `BEFORE UPDATE` trigger makes the table append-only: an active row can be lifted once and nothing else changes. Foreign keys may be cleared (`ON DELETE SET NULL` fires an update) but never repointed, so deleting an administrator or a report is not blocked.
- Rows cascade away when the user is permanently deleted. Every issue and lift is also written to the append-only `admin_audit_events` trail.

Expected queries: the queue reads `reports WHERE reported_moment_id IS NOT NULL AND status = $1 ORDER BY created_at DESC` (partial index); the authentication boundary reads `account_suspensions WHERE user_id = $1 AND lifted_at IS NULL AND expires_at > now()` (partial index). Neither scans history.

## API

All routes are under `/api/admin/v1/moderation`, guarded by `SupabaseAuthGuard`, `AdminGuard` and `AdminCapabilityGuard`, and audited by `AdminMutationAuditInterceptor` with the actor, target, reason code, outcome and correlation ID. Responses are `no-store`.

| Route | Capability | Notes |
| --- | --- | --- |
| `GET flagged-moments?status=&page=&pageSize=` | `moderation.cases.read` | `status` is `pending` (default), `approved` or `rejected`. At most 50 per page. Three bounded queries per page: reports, live media and active suspensions. |
| `POST flagged-moments/:id/resolve` | `moderation.cases.manage` | Body `{ decision: dismiss or uphold, reasonCode, operatorNote? }`. `:id` is the report ID. |
| `POST users/:id/suspensions` | `moderation.cases.manage` | Body `{ expiresAt, reasonCode, operatorNote?, reportId?, idempotencyKey }`. |
| `POST suspensions/:id/lift` | `moderation.cases.manage` | Body `{ reasonCode, operatorNote? }`. |

Safeguards:

- A suspension must end between one minute and **90 days** ahead. Permanent bans and longer terms need step-up authentication and independent approval first, which the platform does not have yet.
- Administrators (any user holding an admin capability) and the operator themselves cannot be suspended. The refusal carries the stable code `ADMIN_TARGET_PROTECTED` so the portal can explain it.
- `idempotencyKey` is a UUID unique per issuing operator. A retry returns the original suspension with `replayed: true`. Reusing a key for a different user is a `409`.
- A decision is a conditional update on `pending`. Repeating a decision is a no-op; the opposite decision by another reviewer is a `409`. The portal keeps the form open and tells the operator to reload.
- If the suspension cites a report, that report must concern the same user and is upheld afterwards. The suspension is the source of truth: if upholding fails the suspension stands and a retry converges.
- Private operator notes are stored with the audit event and never returned by these endpoints.
- A note that looks like a credential, or exceeds 1000 characters, is refused with `400` before anything changes (the audit interceptor validates it ahead of the handler).
- Mutations are throttled (5 per minute for suspend and lift, 20 for resolve).

## Enforcement and its limits

`SupabaseAuthGuard` asks `AccountSuspensionService.findActive` after the token validates. A suspended identity receives HTTP 403:

```json
{ "statusCode": 403, "error": "Forbidden", "code": "ACCOUNT_SUSPENDED", "message": "This account is temporarily suspended.", "suspendedUntil": "2026-12-01T00:00:00.000Z" }
```

This covers every HTTP route, WebSocket handshakes that use the guard, and realtime or media token issuance, because those endpoints sit behind the same guard. Only the end time is disclosed.

- **Propagation.** Each instance caches the lookup for 30 seconds in a map capped at 10,000 users, and coalesces concurrent lookups for one user. The issuing instance drops its entry immediately; other instances observe an issue or lift within 30 seconds.
- **Fail-open.** If the lookup fails, the request proceeds, the failure is logged as `account_suspension_lookup_failed` and counted in `hellotalk_account_suspension_check_failures_total`. Identity was already verified, and a degraded table must not become a platform outage. Alert on that counter.
- **Existing connections.** A live Centrifugo or LiveKit connection continues until its short-lived token expires; it cannot be renewed because renewal passes the guard.
- **Optional dependency.** The guard injects the service with `@Optional()` so feature-module test beds that never register the global `AccountSuspensionModule` still compile. `AppModule` imports it and `app.module.spec.ts` asserts that.

## Closing an authorisation gap

`GET /moderation/items`, `POST /moderation/approve`, `POST /moderation/reject` and `GET /moderation/analyse/:userId` were reachable by any authenticated member: the controller carried only `SupabaseAuthGuard`, although its API docs promised moderator-only access. They now also require `AdminGuard` plus `moderation.cases.read` (items, analyse) or `moderation.cases.manage` (approve, reject). `POST /moderation/report` stays open to every member. The consumer app's `/admin/moderation` screen is unaffected for operators, who hold those capabilities through the `super_admin` role seeded for existing administrators.

## Portal behaviour and accessibility

- The page opens on **Flagged Moments**; **Member reports** (the existing read-only list) loads on first view only, which avoids an audited read nobody asked for.
- Controls for deciding and suspending render only with `moderation.cases.manage`; the API is authoritative either way.
- Every action opens an inline confirmation `group`, focused on open, with the consequence in plain text, a reason select and a note. Failures keep the form open and are announced in an alert; successes are announced in a persistent `role="status"` region. Colour is never the only signal: suspended authors carry the words "Author suspended".
- Controls are native buttons with a 44 px minimum target, user text uses `dir="auto"`, and layout uses logical properties.
- A retry reuses the idempotency key; changing length, reason or note starts a new request.

## Observability

- `hellotalk_account_suspension_actions_total{action,result}` with `result` of `success`, `replayed`, `conflict` or `failure`.
- `hellotalk_account_suspension_check_failures_total` for failed-open lookups.
- Existing `hellotalk_admin_report_resolutions_total` records dismiss (`approve`) and uphold (`reject`).
- Structured events: `account_suspension_issued`, `account_suspension_lifted`, `account_suspension_lookup_failed`, `flagged_moments_list_failed`, `flagged_moment_resolve_failed`. They carry opaque IDs only: no user content, notes or provider errors.

## Privacy, retention and compliance

- The excerpt is the member's own published text, kept for review. It leaves with the report when the reported member is permanently deleted (`reported_user_id` cascades).
- Suspension records are moderation-generated, not data provided by the member, so they are outside the Article 20 JSON export (`/settings/gdpr`, issue #570). They are held for the member's own access request through support, and cascade away with permanent account deletion.
- The member-facing 403 and toast disclose only the end time.

## Rollout and rollback

1. Apply the migration. It is additive and safe to retry (`IF NOT EXISTS`, drop-then-add constraints). Older backends ignore the new columns and table.
2. Deploy the backend. Nothing is suspended until an operator acts.
3. Deploy the portal and the Angular app.

Rollback: revert the application deploy. Active suspensions then stop being enforced (nothing reads the table) but are retained, and re-deploying resumes enforcement. To release everyone immediately without a deploy, lift suspensions through the API or set `lifted_at` with the service role (the trigger permits lifting an active row once). Do not drop the table: the audit trail references its IDs.

## Not included

- Hiding or removing a flagged Moment. Needs a visibility flag honoured by every feed, search and profile query.
- Permanent bans, step-up authentication and two-person approval for long or broad restrictions.
- Appeals and notifying the member of the reason.
- Instant revocation of live realtime sessions.
- Showing suspension state on the user detail page.

## Verification

- `backend/src/account-suspension/account-suspension.service.spec.ts`: issue, replay, race, lift, cache bounds, TTL, coalescing, fail-open.
- `backend/src/admin/admin-flagged-moments.service.spec.ts`: queue joins, soft-deleted Moments, decisions and races, admin and self protection, report linkage.
- `backend/src/admin/admin-moderation-v1.controller.spec.ts` and `backend/test/admin-flagged-moments.e2e-spec.ts`: guards, capabilities, validation, uncached responses, operator identity from the token.
- `backend/src/admin/admin-mutation-audit.interceptor.spec.ts`: audit target types for the new routes.
- `backend/src/auth/supabase-auth.guard.spec.ts`: 403 body, HTTP and WebSocket paths, no identity exposed.
- `backend/src/moderation/moderation.controller.spec.ts`: the closed authorisation gap.
- `backend/src/safety/safety.service.spec.ts` and `dto/safety.dto.spec.ts`: Moment flagging, snapshot truncation by code point, ownership check, duplicate flag.
- `admin-portal/src/app/admin-flagged-moments.service.spec.ts`, `pages/flagged-moments-panel.component.spec.ts`, `pages/moderation-page.component.spec.ts`: response validation, failure mapping, confirmation, idempotency, capability gating.
- `frontend/src/app/services/account-suspension-notice.service.spec.ts`, `interceptors/account-suspension.interceptor.spec.ts`, `components/moments-feed/moments-feed.report.spec.ts`, `components/report-user-modal/report-user-modal.moment.spec.ts`.
